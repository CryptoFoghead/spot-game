# SPOT — Gap List

Everything known to be missing, incomplete, or deferred. This is the running to-do list; **[BUG_LIST.md](BUG_LIST.md)** tracks things that are broken rather than absent.

**Status:** live at https://spot-game-green.vercel.app. All P1–P3 items are done except the two that need your decision, and one that needs a human.

## How to use this file

- Add a row when you decide something is needed but aren't doing it now.
- IDs are stable (`G-01`) so they can be referenced in commits and conversation. Never renumber.
- **P0** = do before real users · **P1** = soon after launch · **P2** = community phase · **P3** = later/optional.
- When an item ships, mark it `✅ Done` with the date, and leave the row. Don't delete history.

---

## ⛳ Still open

| ID | P | Gap | Needs |
|---|---|---|---|
| G-01 | P0 | **Phone-to-phone test** (PRD §74) | **You and one other person**, two devices, ideally separate networks. Step-by-step checklist ready in [PHONE_TEST.md](PHONE_TEST.md). The last MVP acceptance step; automation cannot answer whether it is fun. |
| G-20 | P2 | **Creator profiles** | PRD §7 excludes these from the initial build. `profiles` is populated but unread. Worth doing once there are community creators to have profiles. |
| G-22 | P3 | **Monetization** (PRD §59–60) | **Your business decision**, plus a Stripe account and keys. The PRD deliberately defers this until gameplay is proven. |
| G-24 | P3 | **Custom domain** | **Your choice of domain.** Changing it means updating `NEXT_PUBLIC_SITE_URL` *and* the Supabase redirect URLs, or magic links and QR codes break. |
| — | — | **`endless` game mode** | Still deliberately unbuilt — it needs a "never ends" lifecycle design rather than a scoring rule. (`timed` is now implemented.) |

---

## ✅ Completed

| ID | P | Gap | Resolution |
|---|---|---|---|
| G-02 | P0 | AI rate limiter was in-memory | Moved to Postgres (`ai_usage` + `claim_ai_generation`), serialised per user by advisory lock, fails closed. Verified in production: quota shared across instances, invalid requests consume none. |
| G-04 | P0 | Nothing enforced or swept `expires_at` | `sweep_rooms()` marks expired rooms and deletes terminal rooms past 30-day retention. Scheduled hourly in-database via pg_cron; `maintenance_status()` makes the schedule observable. |
| G-03 | P0 | No error alerting | Sentry wired into the existing reportError seam, errors only (tracing and replay off — they bill separately and the org quota is shared with TourneyMind). Control-flow throws and mobile WebSocket noise filtered. Verified end to end: event accepted into project 4511997018636288. Email alerts on high-priority issues. |
| G-05 | P0 | AI cost had no ceiling | Global cap of 500 generations/day, enforced independently of per-user limits, with a warning logged when it holds users back. |
| G-06 | P1 | No CI | GitHub Actions on PRs and `master`: lint, typecheck, unit tests, build, secret scan. Integration tests skip without `.env.local`, so no database secrets are needed in a public repo. |
| G-07 | P1 | PWA icons were SVG only | PNG 192/512/maskable/apple-touch generated from the SVG by `scripts/generate-icons.js`, wired into the manifest and layout metadata. |
| G-08 | P1 | Data retention (PRD §57) | Rooms expire and are deleted after 30 days; AI usage after 7. Plus account deletion below. |
| G-08b | P1 | No "delete my account" | `delete_my_account()` removes the user, profile, games and usage. Rooms they host are deliberately **not** destroyed — `host_user_id` is nulled so a game in progress doesn't vanish under other players. Confirmation is typing DELETE. |
| G-09 | P1 | No analytics | `product_metrics()` computes the north-star metric (completed multiplayer rooms, players per room) and the funnel from `room_events` — server-side truth rather than browser beacons. `node scripts/metrics.js` prints it. |
| G-10 | P1 | No moderation path | `report_game()` accepts reports on published games, **anonymously by design** — requiring an account to report unsafe content suppresses reports. Rate limited per reporter. Queue is service-role only. |
| G-11 | P1 | No accessibility audit | Automated axe pass across 5 pages plus the host and play screens, and a keyboard-only board test, wired into the E2E suite. **Found and fixed two real WCAG AA contrast failures** (destructive text at 4:1, muted text at 4.34:1). |
| G-12 | P1 | No OpenGraph images | Default share card plus a per-game card showing title, description, category and square count. |
| G-13 | P1 | Explore had no search | Search over title and description, plus Popular/New/A–Z sorting, filters preserved across changes. Search input escaped so it cannot alter the PostgREST filter. |
| G-14 | P1 | 🔥 one-away indicator missing | Restored, computed correctly: a property of the card's *lines*, not a score threshold. In SQL and TypeScript, verified to agree. |
| G-15 | P1 | Presence counted tabs | Now counts distinct players. |
| G-16 | P2 | No trending section | Trending measured from actual rooms played in the last 7 days, not view counts. |
| G-17 | P2 | No ratings | 1–5 stars, one vote per user (upsert replaces). Aggregates public, individual votes not. |
| G-18 | P2 | Remix attribution unused | Now shown. The lineage had been recorded since Phase 2 — only the UI was missing. |
| G-19 | P2 | No Saved tab | Saved tab in My Games, backed by a per-user list private under RLS. |
| G-21 | P3 | Only classic and blackout | Added four corners, double, and points. Implemented in SQL and mirrored in TypeScript, with integration tests proving they agree for every mode. |
| G-23 | P3 | Points mode scoring | Points mode ranks by square point values; score and marked count now reported separately. |
| G-25 | P3 | Unused starter assets | Removed. |
| G-26 | P2 | Nothing for two people at one table | **Co-op mode ("Together").** One shared card for the whole room instead of one each: `player_cards.room_player_id` becomes nullable, a partial unique index keeps it to exactly one shared card per room, and `player_card_squares.marked_by` records who spotted what. Authorisation changes shape — a personal card requires you to *be* the owner, a shared card requires you to be an *active player in the room* — and both halves are tested. The team wins together; each player still scores on what they personally found, so there is a reason to look. |
| G-27 | P2 | Content assumed a crowd to watch | **Date Night Bingo** and **Coffee Shop Bingo**, 40 squares each, written to prompt conversation rather than just observation ("A table where it is obviously a first date"). These are the two-people-at-a-table case the co-op mode serves. |

---

## Operational notes (not gaps, but don't get caught out)

- **This project owns port 3001.** Another app on this machine uses 3000. `npm run dev`, `npm run start`, Playwright and `.claude/launch.json` all pin 3001, and `GET /api/health` identifies the app so a port collision fails loudly (see README).
- **Supabase free tier pauses after 7 days of inactivity.** The app will look broken until you restore it from the dashboard. If SPOT gets real usage, this is the first thing to upgrade.
- **Room codes are 4 digits and unique only among reachable rooms.** Fine now. PRD §20 says migrate to 6-character alphanumeric when volume grows.
- **The E2E suite is a localhost gate.** Running it against the deployment is flaky for harness reasons (BUG_LIST B-10a). Verify production deliberately instead.
- **Sentry per-key rate limits need a Business plan** ($80/mo), so volume is bounded in our own code instead: 20 events per browser session and 30 per minute per server instance, on top of filtering control-flow throws and mobile network noise. See `lib/sentry-budget.ts`.
- **Supabase rate-limits auth**, and the integration suite signs users in. Heavy repeated runs exhaust it for a while; `createSignedInUser` backs off and reports it clearly, and each suite reuses a couple of users rather than creating one per test. If several files fail at once with "Request rate limit reached", wait a few minutes rather than debugging the code.
- **Enabling integration tests in CI** would mean putting Supabase credentials in a public repo's secrets. Deliberately not done: the unit suite runs in CI, the integration suite runs locally against the real project.
