-- Nashville — a night on Broadway.
--
-- A place rather than an occasion, which is new for this library. The taxonomy
-- is occasion-based (airport, wedding, office) and a city does not fit it, so
-- this sits in the `bar` category and carries the place in the title. If more
-- city games follow, that is the moment to reconsider the taxonomy, not now.
--
-- Written against the existing Bar & Brewery and Concert cards so nothing
-- repeats: no bare "bachelorette party", no sash, no generic "live music", no
-- filming-a-whole-song. Where the subject overlaps, the square is the
-- specifically Nashville version — three bachelorette parties in one block,
-- music from three doorways at once.
--
-- Same rule as every other pack (PRD §37, §56): the joke is the street, never
-- a person's appearance. Bachelorette parties are an easy target and these
-- squares deliberately are not that.

insert into public.game_templates
  (id, creator_id, title, slug, description, category, content_rating,
   visibility, status, card_size, free_center, published_at)
values
  ('00000000-0000-4000-8000-000000000015', null, 'Nashville Bingo', 'nashville-bingo',
   'Broadway, boots bought that afternoon, and a band in every doorway.',
   'bar', 'standard', 'public', 'published', 5, true, now())
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      content_rating = excluded.content_rating,
      visibility = excluded.visibility,
      status = excluded.status;

delete from public.game_squares
 where game_template_id = '00000000-0000-4000-8000-000000000015';

insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000015', v.text, v.diff, v.ord
from (values
  (1,  'Cowboy boots that are obviously brand new', 'easy'),
  (2,  'A hat bought within the last hour', 'easy'),
  (3,  'Neon stacked three storeys up', 'easy'),
  (4,  'A pedal tavern going past', 'easy'),
  (5,  'Live music coming from three doorways at once', 'easy'),
  (6,  'A tip jar with a hand-lettered sign', 'easy'),
  (7,  'A band playing hard to a nearly empty room', 'easy'),
  (8,  'Someone photographing a mural', 'easy'),
  (9,  'Scooters abandoned on the pavement', 'easy'),
  (10, 'A queue at the bottom of a rooftop staircase', 'easy'),
  (11, 'A cover of "Wagon Wheel"', 'medium'),
  (12, 'Three bachelorette parties inside one block', 'medium'),
  (13, 'A song request folded around a bill', 'medium'),
  (14, 'Someone who moved here to make it, and tells you so', 'medium'),
  (15, 'A bartender who mentions their own record', 'medium'),
  (16, 'Line dancing that nobody organised', 'medium'),
  (17, 'Hot chicken defeating the person who ordered it', 'medium'),
  (18, 'A guitar case being carried down the sidewalk', 'medium'),
  (19, 'A group photo on the honky-tonk stairs', 'medium'),
  (20, 'Somebody''s boots photographed instead of their face', 'medium'),
  (21, 'Two bands audible from a single doorway', 'medium'),
  (22, 'A drink served in a boot-shaped glass', 'medium'),
  (23, 'Someone explaining that the real music is in East Nashville', 'medium'),
  (24, 'A veil worn at noon', 'medium'),
  (25, 'A local visibly steering around Broadway', 'medium'),
  (26, 'Someone asking where the Bluebird is', 'medium'),
  (27, 'Doors propped open to the street in the cold', 'medium'),
  (28, 'A band taking a request they plainly do not enjoy', 'medium'),
  (29, 'A singer selling records from the stage between songs', 'medium'),
  (30, 'Someone on hour six of standing up', 'medium'),
  (31, 'A pedal tavern singalong stopped at a red light', 'medium'),
  (32, 'Full rhinestones, in daylight', 'medium'),
  (33, 'A song from this year played like it is forty years old', 'medium'),
  (34, 'Someone counting how many bars they have been in', 'medium'),
  (35, 'A fiddle player who is plainly the best musician on the street', 'medium'),
  (36, 'A band that plays an original, and says so', 'hard'),
  (37, 'A boot scoot executed perfectly by someone over seventy', 'hard'),
  (38, 'Someone recognising a player from another band''s set', 'hard'),
  (39, 'A proposal, or something that looks a great deal like one', 'hard'),
  (40, 'Somebody giving up on Broadway and announcing a quieter place', 'hard')
) as v(ord, text, diff);
