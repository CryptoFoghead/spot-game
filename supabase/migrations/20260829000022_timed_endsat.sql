-- Surfaces the timed-mode deadline so clients can show a countdown.
--
-- endsAt is computed server-side from started_at + duration rather than sent
-- as a remaining-seconds number: a client with a skewed clock or a backgrounded
-- tab can then still work out the truth, and a refresh never resets the clock.

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
      'winnerPlayerId', v_room.winner_player_id,
      'durationSeconds', v_room.duration_seconds,
      'endsAt', v_ends_at
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

create or replace function public.get_room_spectator(p_room_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_title text;
  v_ends_at timestamptz;
begin
  select * into v_room
  from public.rooms
  where room_code = upper(btrim(p_room_code))
  order by (status in ('lobby', 'active', 'paused')) desc, created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  select title into v_title
  from public.game_templates where id = v_room.game_template_id;

  if v_room.game_mode = 'timed'
     and v_room.started_at is not null
     and v_room.duration_seconds is not null then
    v_ends_at := v_room.started_at + make_interval(secs => v_room.duration_seconds);
  end if;

  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.room_code,
    'status', v_room.status,
    'gameMode', v_room.game_mode,
    'gameTitle', v_title,
    'winnerPlayerId', v_room.winner_player_id,
    'endsAt', v_ends_at,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nickname', p.nickname, 'score', p.score,
               'hasBingo', p.has_bingo, 'isOneAway', p.is_one_away
             ) order by p.score desc, p.joined_at)
      from public.room_players p
      where p.room_id = v_room.id and p.status = 'active'
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(entry order by (entry->>'at') desc)
      from (
        select jsonb_build_object(
                 'id', e.id, 'type', e.event_type, 'nickname', p.nickname,
                 'text', e.payload->>'text', 'at', e.created_at
               ) as entry
        from public.room_events e
        left join public.room_players p on p.id = e.room_player_id
        where e.room_id = v_room.id
          and e.event_type in ('player_joined', 'square_marked', 'bingo',
                               'game_started', 'game_completed')
        order by e.created_at desc
        limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_room_spectator(text) to anon, authenticated;
