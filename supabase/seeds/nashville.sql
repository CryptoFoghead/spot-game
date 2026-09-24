-- Nashville — a night on Broadway.
--
-- A place rather than an occasion, which is new for this library. The taxonomy
-- is occasion-based (airport, wedding, office) and a city does not fit it, so
-- this sits in the `bar` category and carries the place in the title.
--
-- REVISED after play feedback: the first cut was too hard. Too many squares
-- needed you to overhear a specific conversation ("someone who moved here to
-- make it, and tells you so"), know local context, make an interpretive call
-- ("a song from this year played like it is forty years old"), or simply get
-- lucky. That is a trivia card, not a people-watching card.
--
-- The rule now: if you cannot settle it by LOOKING, it does not belong. Every
-- square is an outfit, something somebody is doing, or a small human oddity,
-- and the difficulty label means how often you will actually see it rather
-- than how clever it is.
--
-- Written against the existing Bar & Brewery and Concert cards so nothing
-- repeats — no sash, no bare "bachelorette party", no generic live music, no
-- shoulders, no four-drinks-through-a-crowd.
--
-- Same rule as every other pack (PRD §37, §56): the joke is the street, never
-- a person's appearance. These are affectionate — someone having a big night
-- out is not a punchline.

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
  (2,  'A cowboy hat on someone who has clearly never worn one', 'easy'),
  (3,  'A group in matching shirts', 'easy'),
  (4,  'Someone taking a photo of a mural', 'easy'),
  (5,  'A pedal tavern going past', 'easy'),
  (6,  'A bouncer checking an ID with a torch', 'easy'),
  (7,  'A group photo blocking the entire sidewalk', 'easy'),
  (8,  'Someone filming themselves while walking', 'easy'),
  (9,  'A guitar case being carried down the street', 'easy'),
  (10, 'Rhinestones catching the light', 'easy'),
  (11, 'Someone posing while a friend takes fifteen of the same photo', 'easy'),
  (12, 'Someone walking with a drink in each hand', 'easy'),
  (13, 'Someone in a full cowboy outfit, head to toe', 'easy'),
  (14, 'A drink bigger than the arm holding it', 'easy'),
  (15, 'Someone waiting outside while their whole group is inside', 'easy'),
  (16, 'A phone held up to film the band through somebody''s head', 'easy'),
  (17, 'Someone eating something that cannot be walked and eaten at once', 'easy'),
  (18, 'A hat that has clearly been through a lot', 'easy'),
  (19, 'Three bachelorette parties inside one block', 'medium'),
  (20, 'A veil, in broad daylight', 'medium'),
  (21, 'Fringe on a jacket', 'medium'),
  (22, 'A belt buckle the size of a fist', 'medium'),
  (23, 'Someone in a full suit on Broadway', 'medium'),
  (24, 'Somebody''s boots photographed instead of their face', 'medium'),
  (25, 'A group photo on the honky-tonk stairs', 'medium'),
  (26, 'A server carrying an improbable number of drinks', 'medium'),
  (27, 'Someone dancing alone, fully committed', 'medium'),
  (28, 'A piggyback down the sidewalk', 'medium'),
  (29, 'An outfit that clearly took real planning', 'medium'),
  (30, 'Someone fixing a friend''s hair in the street', 'medium'),
  (31, 'Shorts and a winter coat within ten feet of each other', 'medium'),
  (32, 'A denim jacket with a name across the back', 'medium'),
  (33, 'A neck tattoo', 'medium'),
  (34, 'Someone sitting on the kerb, finished for the night', 'medium'),
  (35, 'Someone carrying their shoes', 'medium'),
  (36, 'A to-go cup from one bar carried into another', 'medium'),
  (37, 'A bolo tie', 'hard'),
  (38, 'Somebody asleep, sitting bolt upright', 'hard'),
  (39, 'A dog being carried through the crowd', 'hard'),
  (40, 'A boot scoot performed perfectly by someone well past seventy', 'hard')
) as v(ord, text, diff);
