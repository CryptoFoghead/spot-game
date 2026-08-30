-- Football, three ways.
--
-- The same sport at three levels is three completely different afternoons, so
-- these are three cards rather than one with a difficulty slider. A high
-- school game is a town event with a band and a raffle; a college game is a
-- hundred thousand people doing traditions you may not follow; a pro game is
-- expensive beer, fantasy scores and beating the traffic.
--
-- All three are INSIDE the ground. Tailgate Bingo already owns the car park —
-- grills, cornhole, flags on trucks, dogs in team colours — and nothing here
-- repeats it.
--
-- Named "Pro Football" rather than after the league: a published game on a
-- public site carrying a trademark is a problem with no upside, and no team
-- names appear either.
--
-- Same rule as every other pack (PRD §37, §56): the joke is the occasion, and
-- nothing asks you to interact with, photograph or identify anyone.

insert into public.game_templates
  (id, creator_id, title, slug, description, category, content_rating,
   visibility, status, card_size, free_center, published_at)
values
  ('00000000-0000-4000-8000-000000000012', null, 'High School Football Bingo', 'high-school-football-bingo',
   'Friday night, a cold bleacher, and half the town in one place.',
   'football-game', 'family', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000013', null, 'College Football Bingo', 'college-football-bingo',
   'Traditions you may not follow, performed by a hundred thousand people.',
   'football-game', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000014', null, 'Pro Football Bingo', 'pro-football-bingo',
   'Expensive beer, fantasy scores, and leaving early to beat the traffic.',
   'football-game', 'standard', 'public', 'published', 5, true, now())
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      content_rating = excluded.content_rating,
      visibility = excluded.visibility,
      status = excluded.status;

delete from public.game_squares
 where game_template_id in (
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000014'
 );

-- ---------------------------------------------------------------------------
-- High School Football Bingo — the town turns up
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000012', v.text, v.diff, v.ord
from (values
  (1,  'The band playing the fight song after a score', 'easy'),
  (2,  'Cowbells', 'easy'),
  (3,  'A concession queue longer than the one at the gate', 'easy'),
  (4,  'Someone in team colours from hat to shoes', 'easy'),
  (5,  'Children playing their own game behind the bleachers', 'easy'),
  (6,  'A parent wearing a player''s number', 'easy'),
  (7,  'The visiting stand noticeably emptier', 'easy'),
  (8,  'Someone shouting at the officials from the very back row', 'easy'),
  (9,  'The band marching at half time', 'easy'),
  (10, 'A booster banner with a local business on it', 'easy'),
  (11, 'The final score read over a crackling speaker', 'easy'),
  (12, 'Raffle tickets being sold in the stands', 'medium'),
  (13, 'A small child in full kit copying the team', 'medium'),
  (14, 'Blankets brought out on a warm evening', 'medium'),
  (15, 'The team running through a paper banner', 'medium'),
  (16, 'An announcer getting a name not quite right', 'medium'),
  (17, 'The chain crew brought on to measure', 'medium'),
  (18, 'The drumline warming up behind the stand', 'medium'),
  (19, 'A student section theme nobody explained', 'medium'),
  (20, 'Freshmen colonising the top row', 'medium'),
  (21, 'Someone questioning the clock operator', 'medium'),
  (22, 'A trainer taping something on the sideline', 'medium'),
  (23, 'A coach holding a laminated sheet like a shield', 'medium'),
  (24, 'A dog watching through the fence', 'medium'),
  (25, 'A missed extra point', 'medium'),
  (26, 'A helmet coming off mid-play', 'medium'),
  (27, 'Someone leaving at half time and not coming back', 'medium'),
  (28, 'A cheer that nobody joins in with', 'medium'),
  (29, 'Somebody in shorts on a genuinely cold night', 'medium'),
  (30, 'A child asking for concession money for the third time', 'medium'),
  (31, 'A clipboard slammed on the sideline', 'medium'),
  (32, 'A chant from the students that gets hushed', 'medium'),
  (33, 'Someone announcing they cannot feel their feet', 'medium'),
  (34, 'A grandparent given the best seat in the row', 'medium'),
  (35, 'A punt that travels almost nowhere', 'medium'),
  (36, 'Someone greeting half the crowd on the way in', 'medium'),
  (37, 'Senior night flowers changing hands', 'hard'),
  (38, 'A pickup truck parked beyond the end zone', 'hard'),
  (39, 'Phone torches held up during a silence', 'hard'),
  (40, 'The scoreboard bulb that has been out all season', 'hard')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- College Football Bingo — scale and ritual
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000013', v.text, v.diff, v.ord
from (values
  (1,  'A student section standing for the entire game', 'easy'),
  (2,  'An alumnus telling you the year they graduated', 'easy'),
  (3,  'The band playing after every single score', 'easy'),
  (4,  'A rivalry shirt aimed squarely at the other team', 'easy'),
  (5,  'Greek letters', 'easy'),
  (6,  'A queue for the one good bathroom', 'easy'),
  (7,  'A chant that spells a word out', 'easy'),
  (8,  'A clap the whole ground does in unison', 'easy'),
  (9,  'The entire stand turning to watch the replay screen', 'easy'),
  (10, 'Someone who drove a very long way to be here', 'medium'),
  (11, 'Someone asleep in the student section', 'medium'),
  (12, 'A wave that goes round twice and then dies', 'medium'),
  (13, 'The rankings explained to you, unprompted', 'medium'),
  (14, 'A mascot doing press-ups after a touchdown', 'medium'),
  (15, 'A parent in a jersey with their own child''s name', 'medium'),
  (16, 'A tradition happening that you cannot follow', 'medium'),
  (17, 'Coordinated colours across a whole stand', 'medium'),
  (18, 'A radio held to one ear', 'medium'),
  (19, 'A fourth-down decision argued in every row', 'medium'),
  (20, 'Students leaving early with a comfortable lead', 'medium'),
  (21, 'Someone in a full suit in the crowd', 'medium'),
  (22, 'A small visiting section, loudly outnumbered', 'medium'),
  (23, 'Someone checking a different game''s score', 'medium'),
  (24, 'A referee announcement buried under booing', 'medium'),
  (25, 'A camera crane swinging out over the crowd', 'medium'),
  (26, 'A child asleep across a bleacher bench', 'medium'),
  (27, 'A vendor working a whole section without stopping', 'medium'),
  (28, 'Someone counting the timeouts out loud', 'medium'),
  (29, 'A player helped off to applause', 'medium'),
  (30, 'This game compared to one from years ago', 'medium'),
  (31, 'The band forming letters at half time', 'medium'),
  (32, 'A senior walking out with their family', 'medium'),
  (33, 'Someone explaining why the clock stopped', 'medium'),
  (34, 'Two strangers hugging after a big play', 'medium'),
  (35, 'A hand-made sign held up for the cameras', 'medium'),
  (36, 'The tuba section being photographed', 'hard'),
  (37, 'Someone keeping score on paper', 'hard'),
  (38, 'Someone who has been to every home game for decades', 'hard'),
  (39, 'Something thrown from the student section', 'hard'),
  (40, 'A hat lost to the wind in the upper deck', 'hard')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Pro Football Bingo — money, fantasy, and the traffic
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000014', v.text, v.diff, v.ord
from (values
  (1,  'Someone talking about their fantasy team', 'easy'),
  (2,  'A beer costing more than a full meal', 'easy'),
  (3,  'Other scores being checked constantly', 'easy'),
  (4,  'A defence chant that shakes the stand', 'easy'),
  (5,  'A dropped pass and the collective groan', 'easy'),
  (6,  'Someone filming the entire kickoff', 'easy'),
  (7,  'A group photo with the field behind them', 'easy'),
  (8,  'An exodus with time still on the clock', 'easy'),
  (9,  'Leaving in the third quarter to beat the traffic', 'medium'),
  (10, 'A penalty explained to whoever is sitting beside them', 'medium'),
  (11, 'A replay decision nobody in the stand can hear', 'medium'),
  (12, 'Booing aimed at their own team', 'medium'),
  (13, 'The wave attempted during a critical drive', 'medium'),
  (14, 'Two opposing fans sitting together, civilly', 'medium'),
  (15, 'Someone asleep by the fourth quarter', 'medium'),
  (16, 'A vendor with a completely unmistakable voice', 'medium'),
  (17, 'Someone who has not sat down once', 'medium'),
  (18, 'Nachos served in a plastic helmet', 'medium'),
  (19, 'An argument about a fantasy decision, not the game', 'medium'),
  (20, 'A throwback shirt older than the person wearing it', 'medium'),
  (21, 'A phone battery announced to the whole row', 'medium'),
  (22, 'A seat taken by someone with the wrong ticket', 'medium'),
  (23, 'A conversation about parking lasting a full quarter', 'medium'),
  (24, 'Jersey over hoodie over jacket', 'medium'),
  (25, 'A television timeout that goes on forever', 'medium'),
  (26, 'Binoculars in the upper deck', 'medium'),
  (27, 'A stadium sing-along', 'medium'),
  (28, 'Merchandise bought inside at full price', 'medium'),
  (29, 'Fourth and short, and a wall of noise', 'medium'),
  (30, 'A child far more interested in the mascot', 'medium'),
  (31, 'A play predicted correctly and announced to everyone', 'medium'),
  (32, 'The two-minute warning, and everyone checking the time', 'medium'),
  (33, 'Yards counted out loud', 'medium'),
  (34, 'A missed field goal and total silence', 'medium'),
  (35, 'Someone still queueing when a touchdown is scored', 'medium'),
  (36, 'A row standing up and blocking the row behind', 'medium'),
  (37, 'Somebody who has clearly never watched a game before', 'medium'),
  (38, 'The salary cap being explained', 'hard'),
  (39, 'A referee shirt worn ironically', 'hard'),
  (40, 'The scoreboard trivia answered far too loudly', 'hard')
) as v(ord, text, diff);
