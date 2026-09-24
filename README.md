# SPOT — Social People-Watching Bingo

Turn airports, fairs, games, bars and everyday people-watching into live
multiplayer bingo. A host starts a room, players join by QR code or a 4-digit
code with no account, and everyone gets a different card from the same pool.

**Live:** https://spot-game-green.vercel.app

## Port 3001 — please keep it that way

> **This project always runs on port 3001.** Another app on this machine uses
> 3000. A stale server on 3000 once caused every end-to-end test to run against
> a different codebase and fail confusingly, so this is pinned in several
> places rather than left to chance:
>
> - `npm run dev` and `npm run start` pass `--port 3001`
> - `playwright.config.ts` targets `http://localhost:3001`
> - `.claude/launch.json` declares port 3001
>
> `GET /api/health` returns `{ app: "spot", commit, env }`. The E2E suite calls
> it before running and **refuses to start** if the port is serving something
> else — so a port collision fails with one clear message instead of a dozen
> misleading test failures.
>
> If 3001 is occupied, stop whatever is using it rather than moving this app.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3001
```

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Origin used for magic-link redirects and QR join URLs |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser key — subject to RLS |
| `SUPABASE_SECRET_KEY` | Server-only; bypasses RLS |
| `AI_API_KEY` | Anthropic key for square generation. Optional — without it the AI endpoint returns a clean 503 and everything else works |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring. Optional — without them errors still go to structured logs. The DSN is public by design |

Anything not prefixed `NEXT_PUBLIC_` is server-only and must never reach the
browser. `scripts/scan-secrets.js` verifies that against the built bundle.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on **3001** |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest — unit plus integration against the live database |
| `npm run e2e` | Playwright: the PRD §73 mandatory multiplayer scenario plus an automated accessibility audit |
| `E2E_BASE_URL=https://… npm run e2e` | Run the suite against a deployment |

`npm run test` includes integration tests that hit the real Supabase project;
they skip automatically when `.env.local` is absent.

## Database

Migrations live in `supabase/migrations` and are applied with:

```bash
npx supabase db push --linked
```

Seed data is `supabase/seed.sql` (28 categories and the original 8 games) plus
the content packs in `supabase/seeds/`. All of it applies together:

```bash
npx supabase db push --linked --include-seed
```

The packs used to be applied by hand, so a fresh environment silently got 8
games instead of 13. `config.toml` now globs `./seeds/*.sql`.

Housekeeping runs hourly inside Postgres via `pg_cron` (`spot-maintenance`):
expired rooms are marked and deleted past 30-day retention. Check it with
`maintenance_status()`.

## Architecture notes

- **The database is authoritative.** Realtime messages are refetch hints, never
  state; every reconnect resyncs rather than replaying missed events.
- **Guests are anonymous.** Players get an opaque server-issued token stored as
  an httpOnly cookie, with only its hash in the database. Gameplay tables are
  deny-all under RLS; all access flows through `SECURITY DEFINER` functions that
  authorize internally.
- **Marking is one atomic transaction** — authorize, toggle, rescore, detect
  bingo, record the event, settle the winner.

## Documentation

| File | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Requirements, source of truth |
| [docs/BUILD_STATUS.md](docs/BUILD_STATUS.md) | What was built, phase by phase |
| [docs/GAP_LIST.md](docs/GAP_LIST.md) | Everything not yet built, prioritised |
| [docs/BUG_LIST.md](docs/BUG_LIST.md) | Defects, root causes, and fixes |
| `node scripts/metrics.js` | Product metrics, moderation queue and housekeeping status |
| `node scripts/apply-seed.js <seed.sql> <game_id>` | Force one seed file's squares into the database. Needed because `db push --include-seed` can record a changed seed's hash without re-running it |
| `node scripts/set-tier.js <email> <free\|supporter> [--days N]` | Grant or clear an account's tier. There is no checkout yet, so this is how a supporter is made — and it needs the service role, because nothing can grant a tier through the API |
| [docs/RELEASE_AUDIT.md](docs/RELEASE_AUDIT.md) | MVP requirements marked PASS/PARTIAL |
| [docs/PHONE_TEST.md](docs/PHONE_TEST.md) | Two-device test checklist — the last MVP acceptance step |
