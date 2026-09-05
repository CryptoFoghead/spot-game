-- A room had no ceiling of any kind.
--
-- Anyone with a 4-digit code could join, without limit, and every join writes
-- a player row plus a 25-square card — 26 rows each, measured. Rows are the
-- cheap part: the expensive part is that every mark broadcasts to every
-- connected client and each one refetches an authoritative server render, so
-- the cost of a single mark scales with the size of the room.
--
-- 100 is deliberately far above any plausible real event. This is a blast
-- radius, not a product decision. Pricing (docs/PRICING.md) would later vary
-- this column per room; nothing here commits to a price or a tier, and no
-- existing room is remotely near the limit.

alter table public.rooms
  add column if not exists max_players integer not null default 100;

do $$
begin
  alter table public.rooms
    add constraint rooms_max_players_check check (max_players between 2 and 500);
exception when duplicate_object then null;
end $$;

comment on column public.rooms.max_players is
  'Ceiling on active players. The default is an operational guard, not a plan. See docs/PRICING.md before wiring this to money.';

/**
 * join_room, unchanged except that it now refuses a full room.
 *
 * This is deliberately the 0024 body with two things inserted, rather than a
 * fresh implementation — writing it from scratch quietly drifted the guest
 * token minimum from 20 to 32 characters, which would have locked out every
 * guest holding a shorter token.
 *
 * Three properties that must survive any future edit:
 *   - rejoining is NOT a new join. Someone reconnecting to a room they are
 *     already in must get back in even when it is full, or a full room
 *     strands its own players on a flaky network.
 *   - the host occupies a seat, because the host holds a card and plays.
 *   - the count is of ACTIVE players, so a removed player frees their seat —
 *     but cannot use it themselves, since 'removed from room' is checked first.
 *
 * Same signature and parameter names, so this replaces rather than overloads
 * (B-15).
 */
create or replace function public.join_room(
  p_room_code text,
  p_nickname text,
  p_guest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_game public.game_templates%rowtype;
  v_player_id uuid;
  v_nickname text;
  v_existing public.room_players%rowtype;
  v_user_id uuid := public.current_user_id();
  v_active integer;
begin
  if p_guest_token is null or length(p_guest_token) < 20 then
    raise exception 'invalid guest token';
  end if;

  v_nickname := btrim(regexp_replace(coalesce(p_nickname, ''), '[[:cntrl:]]', '', 'g'));
  if v_nickname = '' then
    raise exception 'nickname required';
  end if;
  if char_length(v_nickname) > 24 then
    v_nickname := left(v_nickname, 24);
  end if;

  select * into v_room
  from public.rooms
  where room_code = upper(btrim(p_room_code))
    and status in ('lobby', 'active', 'paused')
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'room not found';
  end if;
  if v_room.expires_at <= now() then
    raise exception 'room expired';
  end if;

  select * into v_existing
  from public.room_players
  where room_id = v_room.id
    and guest_token_hash = public.hash_guest_token(p_guest_token);

  if found then
    if v_existing.status = 'removed' then
      raise exception 'removed from room';
    end if;
    update public.room_players
       set status = 'active', last_seen_at = now(), nickname = v_nickname
     where id = v_existing.id;
    return jsonb_build_object(
      'roomId', v_room.id, 'playerId', v_existing.id, 'rejoined', true
    );
  end if;

  -- New seat. Serialise concurrent joins so two people cannot both take the
  -- last one — the same lock discipline marking already uses.
  perform pg_advisory_xact_lock(hashtext('room_join:' || v_room.id::text));

  select count(*) into v_active
  from public.room_players
  where room_id = v_room.id and status = 'active';

  if v_active >= v_room.max_players then
    raise exception 'room is full';
  end if;

  select * into v_game from public.game_templates where id = v_room.game_template_id;

  insert into public.room_players
    (room_id, user_id, guest_token_hash, nickname, role)
  values
    (v_room.id, v_user_id, public.hash_guest_token(p_guest_token), v_nickname, 'player')
  returning id into v_player_id;

  if v_room.game_mode = 'coop' then
    perform public.generate_shared_card(v_room.id, v_game.id,
                                        v_game.card_size, v_game.free_center);
  else
    perform public.generate_player_card(v_player_id, v_room.id, v_game.id,
                                        v_game.card_size, v_game.free_center);
  end if;

  insert into public.room_events (room_id, room_player_id, event_type, payload)
  values (v_room.id, v_player_id, 'player_joined',
          jsonb_build_object('nickname', v_nickname));

  return jsonb_build_object(
    'roomId', v_room.id, 'playerId', v_player_id, 'rejoined', false
  );
end;
$$;

grant execute on function public.join_room(text, text, text) to anon, authenticated;
