-- G-04 in couples-game's tracker: this project shares its Supabase project
-- (and therefore auth.users) with couples-game, a sibling app in the same
-- bingo family (see couples-game/docs/SHARED_BACKEND.md — the two apps are
-- deliberately one backend, one identity, to keep infrastructure small).
--
-- handle_new_user() fires on every insert into auth.users, unconditionally.
-- Left alone, a couples-game signup would create a SPOT profile row too —
-- and SPOT profiles are publicly readable, with a display name defaulted
-- from the signer-upper's email address. A couples-game account should never
-- produce a public, discoverable SPOT identity as a side effect.
--
-- The fix: sibling apps tag their signup calls with app-specific metadata
-- (`options: { data: { app: 'couples' } } }` on signInWithOtp/signUp), which
-- Postgres sees as NEW.raw_user_meta_data. This trigger skips SPOT's own
-- profile creation for any signup tagged with an app other than SPOT's own —
-- an allowlist-shaped check (only 'couples' is excluded today) would work
-- just as well now, but a denylist reads correctly for "SPOT profiles are
-- the default, siblings opt out" and needs no edit when a third app joins
-- the family later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'app' is not null
     and new.raw_user_meta_data ->> 'app' <> 'spot' then
    return new;
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, 'player'), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;
