-- SPOT — Room creation, joining, and lifecycle (PRD §18-§22, §47-§49)
--
-- Guests have no auth.uid(), so gameplay tables stay deny-all under RLS and
-- ALL access flows through these SECURITY DEFINER functions. Each function is
-- therefore the security boundary and authorizes explicitly:
--   * players are identified by an opaque server-issued guest token
--     (only its sha256 hash is stored)
--   * hosts are identified by auth.uid() OR their host guest token
-- Never trust the room code for authorization — it is discovery only (§20).

-- Room codes only need to be unique among rooms that are still reachable,
-- so 4-digit codes stay viable long-term (§20). Replaces the global unique.
alter table public.rooms drop constraint if exists rooms_room_code_key;

create unique index if not exists rooms_active_code_idx
  on public.rooms (room_code)
  where status in ('lobby', 'active', 'paused');

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.hash_guest_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(p_token, 'sha256'), 'hex');
$$;

/** Resolves a guest token (or signed-in user) to an active player row. */
create or replace function public.resolve_player(p_room_id uuid, p_guest_token text)
returns public.room_players
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.room_players p
  where p.room_id = p_room_id
    and p.status = 'active'
    and (
      (p_guest_token is not null
        and p.guest_token_hash = public.hash_guest_token(p_guest_token))
      or (auth.uid() is not null and p.user_id = auth.uid())
    )
  limit 1;
$$;

create or replace function public.is_room_host(p_room_id uuid, p_guest_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.host_user_id is not null and r.host_user_id = auth.uid()
  ) or exists (
    select 1 from public.room_players p
    where p.room_id = p_room_id
      and p.role = 'host'
      and p.status = 'active'
      and p_guest_token is not null
      and p.guest_token_hash = public.hash_guest_token(p_guest_token)
  );
$$;

-- ---------------------------------------------------------------------------
-- create_room (PRD §48)
-- ---------------------------------------------------------------------------
create or replace function public.create_room(
  p_game_template_id uuid,
  p_host_token text,
  p_host_nickname text,
  p_game_mode text default 'classic',
  p_continue_after_win boolean default true
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
  v_nickname text;
begin
  if p_host_token is null or length(p_host_token) < 20 then
    raise exception 'invalid host token';
  end if;
  if p_game_mode not in ('classic', 'blackout') then
    raise exception 'unsupported game mode';
  end if;

  -- The game must be startable by this caller: published public/unlisted,
  -- or privately owned by them (§45).
  select * into v_game
  from public.game_templates
  where id = p_game_template_id
    and status <> 'archived'
    and (
      (visibility in ('public', 'unlisted') and status = 'published')
      or (creator_id is not null and creator_id = auth.uid())
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

  -- 4-digit code, retried on collision against currently-reachable rooms.
  for attempt in 1..25 loop
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    begin
      insert into public.rooms
        (game_template_id, host_user_id, room_code, game_mode,
         continue_after_win, expires_at)
      values
        (v_game.id, auth.uid(), v_code, p_game_mode,
         coalesce(p_continue_after_win, true), now() + interval '12 hours')
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
    (v_room_id, auth.uid(), public.hash_guest_token(p_host_token), v_nickname, 'host');

  update public.game_templates
     set play_count = play_count + 1
   where id = v_game.id;

  return jsonb_build_object('roomId', v_room_id, 'roomCode', v_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_join_info — public, pre-join lookup for /join/[code] (PRD §19)
-- Exposes only what the join screen shows; never player or card data.
-- ---------------------------------------------------------------------------
create or replace function public.get_join_info(p_room_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'roomId', r.id,
    'roomCode', r.room_code,
    'status', r.status,
    'expired', (r.expires_at <= now() or r.status in ('completed', 'expired')),
    'gameTitle', g.title,
    'contentRating', g.content_rating,
    'playerCount', (
      select count(*) from public.room_players p
      where p.room_id = r.id and p.status = 'active'
    )
  )
  from public.rooms r
  join public.game_templates g on g.id = r.game_template_id
  where r.room_code = upper(btrim(p_room_code))
    and r.status in ('lobby', 'active', 'paused')
  order by r.created_at desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- join_room (PRD §19, §49) — creates the player AND their card atomically
-- ---------------------------------------------------------------------------
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

  -- Re-joining with the same token returns the existing player (§49 replay).
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
    (v_room.id, auth.uid(), public.hash_guest_token(p_guest_token), v_nickname, 'player')
  returning id into v_player_id;

  perform public.generate_player_card(v_player_id, v_room.id, v_game.id,
                                      v_game.card_size, v_game.free_center);

  insert into public.room_events (room_id, room_player_id, event_type, payload)
  values (v_room.id, v_player_id, 'player_joined',
          jsonb_build_object('nickname', v_nickname));

  return jsonb_build_object(
    'roomId', v_room.id, 'playerId', v_player_id, 'rejoined', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_player_card (PRD §18)
-- Server-side only, independently shuffled per player. gen_random_uuid()
-- ordering gives each player a different draw AND different placement.
-- ---------------------------------------------------------------------------
create or replace function public.generate_player_card(
  p_room_player_id uuid,
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
  values (p_room_player_id, p_room_id)
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

-- ---------------------------------------------------------------------------
-- Room lifecycle (PRD §22 state machine, §44 host-only)
-- ---------------------------------------------------------------------------
create or replace function public.start_room(p_room_id uuid, p_host_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not public.is_room_host(p_room_id, p_host_token) then
    raise exception 'not the host';
  end if;
  select status into v_status from public.rooms where id = p_room_id;
  if v_status <> 'lobby' then
    raise exception 'room cannot start from %', v_status;
  end if;
  update public.rooms set status = 'active', started_at = now() where id = p_room_id;
  insert into public.room_events (room_id, event_type) values (p_room_id, 'game_started');
  return jsonb_build_object('status', 'active');
end;
$$;

create or replace function public.pause_room(p_room_id uuid, p_host_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not public.is_room_host(p_room_id, p_host_token) then
    raise exception 'not the host';
  end if;
  select status into v_status from public.rooms where id = p_room_id;
  if v_status <> 'active' then
    raise exception 'room cannot pause from %', v_status;
  end if;
  update public.rooms set status = 'paused', paused_at = now() where id = p_room_id;
  insert into public.room_events (room_id, event_type) values (p_room_id, 'game_paused');
  return jsonb_build_object('status', 'paused');
end;
$$;

create or replace function public.resume_room(p_room_id uuid, p_host_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not public.is_room_host(p_room_id, p_host_token) then
    raise exception 'not the host';
  end if;
  select status into v_status from public.rooms where id = p_room_id;
  if v_status <> 'paused' then
    raise exception 'room cannot resume from %', v_status;
  end if;
  update public.rooms set status = 'active', paused_at = null where id = p_room_id;
  insert into public.room_events (room_id, event_type) values (p_room_id, 'game_resumed');
  return jsonb_build_object('status', 'active');
end;
$$;

-- COMPLETED is terminal (§22): no transition back to ACTIVE exists.
create or replace function public.end_room(p_room_id uuid, p_host_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if not public.is_room_host(p_room_id, p_host_token) then
    raise exception 'not the host';
  end if;
  select status into v_status from public.rooms where id = p_room_id;
  if v_status not in ('lobby', 'active', 'paused') then
    raise exception 'room already %', v_status;
  end if;
  update public.rooms set status = 'completed', ended_at = now() where id = p_room_id;
  insert into public.room_events (room_id, event_type) values (p_room_id, 'game_completed');
  return jsonb_build_object('status', 'completed');
end;
$$;

create or replace function public.remove_player(
  p_room_id uuid,
  p_player_id uuid,
  p_host_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  if not public.is_room_host(p_room_id, p_host_token) then
    raise exception 'not the host';
  end if;
  select role into v_role from public.room_players
   where id = p_player_id and room_id = p_room_id;
  if not found then
    raise exception 'player not in room';
  end if;
  if v_role = 'host' then
    raise exception 'cannot remove the host';
  end if;

  update public.room_players set status = 'removed' where id = p_player_id;
  insert into public.room_events (room_id, room_player_id, event_type)
  values (p_room_id, p_player_id, 'player_removed');
  return jsonb_build_object('removed', p_player_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_room_snapshot (PRD §29 reconnect, §47 optional)
-- Authoritative state for one viewer: room, players (no other player's card),
-- and the caller's own card.
-- ---------------------------------------------------------------------------
create or replace function public.get_room_snapshot(p_room_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_me public.room_players%rowtype;
  v_is_host boolean;
  v_card jsonb;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'room not found';
  end if;

  v_is_host := public.is_room_host(p_room_id, p_token);
  select * into v_me from public.resolve_player(p_room_id, p_token);

  if v_me.id is null and not v_is_host then
    raise exception 'not a participant';
  end if;

  select jsonb_agg(jsonb_build_object(
           'id', s.id, 'position', s.position, 'text', s.display_text,
           'isFree', s.is_free, 'marked', s.marked
         ) order by s.position)
    into v_card
  from public.player_card_squares s
  join public.player_cards c on c.id = s.player_card_id
  where c.room_player_id = v_me.id;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'code', v_room.room_code, 'status', v_room.status,
      'gameMode', v_room.game_mode, 'continueAfterWin', v_room.continue_after_win,
      'winnerPlayerId', v_room.winner_player_id
    ),
    'isHost', v_is_host,
    'me', case when v_me.id is null then null else jsonb_build_object(
      'id', v_me.id, 'nickname', v_me.nickname, 'role', v_me.role,
      'score', v_me.score, 'hasBingo', v_me.has_bingo
    ) end,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nickname', p.nickname, 'role', p.role,
               'score', p.score, 'markedCount', p.marked_count,
               'hasBingo', p.has_bingo
             ) order by p.score desc, p.joined_at)
      from public.room_players p
      where p.room_id = p_room_id and p.status = 'active'
    ), '[]'::jsonb),
    'card', coalesce(v_card, '[]'::jsonb)
  );
end;
$$;

-- Guests are anonymous by design, so anon must be able to call these; each
-- function authorizes internally via guest token / auth.uid().
grant execute on function public.create_room(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.get_join_info(text) to anon, authenticated;
grant execute on function public.join_room(text, text, text) to anon, authenticated;
grant execute on function public.start_room(uuid, text) to anon, authenticated;
grant execute on function public.pause_room(uuid, text) to anon, authenticated;
grant execute on function public.resume_room(uuid, text) to anon, authenticated;
grant execute on function public.end_room(uuid, text) to anon, authenticated;
grant execute on function public.remove_player(uuid, uuid, text) to anon, authenticated;
grant execute on function public.get_room_snapshot(uuid, text) to anon, authenticated;

-- Internal helpers must never be callable directly by clients.
revoke execute on function public.generate_player_card(uuid, uuid, uuid, integer, boolean) from public, anon, authenticated;
revoke execute on function public.resolve_player(uuid, text) from public, anon, authenticated;
revoke execute on function public.hash_guest_token(text) from public, anon, authenticated;
revoke execute on function public.is_room_host(uuid, text) from public, anon, authenticated;
