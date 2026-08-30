-- G-14: restore the "one square away" indicator (PRD §32), correctly.
--
-- The original was inferred from score (`score >= total - 1`), which is not
-- what one-away means and fired on empty cards. Being one square from bingo is
-- a property of the card's *lines*: some row, column or diagonal has exactly
-- one unmarked cell left.
--
-- Computed server-side and surfaced per player, so no client learns another
-- player's actual squares — only that they are close (§32).

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
    -- Each row, column and both diagonals, as a count of unmarked cells.
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
    else
      coalesce((select bool_or(remaining = 1) from lines), false)
  end;
$$;

revoke execute on function public.card_is_one_away(uuid, integer, text)
  from public, anon, authenticated;

-- Recomputed on every toggle alongside score and bingo, so the leaderboard can
-- show it without extra queries.
alter table public.room_players
  add column if not exists is_one_away boolean not null default false;

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

  select count(*) into v_score
  from public.player_card_squares s
  where s.player_card_id = v_card.id and s.marked and not s.is_free;

  v_bingo := public.card_has_bingo(v_card.id, v_card_size, v_room.game_mode);
  v_one_away := (not v_bingo)
    and public.card_is_one_away(v_card.id, v_card_size, v_room.game_mode);

  update public.room_players
     set score = v_score,
         marked_count = v_score,
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
    'hasBingo', v_bingo,
    'isOneAway', v_one_away,
    'isFirstWinner', v_is_first_winner,
    'roomCompleted', v_room_completed
  );
end;
$$;

grant execute on function public.toggle_square(uuid, text) to anon, authenticated;

-- Surface it in the snapshot the leaderboard renders from.
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
