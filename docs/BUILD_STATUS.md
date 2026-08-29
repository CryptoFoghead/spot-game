# BUILD STATUS

**Current phase:** Phase 1 — Foundation ✅ complete
**Next phase:** Phase 2 — Game Library & Creator experience

## Completed features

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

## Migrations

| File | Applied to a database? |
|---|---|
| `supabase/migrations/20260829000001_initial_schema.sql` | ❌ not yet — no Supabase project exists |
| `supabase/migrations/20260829000002_rls_policies.sql` | ❌ not yet |
| `supabase/seed.sql` | ❌ not yet |

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

## Next actions (Phase 2)

1. Create Supabase project; apply both migrations + seed.
2. Supabase Auth (magic link) + `/auth/callback` + profile-creation trigger.
3. Home page real data, game detail, explore, My Games, create/edit wizard, square editor, duplicate.
