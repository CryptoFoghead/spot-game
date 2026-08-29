# BUILD STATUS

**Current phase:** Phase 4 — Authoritative gameplay ✅ complete
**Next phase:** Phase 5 — Realtime

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
