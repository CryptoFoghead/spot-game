-- Step two of the platform-schema migration (see 20260908000001's header
-- for the full reasoning). This is the one that actually changes behavior:
-- tier_for() now reads from platform.entitlements instead of
-- public.user_entitlements. Same signature, so ai_hourly_limit_for(),
-- entitlements_for_me() and claim_ai_generation() — which all call
-- tier_for() rather than touching user_entitlements directly — need no
-- changes of their own at all; they inherit the new behavior automatically.
-- app/api/ai/generate-squares/route.ts and lib/ai/rate-limit.ts call these
-- functions by name only, so nothing in the application changes either.
--
-- Deliberately a separate migration from the additive copy step: if
-- anything here is wrong, public.user_entitlements is still sitting there
-- untouched, and reverting is a single CREATE OR REPLACE back to the
-- previous body, not a data recovery problem.
create or replace function public.tier_for(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select tier from platform.entitlements
      where app = 'spot' and owner_type = 'user' and owner_id = p_user_id
        and entitlement_type = 'tier'
        and (expires_at is null or expires_at > now())
      order by created_at desc
      limit 1
    ),
    'free'
  );
$$;

-- ---------------------------------------------------------------------------
-- scripts/set-tier.js can't reach platform.* directly — platform is
-- deliberately never added to Supabase's Exposed Schemas, so no client key
-- (service role included) can query or RPC into it through PostgREST. These
-- two wrappers, living in public like every other RPC this script's own
-- key is already trusted to call, are the door — same shape as every
-- couples.*-wrapping-platform.* function in the sibling repo.
-- ---------------------------------------------------------------------------
create or replace function public.admin_grant_tier(
  p_user_id uuid, p_tier text, p_expires_at timestamptz default null
)
returns void
language sql
security definer
set search_path = public, platform
as $$
  select platform.grant_entitlement(
    p_app => 'spot',
    p_owner_type => 'user',
    p_owner_id => p_user_id,
    p_entitlement_type => 'tier',
    p_expires_at => p_expires_at,
    p_source => 'manual',
    p_tier => p_tier
  );
$$;

create or replace function public.admin_expire_tier(p_user_id uuid)
returns void
language sql
security definer
set search_path = public, platform
as $$
  select platform.expire_entitlements('spot', 'user', p_user_id, 'tier');
$$;

revoke all on function public.admin_grant_tier(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.admin_expire_tier(uuid) from public, anon, authenticated;
grant execute on function public.admin_grant_tier(uuid, text, timestamptz) to service_role;
grant execute on function public.admin_expire_tier(uuid) to service_role;
