-- G-09: product metrics (PRD §58, §92).
--
-- No third-party tracker and no client-side events: room_events already
-- records what actually happened, server-side, inside the transactions that
-- changed state. That is a more trustworthy source than browser beacons, which
-- are lost to ad blockers and dropped connections.
--
-- The north-star metric (§92) is completed multiplayer rooms per week, with
-- players per completed room as support.

create or replace function public.product_metrics(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => p_days);
  v_rooms_created integer;
  v_rooms_started integer;
  v_rooms_with_bingo integer;
  v_rooms_completed integer;
  v_multiplayer_completed integer;
  v_players_joined integer;
  v_squares_marked integer;
  v_avg_players numeric;
  v_games_created integer;
  v_ai_generations integer;
begin
  select count(distinct room_id) into v_rooms_created
  from public.room_events
  where created_at >= v_since and event_type = 'player_joined';

  select count(distinct room_id) into v_rooms_started
  from public.room_events
  where created_at >= v_since and event_type = 'game_started';

  select count(distinct room_id) into v_rooms_with_bingo
  from public.room_events
  where created_at >= v_since and event_type = 'bingo';

  select count(distinct room_id) into v_rooms_completed
  from public.room_events
  where created_at >= v_since and event_type = 'game_completed';

  -- The metric that matters: rooms that actually had more than one person.
  with joins as (
    select room_id, count(*) filter (where event_type = 'player_joined') as players
    from public.room_events
    where created_at >= v_since
    group by room_id
  ),
  completed as (
    select distinct room_id from public.room_events
    where created_at >= v_since and event_type in ('game_completed', 'bingo')
  )
  select count(*), coalesce(avg(j.players), 0)
    into v_multiplayer_completed, v_avg_players
  from joins j join completed c on c.room_id = j.room_id
  where j.players > 1;

  select count(*) into v_players_joined
  from public.room_events
  where created_at >= v_since and event_type = 'player_joined';

  select count(*) into v_squares_marked
  from public.room_events
  where created_at >= v_since and event_type = 'square_marked';

  select count(*) into v_games_created
  from public.game_templates
  where created_at >= v_since and creator_id is not null;

  select count(*) into v_ai_generations
  from public.ai_usage where created_at >= v_since;

  return jsonb_build_object(
    'windowDays', p_days,
    'since', v_since,
    'northStar', jsonb_build_object(
      'completedMultiplayerRooms', v_multiplayer_completed,
      'averagePlayersPerCompletedRoom', round(v_avg_players, 2)
    ),
    'funnel', jsonb_build_object(
      'roomsCreated', v_rooms_created,
      'roomsStarted', v_rooms_started,
      'roomsReachingBingo', v_rooms_with_bingo,
      'roomsCompleted', v_rooms_completed,
      'startRate', case when v_rooms_created = 0 then 0
                        else round(v_rooms_started::numeric / v_rooms_created, 2) end,
      'bingoRate', case when v_rooms_started = 0 then 0
                        else round(v_rooms_with_bingo::numeric / v_rooms_started, 2) end
    ),
    'activity', jsonb_build_object(
      'playersJoined', v_players_joined,
      'squaresMarked', v_squares_marked,
      'gamesCreated', v_games_created,
      'aiGenerations', v_ai_generations
    )
  );
end;
$$;

-- Metrics are operator-facing, never public.
revoke execute on function public.product_metrics(integer) from public, anon, authenticated;
grant execute on function public.product_metrics(integer) to service_role;

/** Most-played games in the window, for the Explore "trending" section (G-16). */
create or replace function public.trending_games(
  p_days integer default 7,
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select r.game_template_id, count(distinct e.room_id) as rooms
    from public.room_events e
    join public.rooms r on r.id = e.room_id
    where e.created_at >= now() - make_interval(days => p_days)
      and e.event_type = 'player_joined'
    group by r.game_template_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', g.slug, 'title', g.title, 'rooms', recent.rooms
         ) order by recent.rooms desc), '[]'::jsonb)
  from recent
  join public.game_templates g on g.id = recent.game_template_id
  where g.visibility = 'public' and g.status = 'published'
  limit p_limit;
$$;

grant execute on function public.trending_games(integer, integer) to anon, authenticated;
