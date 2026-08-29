-- A session token stays cryptographically valid until it expires, so
-- auth.uid() can name a user row that no longer exists — after account
-- deletion (PRD §57 requires supporting that) or a database restore. The
-- room_players.user_id foreign key then rejects the insert and the person
-- simply cannot join or host, with no way to recover but clearing cookies.
--
-- Resolve the caller's id through auth.users so a stale token degrades to
-- anonymous guest identity, which every room path already supports, instead
-- of failing the whole operation.

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id from auth.users u where u.id = auth.uid();
$$;

revoke execute on function public.current_user_id() from public, anon, authenticated;

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
  if p_game_mode not in ('classic', 'blackout') then
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

create or replace function public.join_room(
  p_room_code text,
  p_nickname text,
  p_guest_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_game public.game_templates%rowtype;
  v_player_id uuid;
  v_nickname text;
  v_existing public.room_players%rowtype;
  v_user_id uuid := public.current_user_id();
begin
  if p_guest_token is null or length(p_guest_token) < 20 then
    raise exception 'invalid guest token';
  end if;

  v_nickname := btrim(regexp_replace(coalesce(p_nickname, ''), '[[:cntrl:]]', '', 'g'));
  if v_nickname = '' then
    raise exception 'nickname required';
  end if;
  if char_length(v_nickname) > 24 then
    v_nickname := left(v_nickname, 24);
  end if;

  select * into v_room
  from public.rooms
  where room_code = upper(btrim(p_room_code))
    and status in ('lobby', 'active', 'paused')
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'room not found';
  end if;
  if v_room.expires_at <= now() then
    raise exception 'room expired';
  end if;

  select * into v_existing
  from public.room_players
  where room_id = v_room.id
    and guest_token_hash = public.hash_guest_token(p_guest_token);

  if found then
    if v_existing.status = 'removed' then
      raise exception 'removed from room';
    end if;
    update public.room_players
       set status = 'active', last_seen_at = now(), nickname = v_nickname
     where id = v_existing.id;
    return jsonb_build_object(
      'roomId', v_room.id, 'playerId', v_existing.id, 'rejoined', true
    );
  end if;

  select * into v_game from public.game_templates where id = v_room.game_template_id;

  insert into public.room_players
    (room_id, user_id, guest_token_hash, nickname, role)
  values
    (v_room.id, v_user_id, public.hash_guest_token(p_guest_token), v_nickname, 'player')
  returning id into v_player_id;

  perform public.generate_player_card(v_player_id, v_room.id, v_game.id,
                                      v_game.card_size, v_game.free_center);

  insert into public.room_events (room_id, room_player_id, event_type, payload)
  values (v_room.id, v_player_id, 'player_joined',
          jsonb_build_object('nickname', v_nickname));

  return jsonb_build_object(
    'roomId', v_room.id, 'playerId', v_player_id, 'rejoined', false
  );
end;
$$;

-- resolve_player matches on auth.uid() only as a convenience for signed-in
-- users; a stale token simply won't match, which is already safe.

grant execute on function public.create_room(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.join_room(text, text, text) to anon, authenticated;
