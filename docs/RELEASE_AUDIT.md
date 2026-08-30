# SPOT — Release Audit

**Date:** 2026-08-30 · **Against:** `docs/PRD.md` MVP scope (§6, §80) · **Status:** deployed
**Commit audited:** `9e0fb2e`, confirmed serving at `/api/health` in production.

Nothing is marked PASS unless it was observed working. Requirements verified only by reading code are marked PARTIAL and say so.

**How this pass was done.** Every automated gate and security probe below was **re-run today** against the live project — lint, typecheck, 226 unit and integration tests, 14 E2E, 7 accessibility, production build, the secret scan and the RLS probe — and production was confirmed to be serving the audited commit. Rows describing the **creator flow** (creating a game, editing squares, live AI suggestion) carry forward browser observations made on 2026-08-29 and were **not** re-observed today; they are marked ‡ so nobody mistakes carried-forward evidence for fresh evidence.

## Verdict

**The MVP is complete and live at https://spot-game-green.vercel.app.** PRD §80's Definition of MVP Done is met, verified by automated multi-context browser tests and by deliberate runs against production.

The one thing still outstanding is PRD §74: two real people, two real phones, separate networks. `e2e/two-phones.spec.ts` now covers the mechanical half in two mobile browser contexts, but emulated browsers on one machine share a network stack and a clock. They cannot answer whether two people on a café's wifi see each other promptly, whether an iOS socket survives an hour asleep, or whether the game is any fun.

---

## §80 — Definition of MVP Done

> *"A new visitor can: open site, choose an existing Game, start a Room, invite another person, second person joins without registration, both receive Cards, host starts, Player marks Squares, updates appear live, system accurately detects Bingo, winner appears for all Players, host ends Room."*

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Open site | **PASS** | 200 on `/`, `/explore`, `/games/[slug]` in production today |
| 2 | Choose an existing Game | **PASS** | 10 starter games, 40 squares each, browsable and filterable |
| 3 | Start a Room (no account) | **PASS** | E2E: anonymous visitor starts a room and lands on the host screen |
| 4 | Invite another person | **PASS** | QR code + copy link + Web Share, join URL works |
| 5 | Second person joins without registration | **PASS** | E2E: players join with a nickname only, on desktop and on two mobile contexts |
| 6 | Both receive Cards | **PASS** | E2E asserts 25 tiles each; independent shuffles covered by integration tests |
| 7 | Host starts | **PASS** | E2E: Start → controls become Pause/End, players go LIVE |
| 8 | Player marks Squares | **PASS** | E2E: tiles marked by click and by touch, `aria-pressed` flips |
| 9 | Updates appear live | **PASS** | E2E: one player sees another's progress with no reload |
| 10 | System accurately detects Bingo | **PASS** | Unit tests plus a SQL/TS agreement test; E2E completes a real row |
| 11 | Winner appears for all Players | **PASS** | E2E: both players see the overlay naming the winner |
| 12 | Host ends Room | **PASS** | E2E: room shows `completed`, players see "This game has ended" |

---

## §6 — MVP functionality

### Game creation

| Requirement | Status | Notes |
|---|---|---|
| Create Game Template ‡ | **PASS** | Browser: create → draft → editor |
| Enter title / description | **PASS** | Zod bounds enforced (3–80, ≤300) |
| Select category | **PASS** | FK-constrained to the 28 seeded categories |
| Select content level | **PASS** | family / standard / unfiltered |
| Add / edit / delete Square ‡ | **PASS** | All three verified in browser |
| AI suggestion endpoint ‡ | **PASS** | Live generation verified 2026-08-29. The limiter it depends on **was** re-verified today, including the exact `p_user_limit: null` call shape the route sends |
| Save Game Template | **PASS** | Publish enforces the 24-square minimum with an exact message |
| Public/private toggle | **PASS** | private / unlisted / public, enforced by RLS |

### Game library

| Requirement | Status | Notes |
|---|---|---|
| Built-in starter Games | **PASS** | 10 games × 40 squares seeded and live, including Date Night and Coffee Shop |
| User-created Games | **PASS** | My Games with Created/Drafts/Saved tabs |
| View Game | **PASS** | `/games/[slug]` with SEO metadata and per-game OG image |
| Start Room | **PASS** | From the game detail page |
| Duplicate Game | **PASS** | Atomic RPC; verified copying 40 squares |

### Multiplayer

| Requirement | Status | Notes |
|---|---|---|
| Start Room | **PASS** | |
| Short Room code | **PASS** | 4 digits, collision retry, unique among reachable rooms |
| QR code | **PASS** | Rendered on demand, not stored |
| Join anonymously | **PASS** | No account, no email, no password |
| Choose nickname | **PASS** | Sanitized, 1–24 chars, whitespace-only rejected; duplicate nicknames stay distinct (tested) |
| Unique randomized Card per player | **PASS** | Server-side; integration test asserts two players differ. In **Together** mode there is deliberately one shared card, under its own partial unique index |
| Realtime Room updates | **PASS** | Broadcast from the database; E2E proves cross-client updates on two mobile contexts |
| Mark / unmark Square | **PASS** | Atomic, optimistic UI that reverts — including when the network is gone (B-20) |
| Live score / progress | **PASS** | Recomputed server-side every toggle |
| Bingo detection | **PASS** | Server-authoritative |
| Winner event | **PASS** | First-writer-wins settlement |
| Continue after Bingo | **PASS** | Integration test covers both settings |
| Late join | **PASS** | Joining an already-running game gives a playable card; a latecomer to a co-op game gets the team's card with its existing marks |
| End Room | **PASS** | |

### Host

| Requirement | Status | Notes |
|---|---|---|
| View Players | **PASS** | Live list with scores |
| Start / Pause / Resume / End | **PASS** | State machine enforced in SQL |
| Remove Player | **PASS** | E2E: removed player cannot rejoin |
| Select win mode | **PASS** | classic, blackout, double, four corners, points, timed, and Together (shared card). `endless` remains deliberately unbuilt |
| Copy Room link | **PASS** | |
| Display QR code | **PASS** | |

### Authentication

| Requirement | Status | Notes |
|---|---|---|
| Accounts only for saved Games / library / editing | **PASS** | Creators sign in; players never do |
| Players stay anonymous | **PASS** | Guest token only |

---

## Security review

All re-run today.

| Area | Status | Evidence |
|---|---|---|
| No secret in the client bundle | **PASS** | `scripts/scan-secrets.js` passes. It now scans **by value** (own variables only, ignoring placeholders and anything also exposed as `NEXT_PUBLIC_`) **and by shape** (Anthropic key, Supabase secret key, `service_role` JWT, private-key block). The shape scan was proved by planting a fake key and a fake `service_role` JWT — both caught — and an anon JWT, correctly ignored |
| `.env` files git-ignored | **PASS** | Confirmed by `git check-ignore` |
| RLS on every exposed table | **PASS** | `scripts/verify-rls.js`: anonymous key reads 0 rows from every gameplay table, plus `user_entitlements` and `ai_usage` |
| No anonymous writes | **PASS** | INSERT refused and DELETE removed 0 rows across all probed tables — compared by row count, never by status code |
| Unpublished games hidden | **PASS** | 0 unpublished games visible anonymously |
| Internal DB functions not callable | **PASS** | `generate_player_card`, `hash_guest_token`, `is_room_host`, `card_has_bingo`, `tier_for`, `ai_hourly_limit_for` all 404 to clients |
| Server-side authorization on mutations | **PASS** | Every game mutation re-checks `creator_id`; every room mutation authorizes by guest token or `auth.uid()` inside the RPC |
| Guest player authorization | **PASS** | Opaque 32-byte token, sha256-hashed at rest, httpOnly cookie; integration tests prove a stranger's token cannot read a snapshot or mark a card. On a **shared** card the rule changes shape — membership of the room rather than ownership — and both halves are tested |
| Host-only actions enforced server-side | **PASS** | Integration test: a player's token is refused for start/remove |
| AI endpoint requires auth | **PASS** | 401 unauthenticated, verified against production today |
| AI rate limiting | **PASS** | *Was PARTIAL ("not distributed") and had been stale for some time.* The counter lives in Postgres and is shared by every instance, serialised per user by an advisory lock, with a separate global daily ceiling. Verified today against the live project. The per-user limit is now derived from the account's **tier inside the database** — it used to be supplied by the caller, which our own route got right but nothing enforced. `p_user_limit` can only make the ceiling stricter, and there is a test that asks for 1000 and is still cut off at 10 |
| Entitlements cannot be self-granted | **PASS** | `user_entitlements` has **no write policies at all**; tests confirm a client insert is refused and that one account cannot read another's tier |
| Realtime payloads leak no cards | **PASS** | Test asserts no square text appears in any broadcast |

---

## Quality gates

All run today at commit `9e0fb2e`.

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` | **227 passing** (unit + live integration) |
| `npm run e2e` | **14 passing**, including the §73 mandatory scenario and 4 two-phone tests |
| accessibility (axe) | 7 passing |
| `npm run build` | clean |
| `node scripts/scan-secrets.js` | pass |
| `node scripts/verify-rls.js` | pass |
| production `/api/health` | serving the audited commit |

---

## Blockers

None. Both original blockers (AI key, deployment) were resolved on 2026-08-29.

## Non-blocking issues

The seven listed in the previous audit have been worked through; only the last is still true.

| # | Issue | State |
|---|---|---|
| 1 | AI rate limiter in-memory | **Fixed** — Postgres-backed and tier-derived (G-02, G-28) |
| 2 | No one-away (🔥) indicator | **Fixed** — computed from line analysis, not from score (G-14) |
| 3 | Long square text truncates | **Improved** — tile text is sized to its own length (B-11). The very longest seeded squares are still tight at 375 px |
| 4 | Data retention not implemented | **Fixed** — rooms expire and are swept; AI usage pruned; account deletion added (G-04, G-08) |
| 5 | Analytics not implemented | **Fixed** — `product_metrics()` computes the north-star metric server-side (G-09) |
| 6 | Presence counts tabs, not people | **Fixed** — counts distinct players (G-15) |
| 7 | Free-tier Supabase pauses after 7 days idle | **Still true.** Operational, not a defect. The app will look broken until it is restored from the dashboard |

### Known and deliberate

- **B-22 is unproven.** `RoomLive` resyncs on `visibilitychange`/`online` to guard against a socket that dies silently while a phone is backgrounded. The automated two-phone test passes with those listeners removed, because `setOffline` closes the socket cleanly and the existing resync-on-resubscribe handles it. Nothing here can reproduce a silently dead socket; only a real phone left asleep can say whether the guard was needed.
- **`endless` mode** is unbuilt — it needs a "never ends" lifecycle design rather than a scoring rule.
- **Creator profiles** (G-20) are excluded from the initial build by the PRD.
- **No checkout** (G-22). The entitlement seam exists and a tier can be granted with `scripts/set-tier.js`; what is missing is a way to pay, not a way to be a supporter.

## Notes on the audit itself

Everything that has most embarrassed this project was found by running it, not by reading it.

- Ending a game 404'd the host and made the "This game has ended" screen unreachable (B-06).
- A valid session for a deleted user broke joining entirely (B-04).
- A mark went stale in production only, because two `router.refresh()` calls aborted each other under real latency — invisible on localhost (B-07).
- A tap on a dead network claimed a mark the database did not have, and killed that square for the rest of the game (B-20).
- CI had **never once passed**, on any commit, while the gap list recorded it as done — found only by reading a run's conclusion instead of assuming one (B-18).

Two probe results were false alarms worth keeping in mind. PostgREST returns **204 on a DELETE that matched zero rows**, so an anonymous DELETE *looks* successful under RLS; the check compares row counts instead. And the secret scanner, when it had no real secrets to check, fell back to the whole environment and flagged `https://github.com` inside `package-lock.json` while never examining a secret at all (B-19).

The habit those add up to: **existence is not success.** A workflow file existing is not CI passing, a run existing is not a run succeeding, a green smoke test is not a deploy shipping, and a passing test nobody has watched fail is not evidence. Each of the offline tests in `e2e/two-phones.spec.ts` was checked by reverting its fix and confirming the test failed — which is exactly how the B-22 overclaim above was caught.
