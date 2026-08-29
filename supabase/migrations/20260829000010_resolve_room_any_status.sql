-- Room pages resolved the room through get_join_info, which only matches
-- joinable rooms (lobby/active/paused). The moment a host ended a game, the
-- room became unreachable and everyone still on the page — including the host
-- who just ended it — got the 404 screen. The "This game has ended" state
-- (PRD §64) was therefore unreachable.
--
-- get_join_info keeps its filter: you genuinely should not be able to JOIN a
-- completed room. Participants viewing a room they already belong to need a
-- resolver that does not filter by status.

create or replace function public.resolve_room_id(p_room_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.rooms r
  where r.room_code = upper(btrim(p_room_code))
  -- Codes are reused once a room is no longer reachable, so prefer a live
  -- room over an older completed one that shared the code.
  order by (r.status in ('lobby', 'active', 'paused')) desc, r.created_at desc
  limit 1;
$$;

-- Returning an id grants nothing on its own: get_room_snapshot still requires
-- the caller to be a participant or the host.
grant execute on function public.resolve_room_id(text) to anon, authenticated;

-- Carry the game title in the snapshot so room pages no longer need a second
-- lookup just for their heading.
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
    'gameTitle', v_title,
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

grant execute on function public.get_room_snapshot(uuid, text) to anon, authenticated;
