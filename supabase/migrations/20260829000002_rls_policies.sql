-- SPOT — Row Level Security (PRD §9, §46)
--
-- RLS is enabled on EVERY exposed table. Room/gameplay tables are
-- deliberately locked down to deny-all for anonymous/direct access: guests
-- have no auth.uid(), so all room mutations and card reads flow through
-- validated server-side operations (RPCs / server routes) added in Phases 3–5.
-- A table with RLS enabled and no policy denies everything to the
-- publishable-key client, which is the intended Phase 1 posture.

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.game_templates      enable row level security;
alter table public.game_squares        enable row level security;
alter table public.rooms               enable row level security;
alter table public.room_players        enable row level security;
alter table public.player_cards        enable row level security;
alter table public.player_card_squares enable row level security;
alter table public.room_events         enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: public basic profile read; owners manage their own row
-- ---------------------------------------------------------------------------
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- categories: readable by everyone; writes are admin-only (no policy)
-- ---------------------------------------------------------------------------
create policy "active categories are publicly readable"
  on public.categories for select
  using (active);

-- ---------------------------------------------------------------------------
-- game_templates (PRD §45, §46)
--  public    → discoverable by anyone once published
--  unlisted  → readable by anyone who has the direct link (id/slug lookup);
--              discovery UIs must filter to visibility = 'public'
--  private   → creator only
-- ---------------------------------------------------------------------------
create policy "published public and unlisted templates are readable"
  on public.game_templates for select
  using (
    (visibility in ('public', 'unlisted') and status = 'published')
    or creator_id = auth.uid()
  );

create policy "authenticated users create their own templates"
  on public.game_templates for insert
  with check (auth.uid() is not null and creator_id = auth.uid());

create policy "creators update their own templates"
  on public.game_templates for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "creators delete their own templates"
  on public.game_templates for delete
  using (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- game_squares: visibility follows the parent template
-- ---------------------------------------------------------------------------
create policy "squares of readable templates are readable"
  on public.game_squares for select
  using (
    exists (
      select 1 from public.game_templates t
      where t.id = game_template_id
        and (
          (t.visibility in ('public', 'unlisted') and t.status = 'published')
          or t.creator_id = auth.uid()
        )
    )
  );

create policy "creators insert squares on their templates"
  on public.game_squares for insert
  with check (
    exists (
      select 1 from public.game_templates t
      where t.id = game_template_id and t.creator_id = auth.uid()
    )
  );

create policy "creators update squares on their templates"
  on public.game_squares for update
  using (
    exists (
      select 1 from public.game_templates t
      where t.id = game_template_id and t.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.game_templates t
      where t.id = game_template_id and t.creator_id = auth.uid()
    )
  );

create policy "creators delete squares on their templates"
  on public.game_squares for delete
  using (
    exists (
      select 1 from public.game_templates t
      where t.id = game_template_id and t.creator_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- rooms: hosts may read their own rooms directly. All mutations and all
-- guest access go through validated server operations (Phases 3–5).
-- ---------------------------------------------------------------------------
create policy "hosts read their own rooms"
  on public.rooms for select
  using (host_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- room_players: hosts see their room's players; signed-in players see
-- themselves. Score/role/status/has_bingo are server-controlled — no
-- client-side insert/update/delete policies exist.
-- ---------------------------------------------------------------------------
create policy "hosts and the player themselves read room_players"
  on public.room_players for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- player_cards / player_card_squares / room_events:
-- no policies — deny-all for direct client access. Cards are created and
-- marked exclusively through validated transactional server operations, and
-- guests (who have no auth identity) are authenticated there by guest token.
-- ---------------------------------------------------------------------------
