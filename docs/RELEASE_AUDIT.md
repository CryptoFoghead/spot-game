# SPOT — Release Audit

**Date:** 2026-08-29 · **Against:** `docs/PRD.md` MVP scope (§6, §80) · **Commit:** Phase 8

Nothing is marked PASS unless I observed it working. Requirements verified only by reading code are marked PARTIAL and say so.

## Verdict

**The core game works end to end and is release-ready pending deployment.** PRD §80's Definition of MVP Done is met for the guest/player path, verified by an automated three-context browser test. Two items are outstanding: AI generation is unverified (no API key) and nothing is deployed yet. Neither blocks the core loop; both are listed under Blockers.

---

## §80 — Definition of MVP Done

> *"A new visitor can: open site, choose an existing Game, start a Room, invite another person, second person joins without registration, both receive Cards, host starts, Player marks Squares, updates appear live, system accurately detects Bingo, winner appears for all Players, host ends Room."*

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Open site | **PASS** | Home page renders live data; 200 on `/`, `/explore` |
| 2 | Choose an existing Game | **PASS** | 8 starter games, 40 squares each, browsable and filterable |
| 3 | Start a Room (no account) | **PASS** | E2E: anonymous visitor starts a room and lands on the host screen |
| 4 | Invite another person | **PASS** | QR code + copy link + Web Share, join URL works |
| 5 | Second person joins without registration | **PASS** | E2E: two players join with nickname only |
| 6 | Both receive Cards | **PASS** | E2E asserts 25 tiles each; independent shuffles verified in integration tests |
| 7 | Host starts | **PASS** | E2E: Start → controls become Pause/End, players go LIVE |
| 8 | Player marks Squares | **PASS** | E2E: five tiles marked, `aria-pressed` flips |
| 9 | Updates appear live | **PASS** | E2E: player B sees A's score reach 4 with no reload |
| 10 | System accurately detects Bingo | **PASS** | 33 unit tests + SQL/TS agreement test; E2E completes a real row |
| 11 | Winner appears for all Players | **PASS** | E2E: both A and B see the overlay; B sees "PlayerAnn got bingo" |
| 12 | Host ends Room | **PASS** | E2E: room shows `completed`, players see "This game has ended" |

> §80 also lists a logged-in creator path (create game, add/edit/delete squares, AI suggestions, save, reopen, launch). All of it passes except AI suggestions — see Blockers.

---

## §6 — MVP functionality

### Game creation

| Requirement | Status | Notes |
|---|---|---|
| Create Game Template | **PASS** | Verified in browser: create → draft → editor |
| Enter title / description | **PASS** | Zod bounds enforced (3–80, ≤300) |
| Select category | **PASS** | FK-constrained to the 28 seeded categories |
| Select content level | **PASS** | family / standard / unfiltered |
| Add / edit / delete Square | **PASS** | All three verified in browser |
| AI suggestion endpoint | **PARTIAL** | Built, authenticated, rate-limited, validated. Live model call unverified — no API key. Returns a clean 503. |
| Save Game Template | **PASS** | Publish enforces the 24-square minimum with an exact message |
| Public/private toggle | **PASS** | private / unlisted / public, enforced by RLS |

### Game library

| Requirement | Status | Notes |
|---|---|---|
| Built-in starter Games | **PASS** | 8 games × 40 squares seeded and live |
| User-created Games | **PASS** | My Games with Created/Drafts tabs |
| View Game | **PASS** | `/games/[slug]` with SEO metadata |
| Start Room | **PASS** | From the game detail page |
| Duplicate Game | **PASS** | Atomic RPC; verified copying 40 squares |

### Multiplayer

| Requirement | Status | Notes |
|---|---|---|
| Start Room | **PASS** | |
| Short Room code | **PASS** | 4 digits, collision retry, unique among reachable rooms |
| QR code | **PASS** | Rendered on demand, not stored |
| Join anonymously | **PASS** | No account, no email, no password |
| Choose nickname | **PASS** | Sanitized, 1–24 chars, whitespace-only rejected |
| Unique randomized Card per player | **PASS** | Server-side; integration test asserts two players differ |
| Realtime Room updates | **PASS** | Broadcast from the database; E2E proves cross-client updates |
| Mark / unmark Square | **PASS** | Atomic, optimistic UI with revert |
| Live score / progress | **PASS** | Recomputed server-side every toggle |
| Bingo detection | **PASS** | Server-authoritative |
| Winner event | **PASS** | First-writer-wins settlement |
| Continue after Bingo | **PASS** | Integration test covers both settings |
| End Room | **PASS** | |

### Host

| Requirement | Status | Notes |
|---|---|---|
| View Players | **PASS** | Live list with scores |
| Start / Pause / Resume / End | **PASS** | State machine enforced in SQL |
| Remove Player | **PASS** | E2E: removed player cannot rejoin |
| Select win mode | **PASS** | classic / blackout at room creation |
| Copy Room link | **PASS** | |
| Display QR code | **PASS** | |

### Authentication

| Requirement | Status | Notes |
|---|---|---|
| Accounts only for saved Games / library / editing | **PASS** | Creators sign in; players never do |
| Players stay anonymous | **PASS** | Guest token only |

---

## Security review

| Area | Status | Evidence |
|---|---|---|
| No secret in the client bundle | **PASS** | `scripts/scan-secrets.js`: 38 bundle files + 121 tracked files scanned, no server secret present |
| `.env` files git-ignored | **PASS** | Confirmed by `git check-ignore` |
| RLS on every exposed table | **PASS** | `scripts/verify-rls.js`: anonymous key reads 0 rows from all five gameplay tables |
| No anonymous writes | **PASS** | INSERT → 401 on all nine tables; DELETE removed 0 rows from all nine |
| Unpublished games hidden | **PASS** | 0 unpublished games visible anonymously |
| Internal DB functions not callable | **PASS** | `generate_player_card`, `hash_guest_token`, `is_room_host`, `card_has_bingo` all 404 to clients |
| Server-side authorization on mutations | **PASS** | Every game mutation re-checks `creator_id`; every room mutation authorizes by guest token or `auth.uid()` inside the RPC |
| Guest player authorization | **PASS** | Opaque 32-byte token, sha256-hashed at rest, httpOnly cookie; integration tests prove a stranger's token cannot read a snapshot or mark a card |
| Host-only actions enforced server-side | **PASS** | Integration test: a player's token is refused for start/remove |
| AI endpoint requires auth | **PASS** | 401 unauthenticated, verified live |
| AI rate limiting | **PARTIAL** | Works per instance; **not distributed** — see Non-blocking issues |
| Realtime payloads leak no cards | **PASS** | Test asserts no square text appears in any broadcast |

---

## Quality gates

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` | 113 passing (unit + live integration) |
| `npm run e2e` | 3 passing, including the §73 mandatory scenario |
| `npm run build` | clean |

---

## Blockers

| # | Blocker | Impact | Needs |
|---|---|---|---|
| 1 | `AI_API_KEY` not set | AI generation unverified end to end | An Anthropic API key with credits |
| 2 | Not deployed | §74 phone-to-phone testing impossible; §80 assumes a real URL | Vercel project + production env vars + Supabase redirect URLs |

## Non-blocking issues

1. **AI rate limiter is in-memory.** Per-instance, so on multiple serverless instances the real ceiling is limit × instances. Move to Postgres or Redis before meaningful traffic. Documented in the code.
2. **No "one square away" (🔥) indicator.** Removed in Phase 3 because it was inferred from score, which is not what one-away means. Correct implementation needs line analysis exposed per player; deferred deliberately.
3. **Long square text truncates on small tiles.** Clamped to four lines at 375 px. Readable, but the longest seeded squares lose a few words.
4. **Data retention (§57) not implemented.** No pruning of completed rooms yet; rooms carry a 12-hour `expires_at` but nothing sweeps them.
5. **Analytics events (§58) not implemented.** Deliberately out of MVP scope.
6. **Presence counts viewers, not distinct people.** Two tabs from one player count twice. Cosmetic.
7. **Free-tier Supabase pauses after 7 days idle.** Operational, not a defect.

## Notes on the audit itself

Two of the bugs fixed during this phase were found only because verification was done against a real browser and a real database rather than by reading code:

- Ending a game 404'd the host and made the "This game has ended" screen unreachable (fixed, migration 0010).
- A valid session for a deleted user broke joining entirely (fixed in Phase 7, migration 0009).

One probe result was a false alarm worth recording: PostgREST returns **204 on a DELETE that matched zero rows**, so an anonymous DELETE *looks* successful under RLS. The check now compares row counts before and after rather than trusting the status code.
