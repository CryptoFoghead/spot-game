-- PRD §51 activity feed and §91's "party/TV screen".
--
-- Both read from room_events, which has recorded everything since Phase 3 —
-- the data was already there, only the way to read it was missing.
--
-- On §32: the feed names what was spotted ("Mike spotted 'Matching family
-- shirts'"), exactly as §51 specifies. That is safe here because every card is
-- drawn from the same shared pool, so an individual observation says almost
-- nothing about which squares a given player holds — and knowing what other
-- people are finding is the point of playing together.

create or replace function public.get_room_activity(
  p_room_id uuid,
  p_token text,
  p_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_participant boolean;
begin
  -- Same access rule as the snapshot: participants and the host only.
  v_is_participant := public.is_room_host(p_room_id, p_token)
    or (select id from public.resolve_player(p_room_id, p_token)) is not null;

  if not v_is_participant then
    raise exception 'not a participant';
  end if;

  return coalesce((
    select jsonb_agg(entry order by (entry->>'at') desc)
    from (
      select jsonb_build_object(
               'id', e.id,
               'type', e.event_type,
               'nickname', p.nickname,
               'playerId', p.id,
               'text', e.payload->>'text',
               'at', e.created_at
             ) as entry
      from public.room_events e
      left join public.room_players p on p.id = e.room_player_id
      where e.room_id = p_room_id
        -- Unmarking is noise in a feed; nobody needs to watch a correction.
        and e.event_type in ('player_joined', 'square_marked', 'bingo',
                             'game_started', 'game_completed', 'player_removed')
      order by e.created_at desc
      limit p_limit
    ) recent
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_room_activity(uuid, text, integer) to anon, authenticated;

/**
 * Spectator view for a screen in the room (§91 "party/TV screen").
 *
 * Deliberately NOT gated on a guest token: the point is to cast it to a TV or
 * prop up a laptop where nobody has joined from. It therefore exposes only
 * what is already public to anyone in the room — the code, the game, scores
 * and what has been spotted. Never a card, never a token.
 */
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

  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.room_code,
    'status', v_room.status,
    'gameMode', v_room.game_mode,
    'gameTitle', v_title,
    'winnerPlayerId', v_room.winner_player_id,
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
