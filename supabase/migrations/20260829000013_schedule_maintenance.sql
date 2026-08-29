-- Schedules run_maintenance() hourly inside the database, so housekeeping does
-- not depend on the app being deployed, on Vercel cron limits, or on anyone
-- remembering to run it.
--
-- If pg_cron is unavailable, this migration degrades to a no-op rather than
-- failing the deploy; the /api/maintenance route remains as a manual trigger.

do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable (%), skipping schedule', sqlerrm;
  return;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Replace any existing schedule so re-running is safe.
    perform cron.unschedule(jobid)
    from cron.job where jobname = 'spot-maintenance';

    perform cron.schedule(
      'spot-maintenance',
      '17 * * * *', -- hourly, off the hour to avoid the busy minute
      $cron$select public.run_maintenance()$cron$
    );
    raise notice 'scheduled spot-maintenance hourly';
  end if;
exception when others then
  raise notice 'could not schedule maintenance (%)', sqlerrm;
end;
$$;
