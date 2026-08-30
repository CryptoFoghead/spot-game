-- G-21 / G-23: the remaining game modes (PRD §13).
--
-- The schema and the game_mode CHECK have allowed these since the first
-- migration; only create_room's validation and the win logic were limited to
-- classic and blackout. Modes added here:
--
--   double        two completed lines
--   four_corners  the four corner squares
--   points        sum of marked squares' point values decides the leaderboard;
--                 winning still requires a line, so a game can still end
--
-- `timed` and `endless` are room *lifecycle* variations rather than win
-- conditions, so they remain unimplemented rather than half-implemented.

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

    -- classic and points both win on any single line.
    else
      coalesce((select bool_or(complete) from lines), false)
  end;
$$;

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
    when p_mode = 'blackout' then
      (select count(*) from sq where not marked) = 1

    when p_mode = 'double' then
      -- One completed line already, and another line one square short.
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

-- Accept the new modes when creating a room.
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
  v_host_player_id uuid;
  v_nickname text;
  v_user_id uuid := public.current_user_id();
begin
  if p_host_token is null or length(p_host_token) < 20 then
    raise exception 'invalid host token';
  end if;
  if p_game_mode not in ('classic', 'blackout', 'double', 'four_corners', 'points') then
    raise exception 'unsupported game mode';
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
         continue_after_win, expires_at)
      values
        (v_game.id, v_user_id, v_code, p_game_mode,
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

grant execute on function public.create_room(uuid, text, text, text, boolean) to anon, authenticated;

-- Points mode scores by the squares' point values (§50); every other mode
-- counts marked squares. Score is still always derived from stored state.
create or replace function public.toggle_square(
  p_card_square_id uuid,
  p_guest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_square public.player_card_squares%rowtype;
  v_card public.player_cards%rowtype;
  v_player public.room_players%rowtype;
  v_room public.rooms%rowtype;
  v_card_size integer;
  v_new_marked boolean;
  v_marked_count integer;
  v_score integer;
  v_bingo boolean;
  v_one_away boolean;
  v_is_first_winner boolean := false;
  v_room_completed boolean := false;
begin
  select * into v_square
  from public.player_card_squares
  where id = p_card_square_id;
  if not found then
    raise exception 'square not found';
  end if;

  if v_square.is_free then
    raise exception 'the free square cannot be changed';
  end if;

  select * into v_card from public.player_cards where id = v_square.player_card_id;

  select * into v_player
  from public.room_players
  where id = v_card.room_player_id
  for update;

  if v_player.id is distinct from (
    select id from public.resolve_player(v_card.room_id, p_guest_token)
  ) then
    raise exception 'not your card';
  end if;

  if v_player.status <> 'active' then
    raise exception 'you are not active in this room';
  end if;

  select * into v_room from public.rooms where id = v_card.room_id;
  if v_room.status <> 'active' then
    raise exception 'room is not active';
  end if;

  select card_size into v_card_size
  from public.game_templates where id = v_room.game_template_id;

  v_new_marked := not v_square.marked;

  update public.player_card_squares
     set marked = v_new_marked,
         marked_at = case when v_new_marked then now() else null end
   where id = v_square.id;

  select count(*) into v_marked_count
  from public.player_card_squares s
  where s.player_card_id = v_card.id and s.marked and not s.is_free;

  if v_room.game_mode = 'points' then
    select coalesce(sum(coalesce(g.points, 1)), 0) into v_score
    from public.player_card_squares s
    left join public.game_squares g on g.id = s.game_square_id
    where s.player_card_id = v_card.id and s.marked and not s.is_free;
  else
    v_score := v_marked_count;
  end if;

  v_bingo := public.card_has_bingo(v_card.id, v_card_size, v_room.game_mode);
  v_one_away := (not v_bingo)
    and public.card_is_one_away(v_card.id, v_card_size, v_room.game_mode);

  update public.room_players
     set score = v_score,
         marked_count = v_marked_count,
         has_bingo = v_bingo,
         is_one_away = v_one_away,
         bingo_at = case
                      when v_bingo and bingo_at is null then now()
                      when not v_bingo then null
                      else bingo_at
                    end,
         last_seen_at = now()
   where id = v_player.id;

  insert into public.room_events (room_id, room_player_id, event_type, payload)
  values (
    v_room.id, v_player.id,
    case when v_new_marked then 'square_marked' else 'square_unmarked' end,
    jsonb_build_object('position', v_square.position, 'text', v_square.display_text)
  );

  if v_bingo then
    update public.rooms
       set winner_player_id = v_player.id
     where id = v_room.id and winner_player_id is null;
    v_is_first_winner := found;

    if v_is_first_winner then
      insert into public.room_events (room_id, room_player_id, event_type, payload)
      values (v_room.id, v_player.id, 'bingo',
              jsonb_build_object('nickname', v_player.nickname));

      if not v_room.continue_after_win then
        update public.rooms
           set status = 'completed', ended_at = now()
         where id = v_room.id;
        insert into public.room_events (room_id, event_type)
        values (v_room.id, 'game_completed');
        v_room_completed := true;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'squareId', v_square.id,
    'marked', v_new_marked,
    'score', v_score,
    'markedCount', v_marked_count,
    'hasBingo', v_bingo,
    'isOneAway', v_one_away,
    'isFirstWinner', v_is_first_winner,
    'roomCompleted', v_room_completed
  );
end;
$$;

grant execute on function public.toggle_square(uuid, text) to anon, authenticated;
