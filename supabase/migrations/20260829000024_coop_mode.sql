-- Co-op mode: one card, played together.
--
-- Built for the two-people-at-a-table case. A leaderboard between two people
-- sitting across from each other is oddly adversarial; sharing one card turns
-- the game into a joint task, which is the point when the reason you're
-- playing is to have something to talk about.
--
-- Shape:
--   * the room holds ONE card (player_cards.room_player_id is null)
--   * any active player may mark any square on it
--   * each square records who spotted it, so "you found more" survives
--   * completing a line is a win for everyone in the room

alter table public.player_cards
  alter column room_player_id drop not null;

-- A shared card belongs to the room and has no owner; personal cards keep
-- their one-card-per-player guarantee.
alter table public.player_cards
  add constraint player_cards_owner_or_shared
  check (room_player_id is not null or room_id is not null);

create unique index if not exists player_cards_shared_room_idx
  on public.player_cards (room_id)
  where room_player_id is null;

-- Attribution: who spotted this one.
alter table public.player_card_squares
  add column if not exists marked_by uuid
    references public.room_players (id) on delete set null;

/** Builds the room's shared card. Same independent shuffle as a personal one. */
create or replace function public.generate_shared_card(
  p_room_id uuid,
  p_game_template_id uuid,
  p_card_size integer,
  p_free_center boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_id uuid;
  v_cells integer := p_card_size * p_card_size;
  v_center integer := (p_card_size * p_card_size - 1) / 2;
  v_needed integer;
  v_ids uuid[];
  v_texts text[];
  v_pos integer;
  v_ptr integer := 1;
begin
  select id into v_card_id
  from public.player_cards
  where room_id = p_room_id and room_player_id is null;
  if found then
    return v_card_id;
  end if;

  v_needed := v_cells - case when p_free_center then 1 else 0 end;

  with shuffled as (
    select id, text
    from public.game_squares
    where game_template_id = p_game_template_id and is_active
    order by gen_random_uuid()
    limit v_needed
  )
  select array_agg(id), array_agg(text) into v_ids, v_texts from shuffled;

  if v_ids is null or array_length(v_ids, 1) < v_needed then
    raise exception 'not enough squares to build a card';
  end if;

  insert into public.player_cards (room_player_id, room_id)
  values (null, p_room_id)
  returning id into v_card_id;

  for v_pos in 0..(v_cells - 1) loop
    if p_free_center and v_pos = v_center then
      insert into public.player_card_squares
        (player_card_id, game_square_id, position, row_index, column_index,
         display_text, is_free, marked, marked_at)
      values
        (v_card_id, null, v_pos, v_pos / p_card_size, v_pos % p_card_size,
         'FREE', true, true, now());
    else
      insert into public.player_card_squares
        (player_card_id, game_square_id, position, row_index, column_index,
         display_text, is_free, marked)
      values
        (v_card_id, v_ids[v_ptr], v_pos, v_pos / p_card_size, v_pos % p_card_size,
         v_texts[v_ptr], false, false);
      v_ptr := v_ptr + 1;
    end if;
  end loop;

  return v_card_id;
end;
$$;

revoke execute on function public.generate_shared_card(uuid, uuid, integer, boolean)
  from public, anon, authenticated;

-- create_room accepts 'coop' and builds the shared card instead of the host's.
create or replace function public.create_room(
  p_game_template_id uuid,
  p_host_token text,
  p_host_nickname text,
  p_game_mode text default 'classic',
  p_continue_after_win boolean default true,
  p_duration_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.game_templates%rowtype;
  v_needed integer;
  v_active integer;
  v_code varchar(6);
  v_room_id uuid;
  v_host_player_id uuid;
  v_nickname text;
  v_user_id uuid := public.current_user_id();
  v_duration integer;
begin
  if p_host_token is null or length(p_host_token) < 20 then
    raise exception 'invalid host token';
  end if;
  if p_game_mode not in
     ('classic','blackout','double','four_corners','points','timed','coop') then
    raise exception 'unsupported game mode';
  end if;

  if p_game_mode = 'timed' then
    v_duration := coalesce(p_duration_seconds, 600);
    if v_duration < 60 or v_duration > 7200 then
      raise exception 'timed games run between 1 and 120 minutes';
    end if;
  else
    v_duration := null;
  end if;

  select * into v_game
  from public.game_templates
  where id = p_game_template_id
    and status <> 'archived'
    and (
      (visibility in ('public', 'unlisted') and status = 'published')
      or (creator_id is not null and creator_id = v_user_id)
    );
  if not found then
    raise exception 'game not found or not available to start';
  end if;

  v_needed := v_game.card_size * v_game.card_size
    - case when v_game.free_center then 1 else 0 end;

  select count(*) into v_active
  from public.game_squares
  where game_template_id = v_game.id and is_active;

  if v_active < v_needed then
    raise exception 'game needs at least % squares to start (has %)', v_needed, v_active;
  end if;

  for attempt in 1..25 loop
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    begin
      insert into public.rooms
        (game_template_id, host_user_id, room_code, game_mode,
         continue_after_win, expires_at, duration_seconds)
      values
        (v_game.id, v_user_id, v_code, p_game_mode,
         coalesce(p_continue_after_win, true), now() + interval '12 hours',
         v_duration)
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      v_room_id := null;
    end;
  end loop;

  if v_room_id is null then
    raise exception 'could not allocate a room code, try again';
  end if;

  v_nickname := nullif(btrim(regexp_replace(coalesce(p_host_nickname, ''), '[[:cntrl:]]', '', 'g')), '');
  v_nickname := left(coalesce(v_nickname, 'Host'), 24);

  insert into public.room_players
    (room_id, user_id, guest_token_hash, nickname, role)
  values
    (v_room_id, v_user_id, public.hash_guest_token(p_host_token), v_nickname, 'host')
  returning id into v_host_player_id;

  if p_game_mode = 'coop' then
    perform public.generate_shared_card(v_room_id, v_game.id,
                                        v_game.card_size, v_game.free_center);
  else
    perform public.generate_player_card(v_host_player_id, v_room_id, v_game.id,
                                        v_game.card_size, v_game.free_center);
  end if;

  insert into public.room_events (room_id, room_player_id, event_type, payload)
  values (v_room_id, v_host_player_id, 'player_joined',
          jsonb_build_object('nickname', v_nickname, 'role', 'host'));

  update public.game_templates
     set play_count = play_count + 1
   where id = v_game.id;

  return jsonb_build_object('roomId', v_room_id, 'roomCode', v_code);
end;
$$;

grant execute on function public.create_room(uuid, text, text, text, boolean, integer)
  to anon, authenticated;

-- Joiners share the room's card rather than getting their own.
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
