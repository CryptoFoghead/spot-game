-- Timed mode (PRD §13).
--
-- Deferred earlier because, unlike the other modes, this one is not a win
-- condition — it is a room lifecycle. Built now with a deliberate rule:
--
--   In timed mode a completed line does NOT end the game.
--
-- Otherwise a ten-minute round finishes in ninety seconds and the clock is
-- decoration. The round runs to the end and the highest score wins, which
-- makes it a genuinely different way to play rather than classic with a timer
-- stapled on.

alter table public.rooms
  add column if not exists duration_seconds integer
    check (duration_seconds is null or duration_seconds between 60 and 7200);

-- No line win in timed mode; blackout and the rest are unchanged.
create or replace function public.card_has_bingo(
  p_card_id uuid,
  p_card_size integer,
  p_mode text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with sq as (
    select row_index, column_index, marked
    from public.player_card_squares
    where player_card_id = p_card_id
  ),
  lines as (
    select bool_and(marked) as complete from sq group by row_index
    union all
    select bool_and(marked) from sq group by column_index
    union all
    select bool_and(marked) from sq where row_index = column_index
    union all
    select bool_and(marked) from sq
      where row_index + column_index = p_card_size - 1
  )
  select case
    when p_mode = 'timed' then false

    when p_mode = 'blackout' then
      coalesce((select bool_and(marked) from sq), false)

    when p_mode = 'double' then
      coalesce((select count(*) filter (where complete) >= 2 from lines), false)

    when p_mode = 'four_corners' then
      coalesce((
        select bool_and(marked) from sq
        where (row_index = 0 or row_index = p_card_size - 1)
          and (column_index = 0 or column_index = p_card_size - 1)
      ), false)

    else
      coalesce((select bool_or(complete) from lines), false)
  end;
$$;

-- "One away" means nothing when there is no line to complete.
create or replace function public.card_is_one_away(
  p_card_id uuid,
  p_card_size integer,
  p_mode text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with sq as (
    select row_index, column_index, marked
    from public.player_card_squares
    where player_card_id = p_card_id
  ),
  lines as (
    select count(*) filter (where not marked) as remaining from sq group by row_index
    union all
    select count(*) filter (where not marked) from sq group by column_index
    union all
    select count(*) filter (where not marked) from sq where row_index = column_index
    union all
    select count(*) filter (where not marked) from sq
      where row_index + column_index = p_card_size - 1
  )
  select case
    when p_mode = 'timed' then false

    when p_mode = 'blackout' then
      (select count(*) from sq where not marked) = 1

    when p_mode = 'double' then
      coalesce((
        select count(*) filter (where remaining = 0) = 1
           and count(*) filter (where remaining = 1) >= 1
        from lines
      ), false)

    when p_mode = 'four_corners' then
      (select count(*) from sq
        where (row_index = 0 or row_index = p_card_size - 1)
          and (column_index = 0 or column_index = p_card_size - 1)
          and not marked) = 1

    else
      coalesce((select bool_or(remaining = 1) from lines), false)
  end;
$$;

revoke execute on function public.card_has_bingo(uuid, integer, text)
  from public, anon, authenticated;
revoke execute on function public.card_is_one_away(uuid, integer, text)
  from public, anon, authenticated;

-- create_room accepts 'timed' plus a duration.
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
  if p_game_mode not in ('classic','blackout','double','four_corners','points','timed') then
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

  perform public.generate_player_card(v_host_player_id, v_room_id, v_game.id,
                                      v_game.card_size, v_game.free_center);

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

/**
 * Ends a timed room once its clock has run out and settles the winner as the
 * highest score.
 *
 * Callable by anyone in the room, and also run by scheduled maintenance —
 * the game must end when the clock does even if every player has closed their
 * phone. Idempotent: the status check means a race between several clients
 * settles once.
 */
create or replace function public.finish_timed_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_winner uuid;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'room not found';
  end if;

  if v_room.game_mode <> 'timed'
     or v_room.status not in ('active', 'paused')
     or v_room.started_at is null
     or v_room.duration_seconds is null
     or now() < v_room.started_at + make_interval(secs => v_room.duration_seconds)
  then
    return jsonb_build_object('finished', false, 'status', v_room.status);
  end if;

  -- Highest score takes it; earliest to arrive breaks a tie, which rewards
  -- the player who was spotting for longer rather than an arbitrary pick.
  select p.id into v_winner
  from public.room_players p
  where p.room_id = p_room_id and p.status = 'active'
  order by p.score desc, p.joined_at
  limit 1;

  update public.rooms
     set status = 'completed',
         ended_at = now(),
         winner_player_id = coalesce(winner_player_id, v_winner)
   where id = p_room_id;

  if v_winner is not null then
    update public.room_players
       set has_bingo = true, bingo_at = coalesce(bingo_at, now())
     where id = v_winner and score > 0;

    insert into public.room_events (room_id, room_player_id, event_type, payload)
    select p_room_id, v_winner, 'bingo',
           jsonb_build_object('nickname', p.nickname, 'reason', 'time')
    from public.room_players p where p.id = v_winner and p.score > 0;
  end if;

  insert into public.room_events (room_id, event_type)
  values (p_room_id, 'game_completed');

  return jsonb_build_object('finished', true, 'winnerId', v_winner);
end;
$$;

grant execute on function public.finish_timed_room(uuid) to anon, authenticated;

-- Housekeeping settles rooms whose players all walked away.
create or replace function public.sweep_rooms(
  p_retention interval default '30 days'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timed integer := 0;
  v_expired integer;
  v_deleted integer;
  v_room record;
begin
  for v_room in
    select id from public.rooms
    where game_mode = 'timed'
      and status in ('active', 'paused')
      and started_at is not null
      and duration_seconds is not null
      and now() >= started_at + make_interval(secs => duration_seconds)
  loop
    perform public.finish_timed_room(v_room.id);
    v_timed := v_timed + 1;
  end loop;

  update public.rooms
     set status = 'expired', ended_at = coalesce(ended_at, now())
   where status in ('lobby', 'active', 'paused')
     and expires_at <= now();
  get diagnostics v_expired = row_count;

  delete from public.rooms
   where status in ('completed', 'expired')
     and coalesce(ended_at, updated_at, created_at) < now() - p_retention;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'timedFinished', v_timed,
    'markedExpired', v_expired,
    'deleted', v_deleted,
    'sweptAt', now()
  );
end;
$$;

revoke execute on function public.sweep_rooms(interval) from public, anon, authenticated;
grant execute on function public.sweep_rooms(interval) to service_role;
