-- Date-night games (run after supabase/seed.sql).
--
-- Written for two people at a table, which is a different job from eight at a
-- tailgate. These squares are less about ticking things off and more about
-- giving you something to speculate about together: the couple who've clearly
-- been together thirty years, the table that's a first date, the argument
-- nobody can hear. The observation is the excuse; the conversation is the
-- point.
--
-- Nothing here requires interacting with, photographing, or identifying anyone
-- (PRD §37, §56) — you're reading a room, not a person.

insert into public.game_templates
  (id, creator_id, title, slug, description, category, content_rating,
   visibility, status, card_size, free_center, published_at)
values
  ('00000000-0000-4000-8000-000000000009', null, 'Date Night Bingo', 'date-night-bingo',
   'For two people at a table who could use something to talk about.',
   'restaurant', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-00000000000a', null, 'Coffee Shop Bingo', 'coffee-shop-bingo',
   'Laptop campers, oat milk debates, and the slow theatre of a café.',
   'coffee-shop', 'family', 'public', 'published', 5, true, now())
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      content_rating = excluded.content_rating,
      visibility = excluded.visibility,
      status = excluded.status;

delete from public.game_squares
 where game_template_id in (
  '00000000-0000-4000-8000-000000000009',
  '00000000-0000-4000-8000-00000000000a'
 );

-- ---------------------------------------------------------------------------
-- Date Night Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000009', v.text, v.diff, v.ord
from (values
  (1,  'A couple who have clearly been together thirty years', 'medium'),
  (2,  'A table where it is obviously a first date', 'medium'),
  (3,  'Someone photographing their food before anyone eats', 'easy'),
  (4,  'A birthday where the staff have to sing', 'hard'),
  (5,  'Someone explaining the wine at length', 'medium'),
  (6,  'A couple on their phones, not talking', 'easy'),
  (7,  'Someone who has clearly ordered the wrong thing', 'medium'),
  (8,  'A parent letting a toddler destroy a breadstick', 'medium'),
  (9,  'The table that keeps flagging down the server', 'medium'),
  (10, 'Someone dressed far more formally than everyone else', 'easy'),
  (11, 'A group splitting the bill with visible mathematics', 'medium'),
  (12, 'Someone taking a call they should not take here', 'medium'),
  (13, 'A server reciting specials entirely from memory', 'easy'),
  (14, 'Two people ordering the exact same thing', 'medium'),
  (15, 'A couple sitting on the same side of the booth', 'medium'),
  (16, 'Someone sending something back to the kitchen', 'hard'),
  (17, 'A table laughing loud enough to turn heads', 'easy'),
  (18, 'Someone who has brought a book and is genuinely reading it', 'hard'),
  (19, 'A group photo taken by a passing server', 'medium'),
  (20, 'Someone stealing a chip off another plate', 'easy'),
  (21, 'A person waiting alone, checking the door repeatedly', 'medium'),
  (22, 'Someone doing the "just the check" hand signal', 'easy'),
  (23, 'A couple who have run out of things to say', 'medium'),
  (24, 'Someone dressed for a completely different season', 'medium'),
  (25, 'A table where one person is doing all the talking', 'easy'),
  (26, 'Someone taking leftovers with real ceremony', 'medium'),
  (27, 'A drink arriving that visibly impresses the next table', 'medium'),
  (28, 'Someone reading the menu like a legal document', 'easy'),
  (29, 'A staff member who is clearly new', 'medium'),
  (30, 'Someone celebrating something you cannot identify', 'medium'),
  (31, 'A couple taking a selfie at the table', 'easy'),
  (32, 'Someone rearranging the table setting to their liking', 'medium'),
  (33, 'A person who ordered dessert without hesitating', 'easy'),
  (34, 'Two people arguing quietly and unmistakably', 'hard'),
  (35, 'Someone who knows the staff by name', 'medium'),
  (36, 'A table getting a dish they did not order', 'hard'),
  (37, 'Someone checking the time more than twice', 'medium'),
  (38, 'A coat that stays on for the entire meal', 'medium'),
  (39, 'Someone insisting on paying while another protests', 'medium'),
  (40, 'A pair who leave holding hands', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Coffee Shop Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-00000000000a', v.text, v.diff, v.ord
from (values
  (1,  'A laptop camper on their second hour', 'easy'),
  (2,  'Someone photographing their latte art', 'easy'),
  (3,  'A drink order longer than a sentence', 'medium'),
  (4,  'Someone in headphones nodding to nothing visible', 'easy'),
  (5,  'A meeting that is obviously a job interview', 'medium'),
  (6,  'Someone hunting for an outlet', 'easy'),
  (7,  'A dog waiting patiently outside', 'medium'),
  (8,  'Two people who have not touched their drinks', 'medium'),
  (9,  'Someone reading an actual paper book', 'medium'),
  (10, 'A barista calling a name nobody claims', 'medium'),
  (11, 'Someone taking notes in a physical notebook', 'easy'),
  (12, 'A stroller wedged between two tables', 'easy'),
  (13, 'Someone who ordered a pastry and regrets it', 'hard'),
  (14, 'A group meeting that is clearly a study session', 'medium'),
  (15, 'Someone on a video call without headphones', 'medium'),
  (16, 'A person guarding a table with a jacket', 'easy'),
  (17, 'Someone asking about the milk options', 'medium'),
  (18, 'A regular whose order starts before they speak', 'hard'),
  (19, 'Someone rearranging furniture to suit themselves', 'medium'),
  (20, 'A first date with visible nerves', 'hard'),
  (21, 'Someone reading over another person''s shoulder', 'hard'),
  (22, 'A drink collected without a thank you', 'medium'),
  (23, 'Someone sitting alone at a table for four', 'easy'),
  (24, 'A parent and child sharing one enormous cookie', 'medium'),
  (25, 'Someone taking their coffee outside immediately', 'easy'),
  (26, 'A queue that reaches the door', 'medium'),
  (27, 'Someone doing something on a tablet with a stylus', 'medium'),
  (28, 'Two colleagues clearly avoiding the office', 'medium'),
  (29, 'Someone who brought their own cup', 'medium'),
  (30, 'A pastry case negotiation with a child', 'medium'),
  (31, 'Someone asleep upright in an armchair', 'hard'),
  (32, 'A person writing something by hand and pausing a lot', 'medium'),
  (33, 'Someone loudly recognising an old friend', 'hard'),
  (34, 'A table covered in more devices than drinks', 'easy'),
  (35, 'Someone checking their reflection in a window', 'medium'),
  (36, 'A drink remade because it was wrong', 'hard'),
  (37, 'Someone wearing sunglasses indoors', 'medium'),
  (38, 'A person who has clearly been here since opening', 'hard'),
  (39, 'Someone eating lunch at 10 in the morning', 'medium'),
  (40, 'Two people leaving in different directions', 'easy')
) as v(ord, text, diff);
