-- Lets trusted server code (service role) run and inspect housekeeping, and
-- makes the pg_cron schedule observable — the scheduling migration degrades to
-- a no-op when the extension is unavailable, so "is it actually scheduled?"
-- must be answerable rather than assumed.

grant execute on function public.run_maintenance() to service_role;
grant execute on function public.sweep_rooms(interval) to service_role;
grant execute on function public.sweep_ai_usage(interval) to service_role;

create or replace function public.maintenance_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cron boolean := false;
  v_jobs jsonb := '[]'::jsonb;
  v_rooms_total integer;
  v_rooms_stale integer;
  v_ai_day integer;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_cron;

  if v_cron then
    begin
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', jobname, 'schedule', schedule, 'active', active
             )), '[]'::jsonb)
        into v_jobs
      from cron.job where jobname = 'spot-maintenance';
    exception when others then
      v_jobs := '[]'::jsonb;
    end;
  end if;

  select count(*) into v_rooms_total from public.rooms;
  select count(*) into v_rooms_stale
  from public.rooms
  where status in ('lobby', 'active', 'paused') and expires_at <= now();
  select count(*) into v_ai_day
  from public.ai_usage where created_at > now() - interval '1 day';

  return jsonb_build_object(
    'pgCronInstalled', v_cron,
    'scheduledJobs', v_jobs,
    'rooms', v_rooms_total,
    'roomsAwaitingExpiry', v_rooms_stale,
    'aiGenerationsLastDay', v_ai_day
  );
end;
$$;

revoke execute on function public.maintenance_status() from public, anon, authenticated;
grant execute on function public.maintenance_status() to service_role;
