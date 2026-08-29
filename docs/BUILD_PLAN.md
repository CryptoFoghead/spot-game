# SPOT — Build Plan

Implementation checklist mapping every MVP requirement (PRD §6, §80) to database, backend, frontend, realtime, and tests. Phases follow PRD §81 build order. Nothing outside the MVP scope (PRD §7) gets built until §80's Definition of Done passes.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 1 — Foundation

| Requirement | Database | Backend | Frontend | Realtime | Tests |
|---|---|---|---|---|---|
| Project scaffold | — | Next.js 16 App Router, TS strict | Tailwind v4, shadcn/ui, Lucide | — | Vitest harness installed |
| Env validation | — | `lib/env.ts` (Zod, server/client split, lazy) | — | — | unit: schema accepts/rejects |
| Supabase clients | — | `lib/supabase/client.ts`, `server.ts`, `admin.ts` (@supabase/ssr) | — | — | — |
| Full schema | migration `0001_initial_schema.sql`: profiles, categories, game_templates, game_squares, rooms, room_players, player_cards, player_card_squares, room_events + CHECKs, indexes, updated_at triggers | — | — | — | — |
| RLS (PRD §46) | migration `0002_rls_policies.sql`: RLS enabled on every table; policies per §46 | — | — | — | — |
| Seed categories (PRD §12) | `seed.sql`: 28 categories | — | — | — | — |
| Seed starter games (PRD §39, §70) | `seed.sql`: 8 games × ~40 squares, published/public, no creator | — | — | — | — |
| Layout/navigation | — | — | root layout, mobile-first header/nav, placeholder home | — | — |

**Phase 1 checklist**
- [ ] Next.js 16 App Router + TypeScript strict
- [ ] Tailwind CSS
- [ ] shadcn/ui init + base components (button, card, input, label, badge)
- [ ] Supabase browser/server/admin clients
- [ ] Environment variable validation (build-safe when unset; loud at runtime)
- [ ] Migration: complete initial schema (PRD §11–§17)
- [ ] Migration: RLS on all tables (PRD §46)
- [ ] Seed: categories
- [ ] Seed: starter games with 40+ squares each
- [ ] Foundational layout + navigation
- [ ] lint / typecheck / test / production build all clean
- [ ] BUILD_STATUS.md updated, commit

---

## Phase 2 — Game Library & Creator (no realtime)

| MVP requirement | Database | Backend | Frontend | Realtime | Tests |
|---|---|---|---|---|---|
| Auth: magic link (+Google later) | profiles trigger on auth.users insert | Supabase Auth, `/auth/callback` route handler | `/login` page | — | — |
| Home page (PRD §40) | — | server component queries public games | hero, Start Playing / Create / Join-code input, popular games, category chips | — | e2e later |
| Game detail (PRD §41) | — | fetch by slug (public/unlisted) or owner | `/games/[slug]`: title, rating, square count, Start/Preview/Duplicate, Edit if owner | — | — |
| Basic explore | — | list published public templates | grid + category filter | — | — |
| My Games (PRD §42) | — | owner-scoped queries | `/dashboard/games`: Created/Drafts tabs, card actions | — | — |
| Create/Edit Game (PRD §35) | — | server actions: create/update template (Zod, ownership enforced) | `/create` 3-step wizard, `/games/[id]/edit` | — | integration: ownership rejected for non-owner |
| Square add/edit/delete | — | server actions with Zod (2–180 chars) | SquareList / SquareEditor | — | unit: validation bounds |
| Visibility toggle | visibility CHECK already in schema | server action | Private/Unlisted/Public selector | — | — |
| Content level select | content_rating CHECK | server action | Family/Standard/Unfiltered selector | — | — |
| Duplicate Game | source_game_template_id column (schema-ready) | server action: deep-copy template + squares | Duplicate button | — | integration: copy owns squares |
| Save Game Template | — | publish action: validates ≥24 active squares | Save/Publish CTA + counter | — | unit: min-square rule |

---

## Phase 3 — Room Creation & Join

| MVP requirement | Database | Backend | Frontend | Realtime | Tests |
|---|---|---|---|---|---|
| Start Room | `create_room()` RPC: validates template, ≥24 squares, generates code, creates room + host player | server action wrapping RPC | Start Game button → `/room/[code]/host` | — | integration: RPC validations |
| Room code (PRD §20) | 4-digit unique among active rooms, retry on collision | in `create_room()` | shown on host screen | — | unit: format; integration: uniqueness retry |
| QR + join URL (PRD §21) | — | — | `qrcode`-rendered QR for `/join/[code]`, Copy Link | — | — |
| Join anonymously (PRD §10, §19, §49) | `join_room()` RPC: validates room, creates room_player + card, stores guest_token hash | route/action issues opaque guest token, httpOnly cookie | `/join/[code]`: game title, rating, nickname, JOIN | — | integration: join flow, replay protection |
| Nickname (PRD §14) | 1–24 char constraint | Zod sanitization (control chars, whitespace-only) | input with validation | — | unit: nickname rules |
| Unique randomized card (PRD §18) | card generation inside `join_room()` (server-side shuffle, 24+FREE or 25) | — | — | — | unit: count, no dupes, FREE center, independence |
| Lobby (PRD §33) | — | room snapshot query | host + player lobby views | polling fallback until Phase 5 | e2e later |
| Host: view players / remove | `remove_player()` RPC (host-only) | server action | player list + remove | — | integration: non-host rejected |

## Phase 4 — Gameplay (authoritative, pre-realtime)

| MVP requirement | Database | Backend | Frontend | Realtime | Tests |
|---|---|---|---|---|---|
| Start/pause/resume/end (PRD §22, §44) | `start_room()`, `pause_room()`, `resume_room()`, `end_room()` RPCs; state-machine transitions enforced | host-authorized server actions | host controls | — | unit: legal/illegal transitions |
| Mark/unmark square (PRD §23) | `toggle_square()` RPC: atomic — auth, room active, card ownership, toggle, recount, bingo calc, room_event, winner | server action / route | tap tile, optimistic UI + revert toast (PRD §28) | — | integration: atomicity, foreign-card rejection, inactive-room rejection |
| Bingo detection (PRD §24) | server-side inside `toggle_square()` (rows/cols/diagonals, blackout) | shared `lib/game/bingo.ts` mirrored in SQL | client-side visual hint only | — | unit: every row, column, both diagonals, FREE center, blackout, no false positive |
| Live score (PRD §50) | score = marked non-free count, computed in RPC | — | You/Leader header, leaderboard drawer (PRD §32) | — | unit: scoring |
| Winner event (PRD §25) | first-winner transaction in `toggle_square()` | — | winner overlay (PRD §34) | — | integration: only first winner recorded |
| Continue after bingo | continue_after_win on rooms | respected in `toggle_square()`/`end` logic | Keep Playing / End Game | — | integration |
| Board UX (PRD §30–31) | — | — | 5×5 grid-cols-5, whole tile tappable, marked state | — | — |

## Phase 5 — Realtime

| MVP requirement | Database | Backend | Frontend | Realtime | Tests |
|---|---|---|---|---|---|
| Live room updates | room_events already written by RPCs | broadcast after successful mutation | subscribe on play/host/lobby screens | Broadcast on `room:{room_id}`: PLAYER_JOINED/LEFT/REMOVED, ROOM_STARTED/PAUSED/RESUMED/ENDED, SQUARE_MARKED/UNMARKED, PLAYER_PROGRESS, BINGO | e2e: two contexts, A's mark visible to B |
| Presence (PRD §27) | — | — | online dots in player list | Presence: playerId, nickname, role — UI only | — |
| Reconnect (PRD §29) | `get_room_snapshot()` RPC | snapshot endpoint | on reconnect: refetch snapshot + own card, reconcile | channel rejoin handling | e2e: refresh mid-game recovers state |
| DB authoritative | — | broadcasts carry hints, never truth | — | — | — |

## Phase 6 — AI Creation

| MVP requirement | Database | Backend | Frontend | Realtime | Tests |
|---|---|---|---|---|---|
| AI suggestion endpoint (PRD §36–38) | — | `POST /api/ai/generate-squares`: authed creators only, rate-limited, structured JSON, Zod-validated, system prompt from §37, rating rules §38, duplicate filtering | Generate Ideas / Add 10 / edit / delete suggestions in wizard | — | unit: response validation, dedupe; integration: unauthenticated 401, rate limit 429 |

## Phase 7 — Polish · Phase 8 — QA · Phase 9 — Deploy

- Loading/empty/error states, friendly errors (PRD §64), share sheet (§77), connection indicator, winner celebration, accessibility pass (§63), responsive test at 375/390/430px (§62).
- Full QA: lint, typecheck, unit, integration, Playwright e2e of PRD §73 scenario, production build, manual multi-device test (§74), secret exposure + RLS + authorization review.
- Deploy: production Supabase, apply migrations, Vercel env vars, auth redirect URLs, phone-to-phone verification.

---

## Cross-cutting rules (all phases)

- All authorization server-side; RLS never bypassed for convenience (client never uses service key).
- Multi-step mutations go through transactional RPCs (PRD §47).
- Zod on every input boundary (PRD §69).
- Guest identity = server-issued opaque token, hash stored, httpOnly cookie; nickname is never identity (PRD §10).
- No TODO placeholders for core functionality; BUILD_STATUS.md updated at every phase end.
