<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SPOT — project conventions

## Port 3001 is reserved for this project

**Always run this app on port 3001. Never 3000.** Another application on this
machine uses 3000, and a stale server there once caused the entire E2E suite to
run against a different codebase and fail in confusing ways (BUG_LIST B-12).

- `npm run dev` and `npm run start` pin `--port 3001`; don't override them.
- Playwright defaults to `http://localhost:3001` and refuses to run if
  `/api/health` doesn't identify the app as `spot`.
- If something else is on 3001, stop that instead of moving this app.

`GET /api/health` returns `{ app: "spot", commit, env }` — use it to confirm
which server is answering before trusting a port.

## Where things are

| Doc | Purpose |
|---|---|
| `docs/PRD.md` | Requirements, source of truth |
| `docs/BUILD_STATUS.md` | What's built, phase by phase |
| `docs/GAP_LIST.md` | Everything not yet built (G-nn, prioritised) |
| `docs/BUG_LIST.md` | Defects with root causes (B-nn) |
| `docs/RELEASE_AUDIT.md` | MVP requirements marked PASS/PARTIAL |
| `docs/FUNDRAISER_LEGAL.md` | Where paid-entry fundraisers become gambling. Read before any money-for-prizes feature |

## Non-obvious rules

- **The database is authoritative.** Realtime broadcasts are "something changed,
  refetch" hints, never state. Never reconstruct game state from events.
- **Guests have no `auth.uid()`.** Gameplay tables are deny-all under RLS; all
  access goes through `SECURITY DEFINER` functions that authorize by guest token
  internally. Don't add client-side queries against those tables.
- **Never bypass RLS for convenience.** The service-role client is server-only
  (`lib/supabase/admin.ts`, guarded by `server-only`) and is for trusted paths
  and scripts, not for making a feature easier.
- **Room refreshes go through `useRoomRefresh()`.** Independent `router.refresh()`
  calls abort each other under real latency (B-07).
- **Secrets never reach the client.** `scripts/scan-secrets.js` enforces this;
  run it after touching env handling.
- **Never build paid entry for a game with prizes.** Consideration + chance +
  prize is gambling, and SPOT deals a random card. Do not add entry fees, a
  per-player or percentage cut, prize pots, or payout handling — and do not
  describe SPOT as being for raffles, wagers or cash prizes — without reading
  `docs/FUNDRAISER_LEGAL.md` first and getting the sign-off it names. There are
  safe fundraiser shapes in there; the tempting one is the unsafe one.
- Migrations are committed and applied with `npx supabase db push --linked`.
