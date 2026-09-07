-- A new schema neither app owns: `platform`. Couples Bingo (a sibling app in
-- this same Supabase project — see couples-game/docs/SHARED_BACKEND.md)
-- needs a genuinely richer entitlement model than SPOT's own (occasion-based
-- purchases: Tonight Pass, Lifetime Couple, gift, session credits — not a
-- subscription tier). Rather than building that app-private and leaving
-- SPOT on its separate `public.user_entitlements`, both now share one
-- entitlement system, decided explicitly rather than left as G-10 forever.
--
-- This migration is step one of two, and it is DELIBERATELY additive only:
-- it creates the new schema and copies existing entitlement data into it,
-- but does not touch `public.user_entitlements` or any of the functions
-- that read it (`tier_for`, `ai_hourly_limit_for`, `entitlements_for_me`,
-- `claim_ai_generation`). SPOT's running app has zero behavior change from
-- this migration alone. The repoint — making those functions actually read
-- from `platform.entitlements` instead — is a separate migration
-- (20260908000002_platform_repoint.sql), so a mistake in the copy/shape
-- decision here is not simultaneously a live-behavior risk. Confirmed via
-- direct query before writing this: `public.user_entitlements` currently
-- has 0 rows, so the copy step below is a no-op today, kept for
-- correctness in any environment where that isn't true.
--
-- `platform.*` tables stay deny-all, same reasoning as every guest-facing
-- table in both apps: no grant to anon/authenticated/service_role, ever.
-- They are reachable only through SECURITY DEFINER wrapper functions that
-- live in EACH APP'S OWN schema (public.* here, couples.* in the sibling
-- repo) — never called directly by client code, and `platform` itself is
-- never added to Supabase's Exposed Schemas API setting. This works because
-- a SECURITY DEFINER function's privilege escalation is schema-agnostic: it
-- runs with its OWNER's rights for its entire call stack, in any schema,
-- the same mechanism this project's own AGENTS-equivalent notes already
-- rely on for every couples.* / public.* RPC. The one precondition —
-- confirmed before writing this file — is that SPOT's `supabase db push
-- --linked` and Couples Bingo's direct SUPABASE_DB_URL connection resolve
-- to the SAME underlying `postgres` role (they do: one Supabase project has
-- exactly one `postgres` role regardless of connection method).

create schema if not exists platform;

create extension if not exists pgcrypto with schema extensions;

create or replace function platform.hash_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Product catalog (DESIGN §38.19 in the couples-game repo): pricing is data,
-- not code, from day one, for every app that uses this schema.
-- ---------------------------------------------------------------------------
create table platform.products (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  slug text not null,
  name text not null,
  product_type text not null
    check (product_type in ('tonight_pass', 'lifetime', 'weekend_pass', 'session_credit_pack', 'pack', 'tier')),
  price_minor int not null check (price_minor >= 0),
  currency text not null default 'usd',
  duration_hours int,
  session_credits int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app, slug)
);

-- ---------------------------------------------------------------------------
-- Guest profiles: a durable, pre-signup identity an entitlement or purchase
-- can be owned by. Neither app has one today — SPOT has anonymous auth
-- disabled entirely, and Couples Bingo's own guest token (lib/guest.ts) is
-- deliberately scoped to one room/session, not designed to survive across
-- sessions. This table is what makes DESIGN §38.26's "guest purchases can
-- later attach to an account" and "first free session, once, before
-- signup" possible without inventing per-app identity schemes twice.
-- ---------------------------------------------------------------------------
create table platform.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  token_hash text not null unique,
  claimed_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Purchases: payment records. Never stores raw card information — provider
-- and provider_transaction_id are the only link to whatever processor was
-- actually used (DESIGN §38.15: business logic never depends on which one).
-- ---------------------------------------------------------------------------
create table platform.purchases (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  purchaser_user_id uuid references auth.users (id) on delete set null,
  purchaser_guest_profile_id uuid references platform.guest_profiles (id) on delete set null,
  provider text not null,
  provider_transaction_id text,
  product_id uuid not null references platform.products (id),
  amount_minor int not null check (amount_minor >= 0),
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'refunded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_purchaser check (num_nonnulls(purchaser_user_id, purchaser_guest_profile_id) = 1)
);

-- ---------------------------------------------------------------------------
-- Entitlements: what an owner currently has. APPEND-ONLY on purpose — a new
-- grant supersedes rather than overwrites (see grant_entitlement below), so
-- "current" is always resolved by query (latest non-expired, lifetime-first
-- row), never by row identity. This sidesteps needing a partial unique
-- index + an ON CONFLICT predicate that matches it exactly (a real footgun
-- documented elsewhere in this project's history) and matches how
-- occasion-based purchases naturally work anyway: a couple can have several
-- historical Tonight Pass purchases, only the current one active.
-- ---------------------------------------------------------------------------
create table platform.entitlements (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  owner_type text not null check (owner_type in ('user', 'couple', 'session', 'guest_profile')),
  owner_id uuid not null,
  entitlement_type text not null,
  product_id uuid references platform.products (id),
  -- SPOT-specific: 'free' | 'supporter'. Null for every couples-game
  -- entitlement type. Keeping it as its own column rather than overloading
  -- entitlement_type preserves SPOT's exact existing tier vocabulary.
  tier text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  remaining_uses int,
  source text not null default 'manual'
    check (source in ('free', 'purchase', 'gift', 'promo', 'admin', 'manual', 'stripe')),
  purchase_id uuid references platform.purchases (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entitlements_owner_idx on platform.entitlements (app, owner_type, owner_id);

-- ---------------------------------------------------------------------------
-- Deny-all. Every one of these tables is reachable only through a
-- SECURITY DEFINER wrapper in an app's own schema.
-- ---------------------------------------------------------------------------
alter table platform.products enable row level security;
alter table platform.guest_profiles enable row level security;
alter table platform.purchases enable row level security;
alter table platform.entitlements enable row level security;

revoke all on platform.products from public, anon, authenticated, service_role;
revoke all on platform.guest_profiles from public, anon, authenticated, service_role;
revoke all on platform.purchases from public, anon, authenticated, service_role;
revoke all on platform.entitlements from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Internal functions. Called by each app's own wrapper RPCs, never by
-- client code directly.
-- ---------------------------------------------------------------------------

create or replace function platform.get_effective_entitlement(
  p_app text, p_owner_type text, p_owner_id uuid
)
returns platform.entitlements
language sql
stable
as $$
  select *
  from platform.entitlements
  where app = p_app and owner_type = p_owner_type and owner_id = p_owner_id
    and (expires_at is null or expires_at > now())
  order by (expires_at is null) desc, expires_at desc nulls first, created_at desc
  limit 1;
$$;

create or replace function platform.grant_entitlement(
  p_app text,
  p_owner_type text,
  p_owner_id uuid,
  p_entitlement_type text,
  p_product_id uuid default null,
  p_starts_at timestamptz default now(),
  p_expires_at timestamptz default null,
  p_source text default 'manual',
  p_purchase_id uuid default null,
  p_tier text default null,
  p_remaining_uses int default null
)
returns platform.entitlements
language plpgsql
as $$
declare
  v_row platform.entitlements;
begin
  if p_owner_type not in ('user', 'couple', 'session', 'guest_profile') then
    raise exception 'invalid owner_type';
  end if;

  -- A tier is a single current fact about an owner, not a history of
  -- simultaneously-active grants — expire whatever tier row is active
  -- before inserting the new one, so get_effective_entitlement always
  -- resolves to exactly one.
  if p_entitlement_type = 'tier' then
    update platform.entitlements
       set expires_at = now(), updated_at = now()
     where app = p_app and owner_type = p_owner_type and owner_id = p_owner_id
       and entitlement_type = 'tier'
       and (expires_at is null or expires_at > now());
  end if;

  insert into platform.entitlements (
    app, owner_type, owner_id, entitlement_type, product_id, tier,
    starts_at, expires_at, remaining_uses, source, purchase_id
  ) values (
    p_app, p_owner_type, p_owner_id, p_entitlement_type, p_product_id, p_tier,
    p_starts_at, p_expires_at, p_remaining_uses, p_source, p_purchase_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function platform.record_purchase(
  p_app text,
  p_purchaser_user_id uuid,
  p_purchaser_guest_profile_id uuid,
  p_provider text,
  p_provider_transaction_id text,
  p_product_id uuid,
  p_amount_minor int,
  p_currency text default 'usd',
  p_status text default 'pending'
)
returns platform.purchases
language plpgsql
as $$
declare
  v_row platform.purchases;
begin
  insert into platform.purchases (
    app, purchaser_user_id, purchaser_guest_profile_id, provider,
    provider_transaction_id, product_id, amount_minor, currency, status
  ) values (
    p_app, p_purchaser_user_id, p_purchaser_guest_profile_id, p_provider,
    p_provider_transaction_id, p_product_id, p_amount_minor, p_currency, p_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function platform.get_or_create_guest_profile(
  p_app text, p_token_hash text
)
returns platform.guest_profiles
language plpgsql
as $$
declare
  v_row platform.guest_profiles;
begin
  select * into v_row from platform.guest_profiles where token_hash = p_token_hash;
  if found then
    return v_row;
  end if;

  insert into platform.guest_profiles (app, token_hash)
  values (p_app, p_token_hash)
  on conflict (token_hash) do update set token_hash = excluded.token_hash
  returning * into v_row;

  return v_row;
end;
$$;

-- Reassigns a guest's entitlement history once they sign up for a real
-- account (DESIGN §38.26 "guest purchases can later attach to an account").
create or replace function platform.claim_guest_profile(
  p_token_hash text, p_user_id uuid
)
returns void
language plpgsql
as $$
begin
  update platform.guest_profiles
     set claimed_by_user_id = p_user_id
   where token_hash = p_token_hash and claimed_by_user_id is null;
end;
$$;

-- Resets an owner to having no active entitlement of one type, without
-- inserting a replacement row — the append-only counterpart to
-- grant_entitlement's own supersede-on-grant behavior, for the case where
-- there is nothing to supersede WITH (e.g. "clear this person's tier").
create or replace function platform.expire_entitlements(
  p_app text, p_owner_type text, p_owner_id uuid, p_entitlement_type text
)
returns void
language sql
as $$
  update platform.entitlements
     set expires_at = now(), updated_at = now()
   where app = p_app and owner_type = p_owner_type and owner_id = p_owner_id
     and entitlement_type = p_entitlement_type
     and (expires_at is null or expires_at > now());
$$;

-- Functions default to PUBLIC execute in Postgres (unlike table grants,
-- which default to owner-only) — revoke explicitly rather than relying on
-- nothing having granted it yet.
revoke execute on all functions in schema platform from public;

-- ---------------------------------------------------------------------------
-- Copy step: existing public.user_entitlements rows, as-is, into the new
-- shape. Additive only — public.user_entitlements and every function that
-- reads it are untouched by this migration. (0 rows today, confirmed live
-- before writing this; kept for correctness in any environment where
-- that's no longer true.)
-- ---------------------------------------------------------------------------
insert into platform.entitlements (app, owner_type, owner_id, entitlement_type, tier, source, created_at)
select 'spot', 'user', user_id, 'tier', tier, source, granted_at
from public.user_entitlements;
