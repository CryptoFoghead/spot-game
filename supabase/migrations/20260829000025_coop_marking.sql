-- Marking and reading a shared card.
--
-- The authorisation rule changes shape in co-op: on a personal card the caller
-- must BE the owner, but a shared card has no owner, so the caller must be an
-- active player in that room. Both are still resolved from the guest token —
-- no client ever asserts who it is.

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
  v_shared boolean;
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
  v_shared := v_card.room_player_id is null;

  select * into v_room from public.rooms where id = v_card.room_id;
  if v_room.status <> 'active' then
    raise exception 'room is not active';
  end if;

  -- Who is asking, resolved from the token either way.
  select * into v_player from public.resolve_player(v_card.room_id, p_guest_token);
  if v_player.id is null then
    raise exception 'not your card';
  end if;

  if not v_shared then
    -- Personal card: the caller must own it.
    if v_card.room_player_id is distinct from v_player.id then
      raise exception 'not your card';
    end if;
  end if;

  -- Serialise concurrent marks on the same card. Two people sharing one card
  -- WILL tap at the same moment; the lock is on the card, not the player.
  perform pg_advisory_xact_lock(hashtext('card:' || v_card.id::text));

  if v_player.status <> 'active' then
    raise exception 'you are not active in this room';
  end if;

  select card_size into v_card_size
  from public.game_templates where id = v_room.game_template_id;

  -- Re-read after the lock: someone else may have just marked this square.
  select * into v_square
  from public.player_card_squares where id = p_card_square_id;

  v_new_marked := not v_square.marked;

  update public.player_card_squares
     set marked = v_new_marked,
         marked_at = case when v_new_marked then now() else null end,
         marked_by = case when v_new_marked then v_player.id else null end
   where id = v_square.id;

  v_bingo := public.card_has_bingo(v_card.id, v_card_size, v_room.game_mode);
  v_one_away := (not v_bingo)
    and public.card_is_one_away(v_card.id, v_card_size, v_room.game_mode);

  if v_shared then
    -- Everyone's score is what they personally spotted on the shared card, so
    -- "you found more of them" survives without anyone owning the board.
    update public.room_players p
       set score = (
             select count(*) from public.player_card_squares s
             where s.player_card_id = v_card.id
               and s.marked and not s.is_free and s.marked_by = p.id
           ),
           marked_count = (
             select count(*) from public.player_card_squares s
             where s.player_card_id = v_card.id
               and s.marked and not s.is_free and s.marked_by = p.id
           ),
           -- A shared card completing is a win for the room, not one person.
           has_bingo = v_bingo,
           is_one_away = v_one_away,
           bingo_at = case when v_bingo and p.bingo_at is null then now()
                           when not v_bingo then null else p.bingo_at end,
           last_seen_at = case when p.id = v_player.id then now() else p.last_seen_at end
     where p.room_id = v_room.id and p.status = 'active';

    select score into v_score from public.room_players where id = v_player.id;
    v_marked_count := v_score;
  else
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
  end if;

  insert into public.room_events (room_id, room_player_id, event_type, payload)
  values (
    v_room.id, v_player.id,
    case when v_new_marked then 'square_marked' else 'square_unmarked' end,
    jsonb_build_object('position', v_square.position, 'text', v_square.display_text)
  );

  if v_bingo then
    -- In co-op the room wins; crediting whoever called the last square is a
    -- nicer record than picking arbitrarily.
    update public.rooms
       set winner_player_id = v_player.id
     where id = v_room.id and winner_player_id is null;
    v_is_first_winner := found;

    if v_is_first_winner then
      insert into public.room_events (room_id, room_player_id, event_type, payload)
      values (v_room.id, v_player.id, 'bingo',
              jsonb_build_object('nickname', v_player.nickname,
                                 'shared', v_shared));

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
    'roomCompleted', v_room_completed,
    'shared', v_shared
  );
end;
$$;

grant execute on function public.toggle_square(uuid, text) to anon, authenticated;

-- The snapshot serves the shared card to everyone in a co-op room.
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
  v_title text;
  v_ends_at timestamptz;
  v_card_id uuid;
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

  select title into v_title
  from public.game_templates where id = v_room.game_template_id;

  if v_room.game_mode = 'timed'
     and v_room.started_at is not null
     and v_room.duration_seconds is not null then
    v_ends_at := v_room.started_at + make_interval(secs => v_room.duration_seconds);
  end if;

  if v_room.game_mode = 'coop' then
    select id into v_card_id from public.player_cards
    where room_id = p_room_id and room_player_id is null;
  else
    select id into v_card_id from public.player_cards
    where room_player_id = v_me.id;
  end if;

  select jsonb_agg(jsonb_build_object(
           'id', s.id, 'position', s.position, 'text', s.display_text,
           'isFree', s.is_free, 'marked', s.marked,
           'markedBy', s.marked_by
         ) order by s.position)
    into v_card
  from public.player_card_squares s
  where s.player_card_id = v_card_id;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'code', v_room.room_code, 'status', v_room.status,
      'gameMode', v_room.game_mode, 'continueAfterWin', v_room.continue_after_win,
      'winnerPlayerId', v_room.winner_player_id,
      'durationSeconds', v_room.duration_seconds,
      'endsAt', v_ends_at,
      'sharedCard', v_room.game_mode = 'coop'
    ),
    'gameTitle', v_title,
    'isHost', v_is_host,
    'me', case when v_me.id is null then null else jsonb_build_object(
      'id', v_me.id, 'nickname', v_me.nickname, 'role', v_me.role,
      'score', v_me.score, 'hasBingo', v_me.has_bingo,
      'isOneAway', v_me.is_one_away
    ) end,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nickname', p.nickname, 'role', p.role,
               'score', p.score, 'markedCount', p.marked_count,
               'hasBingo', p.has_bingo, 'isOneAway', p.is_one_away
             ) order by p.score desc, p.joined_at)
      from public.room_players p
      where p.room_id = p_room_id and p.status = 'active'
    ), '[]'::jsonb),
    'card', coalesce(v_card, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_room_snapshot(uuid, text) to anon, authenticated;
