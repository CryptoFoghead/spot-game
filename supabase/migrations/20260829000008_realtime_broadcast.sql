-- SPOT — realtime broadcast from the database (PRD §26)
--
-- Broadcasts are emitted by a trigger on room_events, so every message
-- originates inside the same transaction that changed authoritative state.
-- Clients therefore cannot forge events, and a message can never describe a
-- change that did not commit.
--
-- The payload is deliberately sanitized: it carries who/what-kind/score, never
-- square text or positions, so subscribers cannot reconstruct another player's
-- card by listening (§32). The database remains the source of truth — clients
-- treat these as "something changed, refetch" hints (§27, §29).

create or replace function public.broadcast_room_event()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_player public.room_players%rowtype;
  v_payload jsonb;
begin
  if new.room_player_id is not null then
    select * into v_player from public.room_players where id = new.room_player_id;
  end if;

  v_payload := jsonb_build_object(
    'type', upper(new.event_type),
    'roomId', new.room_id,
    'at', new.created_at
  );

  if v_player.id is not null then
    v_payload := v_payload || jsonb_build_object(
      'playerId', v_player.id,
      'nickname', v_player.nickname,
      'score', v_player.score,
      'markedCount', v_player.marked_count,
      'hasBingo', v_player.has_bingo
    );
  end if;

  perform realtime.send(
    v_payload,
    upper(new.event_type),
    'room:' || new.room_id::text,
    false -- public topic keyed by the room's UUID, which only participants hold
  );

  return new;
end;
$$;

drop trigger if exists room_events_broadcast on public.room_events;

create trigger room_events_broadcast
  after insert on public.room_events
  for each row execute function public.broadcast_room_event();
