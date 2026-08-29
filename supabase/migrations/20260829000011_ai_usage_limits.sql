-- G-02 / G-05: durable AI rate limiting and a global spend ceiling.
--
-- The previous limiter lived in process memory, so every serverless instance
-- had its own counter and the real ceiling was limit x instances. Usage is now
-- recorded in Postgres, which every instance shares.
--
-- Two independent limits:
--   * per user, per rolling window  — stops one creator hammering the endpoint
--   * global, per rolling day       — a cost guard on the API bill (§65)

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'generate_squares',
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_time_idx
  on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_time_idx
  on public.ai_usage (created_at desc);

-- Clients never touch this table directly; the claim function owns it.
alter table public.ai_usage enable row level security;

/**
 * Atomically claims one AI generation for the calling user, or refuses.
 *
 * A transaction-scoped advisory lock keyed on the user serialises concurrent
 * claims from that user, so two simultaneous requests cannot both pass the
 * check. The global cap is advisory rather than exact — it guards cost, and a
 * small overshoot under heavy concurrency is acceptable.
 */
create or replace function public.claim_ai_generation(
  p_user_limit integer default 10,
  p_window interval default '1 hour',
  p_global_daily_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_used integer;
  v_global integer;
  v_oldest timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object(
      'allowed', false, 'reason', 'unauthenticated', 'remaining', 0,
      'retryAfterSeconds', 0
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_usage:' || v_user_id::text));

  select count(*), min(created_at) into v_used, v_oldest
  from public.ai_usage
  where user_id = v_user_id and created_at > now() - p_window;

  if v_used >= p_user_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'user_limit',
      'remaining', 0,
      'retryAfterSeconds',
        greatest(1, ceil(extract(epoch from (v_oldest + p_window - now()))))
    );
  end if;

  select count(*) into v_global
  from public.ai_usage
  where created_at > now() - interval '1 day';

  if v_global >= p_global_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'global_limit',
      'remaining', 0,
      'retryAfterSeconds', 3600
    );
  end if;

  insert into public.ai_usage (user_id) values (v_user_id);

  return jsonb_build_object(
    'allowed', true,
    'reason', 'ok',
    'remaining', p_user_limit - v_used - 1,
    'retryAfterSeconds', 0
  );
end;
$$;

revoke execute on function public.claim_ai_generation(integer, interval, integer)
  from public, anon;
grant execute on function public.claim_ai_generation(integer, interval, integer)
  to authenticated;

/** Housekeeping: usage rows older than the widest window have no value. */
create or replace function public.sweep_ai_usage(p_retain interval default '7 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from public.ai_usage where created_at < now() - p_retain;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.sweep_ai_usage(interval) from public, anon, authenticated;
