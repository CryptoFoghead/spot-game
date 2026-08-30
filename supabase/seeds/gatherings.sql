-- Three more occasions, chosen because nothing covered them.
--
-- The starter set leans on travel and eating out. These are the other times
-- people are stuck somewhere together with nothing to do but look: a crowd at
-- a gig, a family in a garden, a queue in the sun.
--
-- Same rule as the date-night pack (PRD §37, §56): nothing here asks you to
-- interact with, photograph, or identify anyone, and nothing rewards being
-- unkind about how a stranger looks. The joke is always the situation.

insert into public.game_templates
  (id, creator_id, title, slug, description, category, content_rating,
   visibility, status, card_size, free_center, published_at)
values
  ('00000000-0000-4000-8000-00000000000b', null, 'Concert Bingo', 'concert-bingo',
   'For the hour before the band comes on, and the crowd around you.',
   'concert', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-00000000000c', null, 'Family Reunion Bingo', 'family-reunion-bingo',
   'Every family runs the same way. Play it with the cousin you like best.',
   'family-reunion', 'family', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-00000000000d', null, 'Theme Park Bingo', 'theme-park-bingo',
   'Queues are long and the people in them are doing a lot.',
   'theme-park', 'family', 'public', 'published', 5, true, now())
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      content_rating = excluded.content_rating,
      visibility = excluded.visibility,
      status = excluded.status;

delete from public.game_squares
 where game_template_id in (
  '00000000-0000-4000-8000-00000000000b',
  '00000000-0000-4000-8000-00000000000c',
  '00000000-0000-4000-8000-00000000000d'
 );

-- ---------------------------------------------------------------------------
-- Concert Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-00000000000b', v.text, v.diff, v.ord
from (values
  (1,  'Someone filming an entire song', 'easy'),
  (2,  'A band t-shirt of the band currently playing', 'easy'),
  (3,  'A band t-shirt of a completely unrelated band', 'easy'),
  (4,  'Someone edging through the crowd with four drinks', 'easy'),
  (5,  'A person on someone else''s shoulders', 'medium'),
  (6,  'Someone who knows every single word', 'medium'),
  (7,  'A couple slow dancing regardless of the tempo', 'medium'),
  (8,  'Earplugs going in before the support act', 'hard'),
  (9,  'A homemade sign held up above the crowd', 'medium'),
  (10, 'The whole room lit by phone torches', 'medium'),
  (11, 'Someone who came alone and is having the best time', 'medium'),
  (12, 'A parent who has brought a kid to their first gig', 'hard'),
  (13, 'Someone leaving before the encore', 'medium'),
  (14, 'Someone arriving halfway through the headliner', 'medium'),
  (15, 'A full conversation held through the quiet song', 'medium'),
  (16, 'Someone recording, watching it back, then recording again', 'medium'),
  (17, 'A chant that starts and immediately dies', 'easy'),
  (18, 'A drink raised at exactly the right lyric', 'medium'),
  (19, 'Someone checking their watch during the slow one', 'medium'),
  (20, 'Two people disagreeing about the setlist', 'hard'),
  (21, 'One person holding a spot for four friends', 'medium'),
  (22, 'A jacket on the floor reserving territory', 'medium'),
  (23, 'Someone singing at their friend instead of the stage', 'medium'),
  (24, 'The one person sitting while everyone else stands', 'medium'),
  (25, 'Merch bought and put on immediately', 'medium'),
  (26, 'Someone who has completely lost their group', 'easy'),
  (27, 'A sing-along the band stops playing for', 'hard'),
  (28, 'Somebody asleep, somehow', 'hard'),
  (29, 'A phone held up so an absent friend can hear', 'medium'),
  (30, 'Someone who has been to "every tour"', 'medium'),
  (31, 'Confetti still in someone''s hair', 'medium'),
  (32, 'A polite request to stop filming', 'hard'),
  (33, 'Hands going up all at once when the lights hit', 'easy'),
  (34, 'Someone explaining the back catalogue at length', 'medium'),
  (35, 'A queue forming for the good bathroom', 'easy'),
  (36, 'Everyone checking the time before the encore', 'medium'),
  (37, 'Someone mouthing "this is my song" to a friend', 'medium'),
  (38, 'A stranger steadying somebody who stumbled', 'hard'),
  (39, 'Someone still holding a full drink an hour later', 'medium'),
  (40, 'Two people who clearly came for different bands', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Family Reunion Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-00000000000c', v.text, v.diff, v.ord
from (values
  (1,  'Someone remarking how tall you have got', 'easy'),
  (2,  'A photo where nobody looks at the same camera', 'easy'),
  (3,  'The same story told for the third time', 'easy'),
  (4,  'Somebody who has brought far too much food', 'easy'),
  (5,  'A card table that will not stop wobbling', 'medium'),
  (6,  'A dish nobody will claim responsibility for', 'medium'),
  (7,  'Two relatives comparing the route they drove', 'medium'),
  (8,  'Photos shown on a phone held slightly too far away', 'medium'),
  (9,  'A baby passed between four people without touching the ground', 'medium'),
  (10, 'Someone asleep in a chair by mid-afternoon', 'medium'),
  (11, 'A debate about which year it actually was', 'hard'),
  (12, 'A cousin nobody can place straight away', 'medium'),
  (13, 'Children playing a game with rules only they know', 'easy'),
  (14, 'A group photo that takes four attempts', 'easy'),
  (15, 'Somebody''s dog becoming the main event', 'medium'),
  (16, 'A disagreement about the correct way to cook it', 'medium'),
  (17, 'Someone quietly doing all the washing up', 'hard'),
  (18, 'A question about your job, and no listening to the answer', 'medium'),
  (19, 'An album of old photographs produced unprompted', 'medium'),
  (20, 'A toast that runs longer than planned', 'medium'),
  (21, 'Leftovers going home in borrowed containers', 'easy'),
  (22, 'A child asleep somewhere improbable', 'medium'),
  (23, 'A family story retold slightly wrong', 'hard'),
  (24, 'A teenager who has retreated to the far edge', 'easy'),
  (25, 'Someone measuring a child against a doorframe', 'hard'),
  (26, 'A folding chair giving way, gently', 'medium'),
  (27, 'The relative who has brought an instrument', 'hard'),
  (28, 'Somebody taking home the food they arrived with', 'medium'),
  (29, 'Ten unbroken minutes on the subject of traffic', 'medium'),
  (30, 'Two people who have accidentally dressed the same', 'medium'),
  (31, 'Food offered to someone who is already eating', 'easy'),
  (32, 'A recipe promised and never actually written down', 'medium'),
  (33, 'Somebody''s partner meeting everyone at once', 'medium'),
  (34, 'The first announcement that they should get going', 'easy'),
  (35, 'A goodbye that takes twenty-five minutes', 'easy'),
  (36, 'A plant or a cutting changing hands', 'hard'),
  (37, 'Two relatives who have not spoken all day', 'hard'),
  (38, 'Someone hunting for a photo on their phone to prove a point', 'medium'),
  (39, 'A promise to do this more often', 'medium'),
  (40, 'Somebody counting how many are staying for dinner', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Theme Park Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-00000000000d', v.text, v.diff, v.ord
from (values
  (1,  'A family in matching shirts', 'easy'),
  (2,  'A child asleep in a pushchair in full sun', 'easy'),
  (3,  'Someone holding everyone''s bags at the ride exit', 'easy'),
  (4,  'A dropped ice cream, and the silence after', 'easy'),
  (5,  'Someone counting heads out loud', 'easy'),
  (6,  'A pushchair parked in a whole city of pushchairs', 'easy'),
  (7,  'Somebody carrying a stuffed prize bigger than a child', 'medium'),
  (8,  'A child measured against the height sign', 'medium'),
  (9,  'Someone still eating in the queue', 'medium'),
  (10, 'A group deciding to split up and meet later', 'medium'),
  (11, 'A paper map, held by someone refusing to use their phone', 'medium'),
  (12, 'Sunburn in the exact shape of a t-shirt', 'medium'),
  (13, 'A queue where nobody can tell if it has moved', 'medium'),
  (14, 'Someone rehearsing what they will do on the drop', 'medium'),
  (15, 'A parent riding alone because nobody else would', 'medium'),
  (16, 'A character photo with a deeply unsure toddler', 'medium'),
  (17, 'A poncho bought at three times a sensible price', 'medium'),
  (18, 'Shoes being carried rather than worn', 'medium'),
  (19, 'Someone asleep upright on a bench', 'easy'),
  (20, 'A photo taken by a passing stranger', 'easy'),
  (21, 'Somebody who has clearly done this park many times', 'medium'),
  (22, 'A hat lost to a rollercoaster', 'hard'),
  (23, 'The ride photo checked, and actually bought', 'hard'),
  (24, 'A phone rescued from under a seat', 'hard'),
  (25, 'Negotiations for one more ride', 'medium'),
  (26, 'A water ride reaching people who thought they were safe', 'medium'),
  (27, 'Someone regretting what they ate before queueing', 'medium'),
  (28, 'A jacket worn in obvious heat', 'medium'),
  (29, 'A meltdown resolved instantly by ice cream', 'medium'),
  (30, 'A photo of a sign, taken to remember where the car is', 'medium'),
  (31, 'Two adults enjoying it more than the children', 'hard'),
  (32, 'A battery-percentage announcement made to the whole group', 'medium'),
  (33, 'Sunscreen reapplied to a wriggling child', 'easy'),
  (34, 'A queue jumper noticed but not confronted', 'hard'),
  (35, 'A refillable cup on its fourth trip', 'medium'),
  (36, 'A ride stopping while people are still on it', 'hard'),
  (37, 'Someone asleep before the car park', 'easy'),
  (38, 'A group agreeing never to do the parade again', 'medium'),
  (39, 'Somebody comparing wristbands with a stranger', 'medium'),
  (40, 'A single chip guarded from a very committed bird', 'hard')
) as v(ord, text, diff);
