/**
 * Grants or clears an account's tier.
 *
 *   node scripts/set-tier.js someone@example.com supporter
 *   node scripts/set-tier.js someone@example.com supporter --days 30
 *   node scripts/set-tier.js someone@example.com free
 *
 * There is no checkout yet (G-22), so this is how a supporter is made today —
 * comping a friend, thanking a play-tester. It calls admin_grant_tier /
 * admin_expire_tier (both service-role-only RPCs) rather than writing to a
 * table directly: entitlements now live in the shared platform schema
 * (platform.entitlements, since 20260908000001_platform_schema.sql), which
 * is deliberately never exposed to PostgREST at all — not even the service
 * role can reach it with a .from() call. admin_grant_tier/admin_expire_tier
 * are SECURITY DEFINER wrappers in public, the same shape every other
 * platform-reaching function in this project uses.
 */
require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const TIERS = ["free", "supporter"];

async function main() {
  const [email, tier, ...rest] = process.argv.slice(2);

  if (!email || !tier) {
    console.error("usage: node scripts/set-tier.js <email> <free|supporter> [--days N]");
    process.exit(1);
  }
  if (!TIERS.includes(tier)) {
    console.error(`tier must be one of: ${TIERS.join(", ")}`);
    process.exit(1);
  }

  const daysFlag = rest.indexOf("--days");
  const days = daysFlag === -1 ? null : Number(rest[daysFlag + 1]);
  if (daysFlag !== -1 && (!Number.isFinite(days) || days <= 0)) {
    console.error("--days needs a positive number");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // There is no admin lookup-by-email, so page through until we find them.
  let user = null;
  for (let page = 1; page <= 20 && !user; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`could not list users: ${error.message}`);
      process.exit(1);
    }
    if (!data.users.length) break;
    user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );
  }

  if (!user) {
    console.error(`no account found for ${email}`);
    process.exit(1);
  }

  // 'free' is the absence of an active tier entitlement, not a row saying
  // free — entitlements are append-only now, so "clearing" a tier means
  // expiring whatever's currently active, not deleting a row.
  if (tier === "free") {
    const { error } = await admin.rpc("admin_expire_tier", { p_user_id: user.id });
    if (error) {
      console.error(`could not clear tier: ${error.message}`);
      process.exit(1);
    }
    console.log(`${email} is now free`);
    return;
  }

  const { error } = await admin.rpc("admin_grant_tier", {
    p_user_id: user.id,
    p_tier: tier,
    p_expires_at: days
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : null,
  });

  if (error) {
    console.error(`could not set tier: ${error.message}`);
    process.exit(1);
  }

  console.log(
    `${email} is now ${tier}${days ? ` for ${days} day${days === 1 ? "" : "s"}` : ""}`
  );
}

main();
