-- SPOT — authoritative marking and bingo detection (PRD §23, §24, §25, §50)
--
-- One atomic operation does everything: authenticate the player, verify the
-- room is active and the card is theirs, toggle, recount, detect bingo, record
-- the event, and settle the winner. The client never determines official state
-- (§24) and never performs these as separate steps (§23).

/**
 * Mirrors lib/game/bingo.ts. Classic wins on any complete row, column, or
 * diagonal; blackout needs every position. FREE counts because it is stored
 * already marked.
 */
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
  )
  select case
    when p_mode = 'blackout' then coalesce((select bool_and(marked) from sq), false)
    else coalesce((
      select bool_or(complete) from (
        select bool_and(marked) as complete from sq group by row_index
        union all
        select bool_and(marked) from sq group by column_index
        union all
        select bool_and(marked) from sq where row_index = column_index
        union all
        select bool_and(marked) from sq where row_index + column_index = p_card_size - 1
      ) lines
    ), false)
  end;
$$;

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

  -- Lock the player row: two rapid taps must not interleave a recount.
  select * into v_player
  from public.room_players
  where id = v_card.room_player_id
  for update;

  -- The caller must BE this player. A different player's token resolves to a
  -- different row, so marking someone else's card is impossible.
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

  -- Score is always recomputed from stored state, never from client input (§50).
  select count(*) into v_score
  from public.player_card_squares s
  where s.player_card_id = v_card.id and s.marked and not s.is_free;

  v_bingo := public.card_has_bingo(v_card.id, v_card_size, v_room.game_mode);

  update public.room_players
     set score = v_score,
         marked_count = v_score,
         has_bingo = v_bingo,
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
    -- First writer wins: the null check and the write are one statement (§25).
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
    'isFirstWinner', v_is_first_winner,
    'roomCompleted', v_room_completed
  );
end;
$$;

grant execute on function public.toggle_square(uuid, text) to anon, authenticated;
revoke execute on function public.card_has_bingo(uuid, integer, text) from public, anon, authenticated;
