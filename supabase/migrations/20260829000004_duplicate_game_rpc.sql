-- Atomic Duplicate Game (PRD §6 MVP, §47 RPCs, §53 remix lineage).
-- SECURITY DEFINER bypasses RLS, so access is checked explicitly:
--   caller must be authenticated, and the source template must be readable
--   to them (published public/unlisted, or their own).
-- The copy is always a private draft owned by the caller.

create or replace function public.duplicate_game_template(source_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.game_templates%rowtype;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into src
  from public.game_templates
  where id = source_id
    and (
      (visibility in ('public', 'unlisted') and status = 'published')
      or creator_id = auth.uid()
    );

  if not found then
    raise exception 'game not found or not accessible';
  end if;

  insert into public.game_templates
    (creator_id, title, description, category, content_rating,
     visibility, status, card_size, free_center, source_game_template_id)
  values
    (auth.uid(), left(src.title || ' (Copy)', 80), src.description, src.category,
     src.content_rating, 'private', 'draft', src.card_size, src.free_center, src.id)
  returning id into new_id;

  insert into public.game_squares
    (game_template_id, text, points, difficulty, sort_order, is_active)
  select new_id, s.text, s.points, s.difficulty, s.sort_order, s.is_active
  from public.game_squares s
  where s.game_template_id = src.id and s.is_active;

  return new_id;
end;
$$;

revoke execute on function public.duplicate_game_template(uuid) from public, anon;
grant execute on function public.duplicate_game_template(uuid) to authenticated;
