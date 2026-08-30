-- Four more occasions: places you cannot easily leave.
--
-- A cabin at altitude, a meeting that will not end, a ceremony with two
-- hundred names to get through, a breakfast room at 8am. The common thread is
-- time you did not choose to spend, which is exactly when a card in your hand
-- is worth something.
--
-- Airplane deliberately does not overlap Airport: the terminal is queues and
-- departure boards, the cabin is three hours in a seat.
--
-- Same rule as the other packs (PRD §37, §56): nothing asks you to interact
-- with, photograph or identify anyone, and nothing rewards being unkind about
-- how a stranger looks. Office squares are about meetings, never about a
-- colleague.

insert into public.game_templates
  (id, creator_id, title, slug, description, category, content_rating,
   visibility, status, card_size, free_center, published_at)
values
  ('00000000-0000-4000-8000-00000000000e', null, 'Airplane Bingo', 'airplane-bingo',
   'Three hours in a seat, and thirty rows of people making the best of it.',
   'airplane', 'family', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-00000000000f', null, 'Meeting Bingo', 'meeting-bingo',
   'For the meeting that could have been an email. Play quietly.',
   'office', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000010', null, 'Graduation Bingo', 'graduation-bingo',
   'Two hundred names to get through, and a family beside you for all of it.',
   'graduation', 'family', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000011', null, 'Hotel Breakfast Bingo', 'hotel-breakfast-bingo',
   'The buffet, the toaster conveyor, and everyone pretending it is normal.',
   'hotel', 'family', 'public', 'published', 5, true, now())
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      content_rating = excluded.content_rating,
      visibility = excluded.visibility,
      status = excluded.status;

delete from public.game_squares
 where game_template_id in (
  '00000000-0000-4000-8000-00000000000e',
  '00000000-0000-4000-8000-00000000000f',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000011'
 );

-- ---------------------------------------------------------------------------
-- Airplane Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-00000000000e', v.text, v.diff, v.ord
from (values
  (1,  'A bag that will not fit, attempted three times', 'easy'),
  (2,  'Someone reclining the moment the sign goes off', 'easy'),
  (3,  'Someone standing the instant the wheels touch down', 'easy'),
  (4,  'A neck pillow deployed with real commitment', 'easy'),
  (5,  'Food clearly bought in the terminal', 'easy'),
  (6,  'A photo taken of the wing', 'easy'),
  (7,  'A queue for the toilet at the worst possible moment', 'easy'),
  (8,  'Someone checking the map screen every ten minutes', 'easy'),
  (9,  'A blanket still sealed in its plastic', 'easy'),
  (10, 'Someone asleep before the safety demonstration ends', 'medium'),
  (11, 'A seat changed before takeoff', 'medium'),
  (12, 'A parent walking a baby up and down the aisle', 'medium'),
  (13, 'Someone doing a crossword on actual paper', 'medium'),
  (14, 'A person who has not once looked away from the window', 'medium'),
  (15, 'Two strangers who have not spoken in four hours', 'medium'),
  (16, 'A tray table still down during the announcement', 'medium'),
  (17, 'Headphones audible three rows away', 'medium'),
  (18, 'Someone who has taken their shoes off', 'medium'),
  (19, 'A laptop opened and never once used', 'medium'),
  (20, 'Two people trading the window for the aisle', 'medium'),
  (21, 'A child kicking a seat back, obliviously', 'medium'),
  (22, 'Someone thanking every crew member on the way out', 'medium'),
  (23, 'A duty-free bag wedged under a seat', 'medium'),
  (24, 'Turbulence, and one person not reacting at all', 'medium'),
  (25, 'A row where everyone is asleep except one', 'medium'),
  (26, 'Someone eating the entire tray, roll included', 'medium'),
  (27, 'A jacket folded into the overhead with great care', 'medium'),
  (28, 'Someone who has clearly flown this route many times', 'medium'),
  (29, 'A drink finished in one go before landing', 'medium'),
  (30, 'Someone watching the same film as their neighbour, unaware', 'medium'),
  (31, 'A phone still on as the crew come down the aisle', 'medium'),
  (32, 'Someone asleep with their book still upright', 'medium'),
  (33, 'The scramble the moment the door opens', 'easy'),
  (34, 'Applause on landing', 'hard'),
  (35, 'Someone asked to swap so a family can sit together', 'hard'),
  (36, 'A person reading the safety card properly', 'hard'),
  (37, 'Someone rehearsing a connection time out loud', 'hard'),
  (38, 'A pen borrowed for a landing card', 'hard'),
  (39, 'An overhead locker opened far too early, and stopped', 'hard'),
  (40, 'Someone who brought their own headphones and adapter', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Meeting Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-00000000000f', v.text, v.diff, v.ord
from (values
  (1,  '"You''re on mute"', 'easy'),
  (2,  'A meeting that could have been an email', 'easy'),
  (3,  'Someone joining late with no explanation', 'easy'),
  (4,  'An invite that arrived with no agenda', 'easy'),
  (5,  '"Can everyone see my screen?"', 'easy'),
  (6,  'Two people talking over each other, then both stopping', 'easy'),
  (7,  'A slide with far too much text on it', 'easy'),
  (8,  'The meeting ending on "any questions?" and silence', 'easy'),
  (9,  'A biscuit tin down to only the plain ones', 'easy'),
  (10, '"Let''s take that offline"', 'medium'),
  (11, '"Circle back"', 'medium'),
  (12, 'A screen share of entirely the wrong window', 'medium'),
  (13, 'Someone eating lunch on camera', 'medium'),
  (14, 'A dog appearing behind someone', 'medium'),
  (15, 'Typing, loudly, while unmuted', 'medium'),
  (16, 'A whiteboard drawing nobody can read', 'medium'),
  (17, 'Someone doing laps of the building on a call', 'medium'),
  (18, 'A "quick question" that takes twenty minutes', 'medium'),
  (19, 'A recurring meeting nobody remembers agreeing to', 'medium'),
  (20, 'Someone with two laptops open', 'medium'),
  (21, 'A jacket holding a chair all day', 'medium'),
  (22, 'One person speaking for most of the meeting', 'medium'),
  (23, 'A question already answered on slide four', 'medium'),
  (24, 'Someone leaving the call without saying goodbye', 'medium'),
  (25, 'Something being "parked" for later', 'medium'),
  (26, 'A phone ringing in a silent room', 'medium'),
  (27, 'Coffee arriving for exactly one person', 'medium'),
  (28, 'A window opened, then quietly closed by someone else', 'medium'),
  (29, 'Someone volunteering to own an action item', 'medium'),
  (30, 'A headset battery dying mid-sentence', 'medium'),
  (31, '"Following up on my last email"', 'medium'),
  (32, 'A room booked that nobody needed', 'medium'),
  (33, 'Someone taking the good chair the moment it is free', 'medium'),
  (34, 'A meeting that overruns into the next one', 'medium'),
  (35, 'Cake in the kitchen with no birthday attached', 'medium'),
  (36, 'Someone reading something else on camera', 'medium'),
  (37, 'A meeting that ends more than ten minutes early', 'hard'),
  (38, 'The printer defeating someone senior', 'hard'),
  (39, 'A note on the fridge about somebody''s lunch', 'hard'),
  (40, 'An out-of-office reply from someone visibly at their desk', 'hard')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Graduation Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000010', v.text, v.diff, v.ord
from (values
  (1,  'A cap that will not stay on', 'easy'),
  (2,  'Someone filming the entire walk across the stage', 'easy'),
  (3,  'A family occupying an entire row', 'easy'),
  (4,  'A decorated cap with a joke on it', 'easy'),
  (5,  'A speech that mentions "the real world"', 'easy'),
  (6,  'Someone checking their phone during the speech', 'easy'),
  (7,  'A programme being used as a fan', 'easy'),
  (8,  'A group photo attempted on the steps', 'easy'),
  (9,  'A queue for a photo beside the same sign', 'easy'),
  (10, 'Someone crying before the name is even called', 'medium'),
  (11, 'A name pronounced not quite right', 'medium'),
  (12, 'Heels that are clearly a mistake', 'medium'),
  (13, 'A relative standing on a chair for the shot', 'medium'),
  (14, 'A baby crying at the quietest possible moment', 'medium'),
  (15, 'Flowers carried by someone who is not graduating', 'medium'),
  (16, 'A gown worn over something completely unsuitable', 'medium'),
  (17, 'Someone asleep in the audience', 'medium'),
  (18, 'Two graduates swapping caps for a photo', 'medium'),
  (19, 'A speech visibly running over time', 'medium'),
  (20, 'A grandparent helped to a seat near the front', 'medium'),
  (21, 'A parent who cannot find their own child in the crowd', 'medium'),
  (22, 'A tassel on what is probably the wrong side', 'medium'),
  (23, 'A graduate hugging a lecturer on stage', 'medium'),
  (24, 'Someone leaving straight after their own name', 'medium'),
  (25, 'Seats reserved with a row of coats', 'medium'),
  (26, 'A cheer that starts slightly too early', 'medium'),
  (27, 'A gown fastening defeating its wearer', 'medium'),
  (28, 'A cap thrown and not caught', 'medium'),
  (29, 'A dropped programme picked up by a stranger', 'medium'),
  (30, 'Someone shuffling in mid-ceremony', 'medium'),
  (31, 'A speech quoting someone famous', 'easy'),
  (32, 'A graduate scanning the crowd for their family', 'medium'),
  (33, 'A phone battery warning announced out loud', 'medium'),
  (34, 'Someone waving at entirely the wrong graduate', 'hard'),
  (35, 'An air horn, despite the request', 'hard'),
  (36, 'A name called with nobody appearing', 'hard'),
  (37, 'Confetti that was definitely not permitted', 'hard'),
  (38, 'Caps thrown, then the hunt for your own', 'hard'),
  (39, 'Someone recording vertically while being told not to', 'hard'),
  (40, 'A whole row standing for one person', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Hotel Breakfast Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000011', v.text, v.diff, v.ord
from (values
  (1,  'Someone defeated by the toaster conveyor', 'easy'),
  (2,  'A plate stacked far beyond any need', 'easy'),
  (3,  'Someone asking whether there is more coffee', 'easy'),
  (4,  'A pastry taken with a napkin instead of a plate', 'easy'),
  (5,  'A table abandoned under a stack of plates', 'easy'),
  (6,  'Someone checking out with luggage beside the table', 'easy'),
  (7,  'Fruit quietly taken for later', 'medium'),
  (8,  'A child working the cereal dispenser unsupervised', 'medium'),
  (9,  'A person eating alone behind a newspaper', 'medium'),
  (10, 'The waffle machine causing a queue', 'medium'),
  (11, 'An alarm going off at the table', 'medium'),
  (12, 'Two people at breakfast in complete silence', 'medium'),
  (13, 'Someone eating standing up, in a suit', 'medium'),
  (14, 'A photograph taken of the buffet', 'medium'),
  (15, 'A family in matching lanyards', 'medium'),
  (16, 'Someone returning for a third round', 'medium'),
  (17, 'The last of something, and whoever took it', 'medium'),
  (18, 'Someone thoroughly confused by the juice machine', 'medium'),
  (19, 'Sunglasses worn indoors', 'medium'),
  (20, 'A pot of coffee carried across the whole room', 'medium'),
  (21, 'A room number given with great confidence', 'medium'),
  (22, 'Eggs and cereal sharing one plate', 'medium'),
  (23, 'A map open on the table and a day being planned', 'medium'),
  (24, 'Something requested that is plainly not on offer', 'medium'),
  (25, 'A child pouring their own juice, ambitiously', 'medium'),
  (26, 'A phone propped against the jam', 'medium'),
  (27, 'A banana taken, and nothing else', 'medium'),
  (28, 'Milk finished and not replaced', 'medium'),
  (29, 'A checkout time being negotiated out loud', 'medium'),
  (30, 'Someone eating fast with a taxi clearly waiting', 'medium'),
  (31, 'A tray carried with visible uncertainty', 'medium'),
  (32, 'The good table by the window, claimed', 'medium'),
  (33, 'An empty table held by a coat', 'medium'),
  (34, 'A second breakfast begun without comment', 'medium'),
  (35, 'Someone in a dressing gown', 'hard'),
  (36, 'The toaster setting adjusted by three different people', 'hard'),
  (37, 'Two people realising they are at the same conference', 'hard'),
  (38, 'Someone dressed for a wedding at eight in the morning', 'hard'),
  (39, 'The staff member who refills everything before you ask', 'hard'),
  (40, 'Someone reading a folded newspaper with real precision', 'medium')
) as v(ord, text, diff);
