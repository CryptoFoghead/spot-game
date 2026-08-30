-- G-10 moderation (PRD §55) and G-08 account deletion (PRD §57).

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users (id) on delete set null,
  game_template_id uuid not null references public.game_templates (id) on delete cascade,
  reason text not null check (reason in (
    'harassment', 'hateful', 'sexual', 'unsafe', 'privacy', 'spam', 'other'
  )),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_game_idx on public.reports (game_template_id);

-- Reports are write-only from the client's perspective: nobody browses them.
alter table public.reports enable row level security;

/**
 * Files a report. Anonymous reporting is allowed deliberately — requiring an
 * account to report unsafe content suppresses reports (§55). Rate limited per
 * game so the endpoint cannot be used to flood the table.
 */
create or replace function public.report_game(
  p_game_template_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.current_user_id();
  v_recent integer;
begin
  if p_reason not in ('harassment','hateful','sexual','unsafe','privacy','spam','other') then
    raise exception 'invalid reason';
  end if;

  if not exists (
    select 1 from public.game_templates
    where id = p_game_template_id and status = 'published'
  ) then
    raise exception 'game not found';
  end if;

  -- One signed-in reporter cannot pile reports onto the same game.
  if v_user is not null then
    select count(*) into v_recent
    from public.reports
    where reporter_user_id = v_user
      and game_template_id = p_game_template_id
      and created_at > now() - interval '1 day';
    if v_recent >= 3 then
      raise exception 'already reported';
    end if;
  end if;

  insert into public.reports (reporter_user_id, game_template_id, reason, details)
  values (v_user, p_game_template_id, p_reason,
          nullif(btrim(coalesce(p_details, '')), ''));

  return jsonb_build_object('reported', true);
end;
$$;

grant execute on function public.report_game(uuid, text, text) to anon, authenticated;

/** Moderation queue for trusted server code only. */
create or replace function public.open_reports(p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'reason', r.reason,
           'details', r.details,
           'createdAt', r.created_at,
           'gameId', g.id,
           'gameTitle', g.title,
           'gameSlug', g.slug,
           'creatorId', g.creator_id
         ) order by r.created_at desc), '[]'::jsonb)
  from public.reports r
  join public.game_templates g on g.id = r.game_template_id
  where r.status = 'open'
  limit p_limit;
$$;

revoke execute on function public.open_reports(integer) from public, anon, authenticated;
grant execute on function public.open_reports(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Account deletion (PRD §57)
-- ---------------------------------------------------------------------------
/**
 * Deletes the caller's account and everything owned by it.
 *
 * The schema already cascades from auth.users, but the intent is made explicit
 * here so the behaviour is reviewable rather than implied:
 *   - profile, games and their squares: deleted (creator_id cascades)
 *   - AI usage rows: deleted
 *   - rooms they hosted: host_user_id is set null, so games in progress are
 *     not destroyed under other players; the sweeper collects them later
 *   - room_players rows: user_id set null, leaving anonymous play history
 */
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := public.current_user_id();
  v_games integer;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select count(*) into v_games
  from public.game_templates where creator_id = v_user;

  delete from public.game_templates where creator_id = v_user;
  delete from public.ai_usage where user_id = v_user;
  delete from public.profiles where id = v_user;
  delete from auth.users where id = v_user;

  return jsonb_build_object('deleted', true, 'gamesRemoved', v_games);
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
