-- G-17 ratings (PRD §54) and G-19 saved games (PRD §42).

-- ---------------------------------------------------------------------------
-- game_ratings
-- ---------------------------------------------------------------------------
create table if not exists public.game_ratings (
  id uuid primary key default gen_random_uuid(),
  game_template_id uuid not null references public.game_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_template_id, user_id)
);

create index if not exists game_ratings_game_idx on public.game_ratings (game_template_id);

alter table public.game_ratings enable row level security;

-- Aggregates are public; individual votes are not.
create policy "ratings are readable"
  on public.game_ratings for select
  using (true);

create policy "users rate as themselves"
  on public.game_ratings for insert
  with check (auth.uid() = user_id);

create policy "users change their own rating"
  on public.game_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users withdraw their own rating"
  on public.game_ratings for delete
  using (auth.uid() = user_id);

create trigger game_ratings_updated_at
  before update on public.game_ratings
  for each row execute function public.set_updated_at();

/** Upsert so re-rating replaces rather than fails (§54: one vote per user). */
create or replace function public.rate_game(
  p_game_template_id uuid,
  p_rating integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.current_user_id();
  v_avg numeric;
  v_count integer;
begin
  if v_user is null then
    raise exception 'sign in to rate';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be 1 to 5';
  end if;
  if not exists (
    select 1 from public.game_templates
    where id = p_game_template_id and status = 'published'
  ) then
    raise exception 'game not found';
  end if;

  insert into public.game_ratings (game_template_id, user_id, rating)
  values (p_game_template_id, v_user, p_rating)
  on conflict (game_template_id, user_id)
  do update set rating = excluded.rating, updated_at = now();

  select round(avg(rating), 2), count(*) into v_avg, v_count
  from public.game_ratings where game_template_id = p_game_template_id;

  return jsonb_build_object('average', v_avg, 'count', v_count, 'yours', p_rating);
end;
$$;

grant execute on function public.rate_game(uuid, integer) to authenticated;

/** Public aggregate plus the caller's own vote, if any. */
create or replace function public.game_rating(p_game_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'average', coalesce(round(avg(rating), 2), 0),
    'count', count(*),
    'yours', (
      select rating from public.game_ratings
      where game_template_id = p_game_template_id
        and user_id = public.current_user_id()
    )
  )
  from public.game_ratings
  where game_template_id = p_game_template_id;
$$;

grant execute on function public.game_rating(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- game_saves — the "Saved" tab (PRD §42)
-- ---------------------------------------------------------------------------
create table if not exists public.game_saves (
  id uuid primary key default gen_random_uuid(),
  game_template_id uuid not null references public.game_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_template_id, user_id)
);

create index if not exists game_saves_user_idx on public.game_saves (user_id, created_at desc);

alter table public.game_saves enable row level security;

-- A save list is private to its owner.
create policy "users read their own saves"
  on public.game_saves for select
  using (auth.uid() = user_id);

create policy "users add their own saves"
  on public.game_saves for insert
  with check (auth.uid() = user_id);

create policy "users remove their own saves"
  on public.game_saves for delete
  using (auth.uid() = user_id);

/** Toggles a save, returning the resulting state. */
create or replace function public.toggle_save(p_game_template_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.current_user_id();
  v_existing uuid;
begin
  if v_user is null then
    raise exception 'sign in to save';
  end if;

  select id into v_existing from public.game_saves
  where game_template_id = p_game_template_id and user_id = v_user;

  if v_existing is not null then
    delete from public.game_saves where id = v_existing;
    return jsonb_build_object('saved', false);
  end if;

  if not exists (
    select 1 from public.game_templates
    where id = p_game_template_id and status = 'published'
  ) then
    raise exception 'game not found';
  end if;

  insert into public.game_saves (game_template_id, user_id)
  values (p_game_template_id, v_user);
  return jsonb_build_object('saved', true);
end;
$$;

grant execute on function public.toggle_save(uuid) to authenticated;
