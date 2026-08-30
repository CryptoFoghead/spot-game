-- G-22 groundwork: one place that answers "what is this account allowed to do".
--
-- There is nothing to buy yet and no payment processor wired up. This exists
-- now because the alternative is threading a tier check through every limit
-- later, and because it fixes something already wrong: the per-user AI limit
-- was supplied by the CALLER. Our own route passed the right number, so it was
-- never exploited, but a limit the caller chooses is not a limit. It is now
-- derived in the database from the account's tier.
--
-- Deliberately a separate table rather than a column on profiles: profiles are
-- publicly readable (see 0002), and who is paying is nobody else's business.
-- It is also the row a Stripe webhook would write one day, so it wants its own
-- lifecycle and its own audit columns.

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'supporter')),
  -- Where this came from: 'manual' today, 'stripe' later. Kept so a tier can
  -- always be traced back to a reason.
  source text not null default 'manual',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger user_entitlements_updated_at
  before update on public.user_entitlements
  for each row execute function public.set_updated_at();

alter table public.user_entitlements enable row level security;

-- You may read your own entitlement. Nobody may write one through the API:
-- granting a tier is a trusted path (a script today, a payment webhook later),
-- so it goes through the service role or a SECURITY DEFINER function.
create policy "own entitlement is readable"
  on public.user_entitlements for select
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- What each tier gets. Mirrored in lib/entitlements.ts, with a test that the
-- two agree — the same arrangement the bingo rules use.
-- ---------------------------------------------------------------------------

create or replace function public.ai_hourly_limit_for(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'supporter' then 60
    else 10
  end;
$$;

create or replace function public.tier_for(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select tier from public.user_entitlements
      where user_id = p_user_id
        and (expires_at is null or expires_at > now())
    ),
    'free'
  );
$$;

-- Internal: callers get their own entitlements through entitlements_for_me().
revoke execute on function public.tier_for(uuid) from public, anon, authenticated;
revoke execute on function public.ai_hourly_limit_for(text) from public, anon;

/** The signed-in caller's own entitlements, resolved server-side. */
create or replace function public.entitlements_for_me()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_tier text;
begin
  if v_user_id is null then
    return jsonb_build_object(
      'tier', 'free',
      'aiGenerationsPerHour', public.ai_hourly_limit_for('free'),
      'adFree', false
    );
  end if;

  v_tier := public.tier_for(v_user_id);

  return jsonb_build_object(
    'tier', v_tier,
    'aiGenerationsPerHour', public.ai_hourly_limit_for(v_tier),
    'adFree', v_tier <> 'free'
  );
end;
$$;

revoke execute on function public.entitlements_for_me() from public, anon;
grant execute on function public.entitlements_for_me() to authenticated;

-- ---------------------------------------------------------------------------
-- The limit now comes from the tier.
--
-- Same signature and the same parameter names, so this replaces the function
-- rather than overloading it. Adding a defaulted parameter here once created a
-- second function and made every existing five-argument call ambiguous, which
-- took the whole app down (BUG_LIST B-15) — worth remembering every time this
-- file is touched.
--
-- p_user_limit survives as an override that can only make the limit SMALLER.
-- Tests use it to exercise the ceiling in three calls instead of ten, and no
-- caller can raise its own allowance.
-- ---------------------------------------------------------------------------

create or replace function public.claim_ai_generation(
  p_user_limit integer default null,
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
  v_limit integer;
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

  v_limit := public.ai_hourly_limit_for(public.tier_for(v_user_id));
  if p_user_limit is not null then
    v_limit := least(v_limit, p_user_limit);
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_usage:' || v_user_id::text));

  select count(*), min(created_at) into v_used, v_oldest
  from public.ai_usage
  where user_id = v_user_id and created_at > now() - p_window;

  if v_used >= v_limit then
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
    'remaining', v_limit - v_used - 1,
    'retryAfterSeconds', 0
  );
end;
$$;

revoke execute on function public.claim_ai_generation(integer, interval, integer)
  from public, anon;
grant execute on function public.claim_ai_generation(integer, interval, integer)
  to authenticated;
