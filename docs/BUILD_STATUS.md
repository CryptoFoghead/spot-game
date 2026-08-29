# BUILD STATUS

**Current phase:** Phase 9 — Deployed and live 🚀
**Live URL:** https://spot-game-green.vercel.app
**Remaining:** PRD §74 phone-to-phone test (needs two real people on two devices)

## Working documents

| File | What it's for |
|---|---|
| **[GAP_LIST.md](GAP_LIST.md)** | Everything not yet built, prioritised P0–P3. Add to this when you decide something is needed but aren't doing it now. |
| **[BUG_LIST.md](BUG_LIST.md)** | Defects found in testing, with root cause and fix. Add a row the moment a bug is observed. |
| [RELEASE_AUDIT.md](RELEASE_AUDIT.md) | Point-in-time PASS/PARTIAL audit of every MVP requirement. |
| [BUILD_PLAN.md](BUILD_PLAN.md) | The original phase-by-phase implementation plan. |
| [PRD.md](PRD.md) | Source of truth for requirements. |

## Phase 9 (2026-08-29)

### Deployed

- Vercel project `spot-game` under `ryan-wirtjes-projects`, production alias **https://spot-game-green.vercel.app**
- All five environment variables set for Production and Preview (pushed via `scripts/push-vercel-env.js`, which never prints values)
- `NEXT_PUBLIC_SITE_URL` set to the production origin so magic links and QR join URLs point at the real site
- Supabase auth `site_url` and redirect URLs updated to production, keeping localhost for development

### AI generation verified live

With the key in place: authenticated request returned **200 in ~13s** with genuinely location-aware squares ("full Iowa or Iowa State gear from hat to socks", "a soft cooler that definitely contains snacks from home"), varied difficulty, and it honored the existing-squares exclusion. The creator UI path also works end to end: Generate Ideas → 10 editable suggestions → Keep → persisted to the game.

### Production verified

- All routes 200; live database data rendering; AI endpoint still 401 to unauthenticated callers
- Two independent clients in a production room: one player's marks and bingo reached the other **with no reload** — winner overlay, trophy and leaderboard all updated

### Bug found and fixed: your own score went stale after marking

On production only, marking a square flipped the tile but left your score and leaderboard row stale until you reloaded. The board (after a successful mark) and the realtime channel (on every broadcast) each called `router.refresh()` independently; under real latency these overlapped and **aborted each other**, and the aborted one was usually the last — so the final state never rendered. Localhost resolved fast enough to hide it entirely.

`lib/room-refresh.ts` now provides one trailing-edge debounced scheduler shared by both components, so a burst of activity produces exactly one refetch after it settles. Re-verified on production: marking now updates score and leaderboard immediately.

### Note on the E2E suite

The Playwright suite is a **pre-deploy gate run against localhost**, where it passes reliably. Running it against the deployment proved flaky for test-harness reasons rather than app defects — `waitForLoadState("networkidle")` never settles on pages holding a Supabase realtime WebSocket (removed), and repeated three-context runs against a live deployment contend for local browser resources, failing at a different step each time. Production was therefore verified deliberately with two real clients, which is the check that matters.

---

## Phase 8 (2026-08-29)

See **[docs/RELEASE_AUDIT.md](RELEASE_AUDIT.md)** for the full PASS/FAIL/PARTIAL audit against every MVP requirement.

## Phase 8 (2026-08-29)

### Added

- **Playwright E2E** covering the PRD §73 mandatory scenario in three isolated browser contexts — host, player A, player B. This finally exercises what a single browser profile cannot: genuinely separate guest cookies. Host starts → both join → host starts game → A marks → **B sees A's progress with no reload** → A gets bingo → **B sees the bingo alert** → host ends. Plus removed-player-cannot-rejoin and unknown-room-code.
- **`scripts/scan-secrets.js`** — proves no server secret appears in the client bundle or any tracked file, reporting names and counts only, never values.
- **`scripts/verify-rls.js`** rewritten into a full anonymous-access probe across all nine tables (read / insert / delete), unpublished-game visibility, and direct callability of internal database functions.

### Bug found and fixed: ending a game 404'd everyone

Room pages resolved the room through `get_join_info`, which only matches joinable rooms. The instant a host ended a game, the room became unreachable — the host who just ended it, and any player who reloaded, got the "We couldn't find that" page, and the "This game has ended" screen (§64) was unreachable. Migration 0010 adds a status-agnostic resolver for participants while `get_join_info` still correctly refuses to let anyone *join* a completed room. Caught by the E2E test's final assertion.

### A false alarm worth recording

The first RLS probe reported that anonymous DELETE succeeded on all nine tables (HTTP 204). It had not: PostgREST returns 204 for a DELETE matching **zero** rows, and RLS filters rows silently. Seed counts were unchanged (28/8/320). The probe now compares row counts before and after instead of trusting the status code — status alone cannot distinguish "blocked" from "deleted everything".

### Results

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` | 113/113 |
| `npm run e2e` | 3/3 including §73 |
| `npm run build` | clean |
| Secret exposure scan | PASS |
| Anonymous access probe | PASS |

---

## Phase 7 (2026-08-29)

## Phase 7 (2026-08-29)

- Friendly error surfaces (PRD §64): `not-found` page, root error boundary, and skeleton loading states for the board and Explore.
- Share sheet (§77): Web Share API where supported, clipboard fallback otherwise.
- PWA manifest and icon (§61) — Add to Home Screen works without a native app.
- Game title now appears as the heading on both the host and play screens; winner celebration animates under `motion-safe` so reduced-motion users are respected.

### Bug found and fixed: orphaned sessions blocked joining

A Supabase session token stays cryptographically valid until it expires, so `auth.uid()` can name a user row that no longer exists — after account deletion (which §57 requires supporting) or a database restore. `room_players.user_id` then failed its foreign key and the person could not join or host at all, seeing only "Something went wrong."

`create_room` and `join_room` now resolve the caller through `auth.users`, so a stale token degrades to anonymous guest identity — which every room path already supports. Migration 0009, with an integration test that creates a user, takes a live session, deletes the user, and asserts the join still succeeds.

This surfaced twice during manual testing before being diagnosed; the first time it was misread as test-environment noise.

---

## Phase 6 (2026-08-29)

## ⛔ Blockers

| # | Blocker | Blocks | What I need from you |
|---|---|---|---|
| 1 | `AI_API_KEY` is not set | Verifying the live AI generation call | An Anthropic API key in `.env.local`. Everything around the call is built and tested; the endpoint currently returns a clean 503. |
| 2 | No Vercel project | Phase 9 (deploy) | Connect the GitHub repo to Vercel and add the four env vars, or tell me to use the Vercel CLI. |

## Phase 6 (2026-08-29)

### Completed features

- **`POST /api/ai/generate-squares`** (PRD §36): authenticated creators only, per-user rate limited, Zod-validated request, structured JSON response validated before it is returned.
- **Server-only key.** `AI_API_KEY` is read through the server env accessor and the SDK is only constructed inside the route handler — it can never reach the browser (§9).
- **Safety prompt** (§37) and **content-rating guidance** (§38) live in `lib/ai/prompt.ts` and are asserted by tests, so the rules can't silently drift.
- **Duplicate filtering** (§36): a normalizing key ignores case, punctuation and filler words, so near-duplicates ("Someone carrying a giant turkey leg" vs "carrying giant turkey leg") collide. Applied both within a batch and against the game's existing squares.
- **Creator UI**: Generate Ideas / Add 10 Ideas, with each suggestion editable or droppable before it is kept — nothing is saved until the creator accepts it.
- **Graceful degradation**: with no key configured the endpoint returns 503 with a friendly message and the rest of the app is unaffected.
- Model: `claude-opus-5` via the official `@anthropic-ai/sdk`, using `messages.parse` with a Zod-derived `output_config.format`, and typed error handling for rate-limit/auth/API failures. Refusals (`stop_reason: "refusal"`) are handled explicitly rather than dereferenced.

### Verified

- Unauthenticated request → **401** (§65: never allow unauthenticated AI)
- Authenticated + valid request → **503 "AI generation isn't configured yet"** — proving auth, rate limiting and validation all pass and only the key is missing
- Authenticated + invalid request → **400** with a field-level Zod message
- 21 unit tests covering the safety prompt contents, rating guidance, prompt assembly, dedupe keys, response-schema validation and the rate limiter

### Not yet verified (blocker #1)

The actual model call. Everything up to `client.messages.parse(...)` is exercised; the call itself, the shape of a real response, and end-to-end suggestion quality need a key.

### Known limitation

The rate limiter is in-memory and therefore per-instance. It stops a browser from hammering the endpoint (the MVP requirement) but is not distributed — on multiple serverless instances the effective ceiling is limit × instances. This is documented in the code and should move to Postgres or Redis before real traffic.

### Quality gates (all passing)

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` | 110/110 |
| `npm run build` | clean |

---

## Phase 5 (2026-08-29)

## Phase 5 (2026-08-29)

### Completed features

- **Broadcast originates in the database.** A trigger on `room_events` calls `realtime.send()` on the room's topic, so every message is emitted inside the same transaction that changed authoritative state. Clients cannot forge events, and no message can describe a change that did not commit. This was chosen over client-side broadcasting specifically because clients are untrusted.
- **Sanitized payloads** (§32): messages carry event type, player, score and marked count — never square text or positions, so a subscriber cannot reconstruct another player's card by listening. An integration test asserts no card text appears in any broadcast.
- **Events**: PLAYER_JOINED / PLAYER_REMOVED / GAME_STARTED / GAME_PAUSED / GAME_RESUMED / GAME_COMPLETED / SQUARE_MARKED / SQUARE_UNMARKED / BINGO.
- **Presence** (§27) for connectivity only — an online count and a status dot. Participation always comes from the database.
- **Reconnect** (§29): every (re)subscribe triggers an authoritative refetch rather than replaying missed events. Bursts of marks are coalesced into one refetch (250 ms) so a fast-marking room doesn't refetch per tap.
- Connection indicator with "Connection lost. Reconnecting…" state.

### Verified live in the browser (two independent clients)

With a browser player and a separate node-driven player in the same room, **with no navigation or manual refresh in the browser**:

- the other player's marks moved them from 0 → 3 in the leaderboard and the "Leader:" line updated
- the other player's bingo raised the winner overlay ("MikeLaptop got bingo — 5 squares spotted") and added the trophy

This satisfies PRD §87's completion bar: one player's actions update the other player's screen without a manual refresh.

### Worth recording

A broadcast sent immediately after `SUBSCRIBED` can be missed — the topic takes a moment to route. This is precisely why the client resyncs from the database on connect instead of reconstructing state from events (§29), and the integration test now settles before asserting.

### Quality gates (all passing)

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` | 89/89 |
| `npm run build` | clean |

---

## Phase 4 (2026-08-29)

## Phase 4 (2026-08-29)

### Completed features

- **`toggle_square`** (PRD §23): a single atomic transaction that authenticates the player by guest token, verifies the room is active and the card is theirs, toggles the mark, recomputes the score from stored state, detects bingo, writes an audit event, and settles the winner. The player row is locked (`for update`) so rapid taps cannot interleave a recount.
- **Bingo detection** (§24) implemented twice and cross-checked: `card_has_bingo` in SQL is authoritative; `lib/game/bingo.ts` lets the client render instantly and makes the rules unit-testable. An integration test asserts the two agree.
- **First-winner settlement** (§25): the null-check and write are one statement, so a tie resolves to exactly one winner. `continue_after_win` keeps the room live or completes it.
- **Score** (§50) is always recomputed from the database, never accepted from the client, and excludes the FREE square.
- **Optimistic UI** (§28): the tile flips immediately, reverts on rejection, and shows a friendly message. The authoritative value always wins on refresh.
- **Winner overlay** (§34): dismissible celebration that never navigates a player away from their card.
- Marking is refused in lobby/paused/completed rooms, on another player's card, with an unknown token, after removal, and on the FREE square.

### Verified live in the browser

- Joined an active room as a guest, tapped a real tile → score became 1 authoritatively
- Completed the top row → server detected bingo, winner overlay showed "You got bingo — 5 squares spotted", trophy appeared in the leaderboard
- Paused the room from outside mid-play → the next tap was rejected and reverted with "The game isn't running right now."

### Tests

- 33 bingo unit tests (PRD §72 mandatory set): every row, every column, both diagonals, no-false-positive cases, FREE centre, blackout, and 3×3/7×7 cards
- 11 gameplay integration tests against the live database, including the SQL↔TypeScript agreement check and first-winner-wins under a second bingo

*A test premise was wrong during this phase and worth recording: "24 of 25 marked is not a bingo" is impossible — removing one square cannot break all 12 lines. The meaningful near-miss is 20 of 25 with the anti-diagonal left empty.*

### Quality gates (all passing)

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` | 87/87 |
| `npm run build` | clean |

---

## Phase 3 (2026-08-29)

## Phase 3 (2026-08-29)

### Completed features

- **Guest identity** (PRD §10): server-issued 32-byte opaque token in an httpOnly per-room cookie; only its sha256 hash is stored. Nickname is display-only and never identity.
- **`create_room`**: validates the game is startable by the caller and has enough squares, allocates a 4-digit code with collision retry, creates the room, the host player, and the host's card.
- **Anonymous hosting**: PRD §80 requires a *new visitor* to start a room, so hosts authenticate by guest token; `host_user_id` is set only when they happen to be signed in.
- **`join_room`**: validates room/expiry, sanitizes the nickname, creates the player and their card atomically; re-joining with the same token returns the same seat instead of duplicating.
- **Server-side card generation** (§18): independent `gen_random_uuid()` shuffle per player, 24 squares + FREE center at position 12, pre-marked.
- **Room lifecycle** (§22): `start`/`pause`/`resume`/`end` with the state machine enforced in SQL; COMPLETED is terminal. `remove_player` (host-only, cannot remove the host).
- **`get_room_snapshot`**: authoritative per-viewer state — room, players, and *only the caller's own card*.
- **UI**: Start Game control on game detail (nickname + mode), host lobby with QR code + copy link + player list + host controls, `/join/[code]` screen with game title/rating/player count and safety notice, player board with 5×5 grid and leaderboard, `/join` code entry.
- Room codes are unique only among reachable rooms (partial index), so 4-digit codes stay viable long-term.

### Bugs found and fixed during verification

- **Host had no card.** `create_room` created the host's player row without a card, so the host's board was empty — violating §80 ("both receive Cards"). Fixed in migration 0006; regression test added.
- **False 🔥 "one away" indicator.** It was inferred from score (`score >= total - 1`), which is not what "one square from bingo" means and fired on an empty card. Removed; it needs real line analysis, which arrives with Phase 4 bingo detection.
- Unmapped RPC errors were silently collapsed into a generic message; they are now logged server-side.

### Verified live in the browser

- Anonymous visitor started a room from Airport Bingo → host lobby with working QR, room code, copy link, and their own 25-square card
- A second player joined a *different* node-hosted room through the real join form with no account → 25 squares, 1 FREE center, lobby waiting state, both players listed
- Host saw the second player appear with a Remove control; Start Game moved the room to `active` and swapped controls to Pause/End
- Mobile 375px board: no horizontal scroll
- 14 integration tests against the live database cover card independence, rejoin, removal, state-machine legality, host-only authorization, stranger rejection, and REST-level inaccessibility of gameplay tables

### Quality gates (all passing)

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` | 43/43 |
| `npm run build` | clean, 13 routes |

---

## Phase 2 (2026-08-29)

## Phase 2 (2026-08-29)

### Completed features

- **Auth**: magic-link sign-in (`/login`), `/auth/callback` (handles token_hash and PKCE code), sign-out, session-refresh proxy (`proxy.ts`), auth-aware header, `requireUser` guard, profile auto-creation trigger (migration 0003)
- **Home page**: live Popular Games (8 seeded, ordered by play_count), category chips, room-code input, hero CTAs
- **Explore**: public published games grid + category filter, empty states
- **Game detail** `/games/[slug]`: badges, square count, 8-square preview, server-rendered SEO metadata, Duplicate (auth), Edit (owner), Start Game disabled pending Phase 3
- **My Games** `/dashboard/games`: Created/Drafts tabs, square counts, edit/view actions
- **Create** `/create`: settings form (title/description/category/content rating/visibility) → draft → editor
- **Edit** `/dashboard/games/[id]/edit`: settings, square add/edit/delete with per-square difficulty, live counter with minimum/recommended, publish (slug assigned on first publish, min-square guard), archive with confirm
- **Duplicate**: atomic `duplicate_game_template` RPC (migration 0004) — SECURITY DEFINER with explicit access checks, copies active squares, records remix lineage, always lands as the caller's private draft
- **Validation**: Zod schemas for game settings and squares (PRD §69 bounds) + `minimumSquares` rule + slug utilities
- All mutations enforce ownership server-side (explicit check + RLS backstop)

### Verified live in the browser (real Supabase project)

- Magic-link sign-in end-to-end (admin-generated link, dev helper `scripts/dev-login-link.js`)
- Create → draft → add/edit/delete square → publish blocked at 1/24 with exact error → duplicate Airport Bingo (40 squares copied) → publish succeeds, slug `airport-bingo-copy` → archive
- RLS negative tests (`scripts/verify-rls.js`): private published game invisible to anon; anon PATCH affects 0 rows; anon square INSERT → 401
- Mobile 375px: home + explore, no horizontal scroll
- Test user and test templates cleaned up; seeds intact (28/8/320)

### Quality gates (all passing)

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` | 29/29 |
| `npm run build` | clean, 10 dynamic routes + proxy |

---

## Phase 1 (2026-08-29)

### Completed features

- Next.js 16.3.3 (App Router, Turbopack) with TypeScript strict mode
- Tailwind CSS v4 + shadcn/ui (base-nova / Base UI) with button, card, input, label, badge, textarea, select
- Supabase clients: browser ([lib/supabase/client.ts](../lib/supabase/client.ts)), server/SSR ([lib/supabase/server.ts](../lib/supabase/server.ts)), admin ([lib/supabase/admin.ts](../lib/supabase/admin.ts), `server-only`-guarded)
- Environment validation with Zod ([lib/env.ts](../lib/env.ts)) — lazy, build-safe when unset, loud at runtime
- Complete initial database schema migration (all 9 tables from PRD §11–§17)
- RLS enabled on every table with PRD §46 policies; gameplay tables deny-all pending Phase 3–4 RPCs
- Seed data: 28 categories, 8 starter games × 40 squares each (320 squares)
- Configurable product identity ([lib/config.ts](../lib/config.ts)) — currently "SPOT"
- Foundational layout: sticky mobile-first header, nav, home page hero + how-it-works; placeholder /explore, /create, /join routes
- Vitest harness with 7 passing env-validation tests

## Quality gates (all passing)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | clean |
| `npm run test` | 7/7 passing |
| `npm run build` | clean production build, 5 static routes |
| Browser check | home + nav render, no console errors, mobile 375px OK |

## Supabase project

- Org **SocialBingo** (Free plan) · project **spot-game** · ref `auqhozkwgvtqzwtmuken` · us-west-2 · Postgres 17
- CLI linked; local `.env.local` populated (publishable + secret keys). Free-tier note: project pauses after 1 week of inactivity — restore from dashboard.

## Migrations

| File | Applied? |
|---|---|
| `supabase/migrations/20260829000001_initial_schema.sql` | ✅ 2026-08-29 via `supabase db push` |
| `supabase/migrations/20260829000002_rls_policies.sql` | ✅ 2026-08-29 |
| `supabase/migrations/20260829000003_auth_profiles.sql` | ✅ 2026-08-29 (profile trigger) |
| `supabase/migrations/20260829000004_duplicate_game_rpc.sql` | ✅ 2026-08-29 (duplicate RPC) |
| `supabase/seed.sql` | ✅ 2026-08-29 (`db push --include-seed`) — verified live: 28 categories, 8 games, 320 squares readable by anon; deny-all tables return nothing |

Auth config: `site_url` and `/auth/callback` redirect URLs pushed via `supabase config push`. Production URLs must be added before deploy (Phase 9).

## Environment variables required (see .env.example)

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only)
- Later phases: `AI_API_KEY`, Stripe keys (optional in schema until then)

## Known issues

- None in code. The app builds and runs without a database; any page that queries Supabase (Phase 2+) will need the env vars and an actual project.

## Decisions made (ambiguities resolved per PRD §82)

- `game_templates.category` is `text` per PRD §11, but FK-constrained to `categories.slug` so the §12 lookup table is enforced from day one.
- `source_game_template_id` (remix lineage, §53) included in the initial schema since Duplicate is an MVP feature.
- Gameplay tables (rooms writes, player_cards, player_card_squares, room_events) are deny-all under RLS; all access flows through validated server operations built in Phases 3–5. Guests have no auth identity, so client-side RLS cannot authorize them.
- Difficulty CHECK-constrained to easy/medium/hard (PRD leaves it open).

## Next actions (Phase 3 — Room Creation & Join)

1. `create_room()` RPC: template validation, unique 4-digit room code with collision retry, host room_player.
2. `join_room()` RPC: guest token (hash stored), room_player + server-side card generation (crypto shuffle, FREE center).
3. `/join/[code]` flow, room lobby (host + player views), QR code rendering, host player list + remove.
4. Uses the deny-all gameplay tables — all access through the RPCs/server routes.
