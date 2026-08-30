# SPOT — Bug List

Defects found in testing, with root cause and how they were verified fixed. **[GAP_LIST.md](GAP_LIST.md)** tracks work that was never built; this file tracks things that were built wrong.

## How to use this file

- Add a row the moment a bug is observed, before fixing it. IDs are stable (`B-01`) — never renumber or delete.
- Severity: **Critical** = blocks the core game · **Major** = a feature is broken or misleading · **Minor** = cosmetic or edge case.
- Record the **root cause**, not just the symptom — the cause is what stops it recurring.
- Note **how it was caught**. A bug that only manual testing found is an argument for more of that kind of testing.

---

## Open

| ID | Sev | Bug | Notes |
|---|---|---|---|
| B-11 | Minor | **Long square text truncates on small tiles.** Clamped to four lines at 375 px, so the longest seeded squares lose a few words. | Readable, but the full text isn't visible. Consider a tap-to-expand or shorter seed copy. |

## Fixed

| ID | Sev | Bug | Root cause | Caught by | Fixed |
|---|---|---|---|---|---|
| B-01 | Critical | **The host had no bingo card.** Host's board rendered empty, violating PRD §80 ("both receive Cards"). | `create_room` created the host's `room_players` row but never called `generate_player_card`. | Manual browser testing in Phase 3 — the host screen was visibly empty. | Migration `0006`; regression test asserts the host snapshot has 25 squares. |
| B-02 | Major | **False 🔥 "one square away" indicator.** Showed on players with an empty card. | Inferred from `score >= totalSquares - 1`. That is not what "one square from bingo" means, and with a 0-length card `0 >= -1` is true. | Manual browser testing — appeared on a player with score 0. | Indicator removed rather than papered over; correct implementation needs line analysis. Tracked as G-14. |
| B-03 | Minor | **Unmapped RPC errors were swallowed.** Any database error not explicitly mapped became "Something went wrong. Try again." with no trace. | The `friendly()` mapper had no fallback logging. | Debugging B-04 — the real cause was invisible. | Unmapped messages now `console.error` server-side while the user still sees a friendly message. Directly enabled diagnosing B-04. |
| B-04 | Critical | **A valid session for a deleted user broke joining and hosting entirely.** Users saw only "Something went wrong" with no way to recover except clearing cookies. | A Supabase session token stays cryptographically valid until expiry, so `auth.uid()` can name a `auth.users` row that no longer exists (account deletion — which PRD §57 requires supporting — or a database restore). `room_players.user_id` then failed its foreign key. | Manual browser testing, twice. **The first occurrence was misdiagnosed as test-environment noise**; only the second forced a real diagnosis. | Migration `0009`: `create_room`/`join_room` resolve the caller through `auth.users`, so a stale token degrades to anonymous guest identity. Regression test creates a user, takes a live session, deletes the user, and asserts the join still succeeds. |
| B-05 | Major | **A blank environment variable took down unrelated features.** `AI_API_KEY=` sitting in `.env.local` awaiting a value failed validation and broke *every* caller of `serverEnv()`, including the admin Supabase client. | The Zod schema used `.min(1).optional()`, so an empty string was an invalid value rather than an absent one. | Found while preparing the file for the user's API key — anticipated rather than hit in production. | Blank and whitespace-only values now parse as `undefined`; blank **required** variables still fail loudly by name. Three tests cover it. |
| B-06 | Critical | **Ending a game 404'd everyone, including the host who ended it.** The "This game has ended" screen (PRD §64) was unreachable code. | Room pages resolved the room via `get_join_info`, which deliberately filters to joinable rooms (`lobby`/`active`/`paused`). Completing a room made it unreachable to people already in it. | The Playwright E2E suite's final assertion, on its first run. | Migration `0010` adds `resolve_room_id`, status-agnostic, for participants; `get_join_info` still refuses to let anyone *join* a completed room. |
| B-10 | Minor | **Presence counted browser tabs, not people.** Two tabs from one player showed "2 online". | Presence is keyed per connection, not per person. | Noticed while reviewing the realtime code. | Sync handler now counts distinct `playerId` values. |
| B-14 | Major | **Body copy rendered in a fallback serif everywhere, since the project was scaffolded.** | `--font-sans` in the Tailwind theme block was defined as `var(--font-sans)` — self-referential, so it never resolved to Geist and the browser fell back to its default serif. Present in every screenshot from Phase 1 onward and never noticed, because a serif still looks deliberate. | Spotted while reviewing the first styled screenshot side by side with the intended type. | Mapped to `var(--font-geist-sans)`. |
| B-13 | Major | **Two WCAG AA contrast failures.** Destructive button text was 4:1 on its own tint, and muted text 4.34:1 on a muted background — both under the 4.5:1 minimum. | Inherited from the shadcn base-nova palette; never measured. | The automated axe pass added for G-11, on its first run. | Darkened `--destructive` and `--muted-foreground` (and adjusted their dark-theme counterparts). The axe suite now guards against regressions. |
| B-07 | Major | **Your own score went stale after marking — production only.** The tile flipped, but score and leaderboard row didn't update until a manual reload. | `PlayBoard` (after a mark) and `RoomLive` (on every broadcast) each called `router.refresh()` independently. Under real network latency these overlapped and **aborted each other**, and the cancelled one was usually the last — so the final state never rendered. Localhost resolved fast enough to hide it completely. | Manual two-client verification against production, after deploy. **Localhost testing could never have found this.** | `lib/room-refresh.ts` — one trailing-edge debounced scheduler shared by both components. Re-verified live. |

---

## Test-side false alarms

Not product bugs — mistakes in the tests or probes themselves. Recorded because each one could easily be believed.

| ID | What looked wrong | What was actually true |
|---|---|---|
| B-08 | A unit test asserting "24 of 25 marked squares is not a bingo" failed. | **The test premise was impossible.** Removing a single square cannot break all 12 winning lines. The meaningful near-miss is 20 of 25 with the anti-diagonal left empty, which breaks every line. Test rewritten. |
| B-09 | The RLS probe reported that anonymous users could DELETE from all nine tables (HTTP 204). | **Nothing was deleted.** PostgREST returns 204 for a DELETE that matched *zero* rows, and RLS filters rows silently — so "blocked" and "deleted everything" look identical from the status code. Seed counts were unchanged (28/8/320). The probe now compares row counts before and after. |
| B-12 | Every E2E test failed at once, including the simplest one, right after a set of unrelated changes. | **Another session's dev server was occupying port 3000**, running older code — it 404'd on the AI route entirely. Playwright's `reuseExistingServer` happily reused it, so the suite was testing a different build. The config now defaults to port **3100** and starts its own server, so it cannot silently reuse someone else's. |
| B-10a | Playwright against the deployment failed at a different step every run — sometimes the first navigation, sometimes a board assertion. | Two harness problems, not app defects: `waitForLoadState("networkidle")` **never settles** on pages holding a Supabase realtime WebSocket, and repeated three-context runs against a live deployment contend for local browser resources. Production responds in under a second and was verified deliberately with two real clients. The suite is a localhost gate. |
| B-11a | A database check right after a production mark showed the score still 0, suggesting the write had failed. | **The check raced the write.** A moment later the value was correct. The real defect nearby was B-07 (the UI not refreshing), which this nearly masked. |

---

## Patterns worth remembering

Three of the four **Critical/Major** product bugs above were found by **driving a real browser against a real database**, not by unit tests — and B-07 was only findable **against production**, because latency was the trigger. The test suite is genuinely valuable (113 tests caught plenty during development), but it did not find the bugs that would have most embarrassed a launch.

The other recurring lesson: **a status code is not a result.** B-09 (204 on a blocked DELETE) and B-11a (a read racing a write) both came from trusting a signal instead of checking the actual state.
