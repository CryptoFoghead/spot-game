-- G-04: enforce room expiry and retention.
--
-- Rooms carried an expires_at that join_room checked, but nothing ever marked
-- a room expired or removed it. The table grew without bound, resolve_room_id
-- kept matching stale rooms, and PRD §57's retention policy had no teeth.
--
-- Deleting a room cascades to its players, cards, card squares and events.

create or replace function public.sweep_rooms(
  p_retention interval default '30 days'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer;
  v_deleted integer;
begin
  -- Reachable rooms past their expiry become terminal.
  update public.rooms
     set status = 'expired', ended_at = coalesce(ended_at, now())
   where status in ('lobby', 'active', 'paused')
     and expires_at <= now();
  get diagnostics v_expired = row_count;

  -- Terminal rooms past retention are removed entirely (§57).
  delete from public.rooms
   where status in ('completed', 'expired')
     and coalesce(ended_at, updated_at, created_at) < now() - p_retention;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'markedExpired', v_expired,
    'deleted', v_deleted,
    'sweptAt', now()
  );
end;
$$;

-- Housekeeping only: never callable from a browser.
revoke execute on function public.sweep_rooms(interval) from public, anon, authenticated;

/** One entry point so a single scheduled call does all housekeeping. */
create or replace function public.run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rooms jsonb;
  v_usage integer;
begin
  v_rooms := public.sweep_rooms();
  v_usage := public.sweep_ai_usage();
  return v_rooms || jsonb_build_object('aiUsageDeleted', v_usage);
end;
$$;

revoke execute on function public.run_maintenance() from public, anon, authenticated;
