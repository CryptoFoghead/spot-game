-- The host plays too: PRD §80 requires that when a visitor starts a room and
-- one other person joins, BOTH receive cards. create_room previously created
-- the host's player row without a card, leaving the host with an empty board.

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
begin
  if p_host_token is null or length(p_host_token) < 20 then
    raise exception 'invalid host token';
  end if;
  if p_game_mode not in ('classic', 'blackout') then
    raise exception 'unsupported game mode';
  end if;

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
    (v_room_id, auth.uid(), public.hash_guest_token(p_host_token), v_nickname, 'host')
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
