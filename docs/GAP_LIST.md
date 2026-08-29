# SPOT — Gap List

Everything known to be missing, incomplete, or deferred. This is the running to-do list; **[BUG_LIST.md](BUG_LIST.md)** tracks things that are broken rather than absent.

**Status:** MVP is live at https://spot-game-green.vercel.app. Nothing below blocks the core game.

## How to use this file

- Add a row when you decide something is needed but aren't doing it now.
- IDs are stable (`G-01`) so they can be referenced in commits and conversation. Never renumber.
- **P0** = do before real users · **P1** = soon after launch · **P2** = community phase · **P3** = later/optional.
- When an item ships, mark it `✅ Done` with the date, and leave the row. Don't delete history.

---

## P0 — before putting this in front of real users

| ID | Gap | Why it matters | Notes |
|---|---|---|---|
| G-01 | **Phone-to-phone test** (PRD §74) | This is the only remaining MVP acceptance step. Two real people, two devices, separate networks. Test backgrounding, screen lock, dead zones, refresh, rapid taps. | Needs humans, not automation. Everything else is verified. |
| G-02 | ~~AI rate limiter is in-memory~~ | ✅ **Done 2026-08-29** | Moved to Postgres (`ai_usage` + `claim_ai_generation`), serialised per user by advisory lock, fails closed. Verified in production: quota shared across instances, invalid requests consume none. |
| G-03 | **No error alerting** | ⚠️ **Partly done 2026-08-29** — all errors now route through `lib/observability.ts` as structured `spot_error` JSON lines, so they are searchable and one file is the seam for a service. **Still needed: something that actually notifies you.** | Add a Vercel log-drain alert matching `"tag":"spot_error"`, or drop in a Sentry DSN. Needs your account. |
| G-04 | ~~Nothing enforces or sweeps `expires_at`~~ | ✅ **Done 2026-08-29** | `sweep_rooms()` marks expired rooms and deletes terminal rooms past 30-day retention (cascading players/cards/events). Scheduled hourly via pg_cron as `spot-maintenance`; `maintenance_status()` proves it is scheduled and active. |
| G-05 | ~~AI cost has no ceiling~~ | ✅ **Done 2026-08-29** | Global cap of 500 generations/day enforced in `claim_ai_generation` independently of per-user limits; breaching it logs a `spot_warning`. Still worth setting a budget alert in the Anthropic console as a second line of defence. |

## P1 — soon after launch

| ID | Gap | Why it matters | Notes |
|---|---|---|---|
| G-06 | **No CI** | Tests only run when someone remembers locally. A broken commit can reach `master` and deploy. | GitHub Actions on pull requests: lint, typecheck, test, build. Repo is public so Actions minutes are free. Note the live integration tests need Supabase secrets — either add them as repo secrets or split unit-only for CI. |
| G-07 | **PWA icons are SVG only** | Android install prompts and iOS Add to Home Screen want raster PNGs (192×192, 512×512, maskable). Install may look wrong or be refused. | Generate PNGs from `public/icon.svg`, add to `app/manifest.ts`. |
| G-08 | **Data retention: partly done** (PRD §57) | Room data now expires and is deleted after 30 days by the sweeper (G-04), and AI usage rows after 7. **Still missing: a user-facing "delete my account" path.** | Account deletion cascades cleanly already — the schema uses `on delete cascade` throughout; it just needs a UI and a server action. |
| G-09 | **Analytics events not implemented** (PRD §58) | No visibility into the north-star metric — completed multiplayer rooms per week (§92). You can't tell if the product is working. | `room_events` already records most of this server-side; a read model or lightweight product analytics would surface it. |
| G-10 | **Moderation / Report Game missing** (PRD §55) | Public user-generated content with no report path. Becomes urgent the moment strangers can publish. | Schema for `reports` is specified in the PRD but not created. Currently mitigated: public discovery only shows the 8 seeded games. |
| G-11 | **No formal accessibility audit** (PRD §63) | Basics are in place — semantic buttons, `aria-pressed`, `aria-label`s, marked state not colour-only, focus rings, `motion-safe` animations — but nothing has been tested with a screen reader or keyboard-only. | Run axe, then a real VoiceOver/NVDA pass on the board and join flow. |
| G-12 | **No OpenGraph images** (PRD §76) | Shared links look plain. Metadata is server-rendered but there's no OG image. | Next's `opengraph-image` convention; could render game title dynamically. |
| G-13 | **Explore has no search** | Only category chips. Fine for 8 games, useless at 100. | PRD §52 puts search in the community phase. |
| G-14 | **"One square away" 🔥 indicator** (PRD §32) | Deliberately removed — it was inferred from score, which is not what one-away means. The leaderboard is less exciting without it. | Needs real line analysis exposed per player. `completedSets()` in `lib/game/bingo.ts` is most of the way there; needs a "one short of any line" variant computed server-side. |
| G-15 | **Presence counts tabs, not people** | Two tabs from one player shows "2 online". Cosmetic but visibly wrong. | Presence key is the player id; dedupe by key in the sync handler. |

## P2 — community phase (PRD §52)

| ID | Gap | Why it matters | Notes |
|---|---|---|---|
| G-16 | **Explore: Trending / Popular / New sections** | Discovery is a flat list. | `play_count` is already tracked and incremented on room creation. |
| G-17 | **Ratings** (PRD §54) | No quality signal on community games. | Table spec exists in the PRD. |
| G-18 | **Remix attribution not shown** (PRD §53) | `source_game_template_id` is recorded on every duplicate but never displayed. The data is there; the UI isn't. | "Remixed from X" on the game detail page. |
| G-19 | **"Saved" tab in My Games** | PRD §42 lists Created / Drafts / Saved; only the first two exist. | PRD explicitly allows omitting this for MVP. |
| G-20 | **No creator profiles** | `profiles` table exists and is populated on signup, but nothing reads it. | PRD §7 excludes it from the initial build. |

## P3 — later / optional

| ID | Gap | Why it matters | Notes |
|---|---|---|---|
| G-21 | **Only classic and blackout modes** | PRD §13 lists double, four_corners, timed, points, endless as future modes. | Schema and the `game_mode` CHECK already allow all of them; only classic/blackout are accepted by `create_room` and implemented in `card_has_bingo`. |
| G-22 | **Monetization not built** (PRD §59–60) | Deliberately deferred — PRD says don't let payment block proving gameplay. | Stripe Checkout + a `subscriptions` table, webhook-authoritative. |
| G-23 | **Points mode scoring** | `game_squares.points` exists and defaults to 1, but score is always a count of marked squares. | PRD §50 describes points mode as future. |
| G-24 | **Custom domain** | Currently on `spot-game-green.vercel.app`. | You already own `tourneymind.com` through Vercel, so the flow is familiar. Note: changing the domain means updating `NEXT_PUBLIC_SITE_URL` **and** the Supabase redirect URLs. |
| G-25 | **Unused starter assets** | `public/` still has Next's default `next.svg`, `vercel.svg`, `window.svg`, `globe.svg`, `file.svg`. Confirmed unreferenced. | Harmless; delete when tidying. |

---

## Operational notes (not gaps, but don't get caught out)

- **Supabase free tier pauses after 7 days of inactivity.** The app will look broken until you restore it from the dashboard. If SPOT gets real usage, this is the first thing to upgrade.
- **Room codes are 4 digits and unique only among reachable rooms.** Fine now. PRD §20 says migrate to 6-character alphanumeric when volume grows — at a few thousand concurrent rooms, collision retries start failing.
- **The E2E suite is a localhost gate.** Running it against the deployment is flaky for harness reasons (see [BUG_LIST.md](BUG_LIST.md) B-09). Verify production deliberately instead.
