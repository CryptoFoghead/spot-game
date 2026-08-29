-- SPOT — seed data (PRD §12 categories, §39/§70 starter games)
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Categories (PRD §12)
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name, icon, sort_order, active) values
  ('airport',          'Airport',            'plane',          10, true),
  ('airplane',         'Airplane',           'plane-takeoff',  20, true),
  ('road-trip',        'Road Trip',          'car',            30, true),
  ('cruise',           'Cruise',             'ship',           40, true),
  ('hotel',            'Hotel',              'bed',            50, true),
  ('theme-park',       'Theme Park',         'ferris-wheel',   60, true),
  ('county-fair',      'County Fair',        'tent',           70, true),
  ('state-fair',       'State Fair',         'wheat',          80, true),
  ('concert',          'Concert',            'music',          90, true),
  ('festival',         'Festival',           'party-popper',  100, true),
  ('wedding',          'Wedding',            'heart',         110, true),
  ('graduation',       'Graduation',         'graduation-cap',120, true),
  ('youth-basketball', 'Youth Basketball',   'dribbble',      130, true),
  ('youth-baseball',   'Youth Baseball',     'circle-dot',    140, true),
  ('football-game',    'Football Game',      'trophy',        150, true),
  ('basketball-game',  'Basketball Game',    'volleyball',    160, true),
  ('tailgate',         'Tailgate',           'flame',         170, true),
  ('golf',             'Golf',               'flag',          180, true),
  ('mall',             'Mall',               'shopping-bag',  190, true),
  ('grocery-store',    'Grocery Store',      'shopping-cart', 200, true),
  ('restaurant',       'Restaurant',         'utensils',      210, true),
  ('coffee-shop',      'Coffee Shop',        'coffee',        220, true),
  ('bar',              'Bar',                'beer',          230, true),
  ('brewery',          'Brewery',            'hop',           240, true),
  ('office',           'Office',             'briefcase',     250, true),
  ('conference',       'Conference',         'presentation',  260, true),
  ('family-reunion',   'Family Reunion',     'users',         270, true),
  ('custom',           'Custom',             'sparkles',      280, true)
on conflict (slug) do update
  set name = excluded.name,
      icon = excluded.icon,
      sort_order = excluded.sort_order,
      active = excluded.active;

-- ---------------------------------------------------------------------------
-- Starter game templates (fixed UUIDs so square inserts can reference them)
-- ---------------------------------------------------------------------------
insert into public.game_templates
  (id, creator_id, title, slug, description, category, content_rating,
   visibility, status, card_size, free_center, published_at)
values
  ('00000000-0000-4000-8000-000000000001', null, 'Airport Bingo', 'airport-bingo',
   'Delays, gate sprints, and neck pillows. The classic people-watching arena.',
   'airport', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000002', null, 'State Fair Bingo', 'state-fair-bingo',
   'Fried everything, farm animals, and prize-winning people-watching.',
   'state-fair', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000003', null, 'Youth Basketball Bingo', 'youth-basketball-bingo',
   'Squeaky shoes, loud parents, and scoreboard drama in the gym.',
   'youth-basketball', 'family', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000004', null, 'Bar & Brewery Bingo', 'bar-brewery-bingo',
   'Flights, darts, and someone explaining an IPA at length.',
   'bar', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000005', null, 'Wedding Bingo', 'wedding-bingo',
   'Toasts, tears, and the dance floor tells all.',
   'wedding', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000006', null, 'Tailgate Bingo', 'tailgate-bingo',
   'Grills, cornhole, and team-colored everything in the parking lot.',
   'tailgate', 'standard', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000007', null, 'Grocery Store Bingo', 'grocery-store-bingo',
   'Cart traffic jams, free samples, and the eternal search for aisle seven.',
   'grocery-store', 'family', 'public', 'published', 5, true, now()),
  ('00000000-0000-4000-8000-000000000008', null, 'Road Trip Bingo', 'road-trip-bingo',
   'License plates, weird billboards, and are-we-there-yet energy.',
   'road-trip', 'family', 'public', 'published', 5, true, now())
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      content_rating = excluded.content_rating,
      visibility = excluded.visibility,
      status = excluded.status;

-- Re-seed squares from scratch for the starter games only.
delete from public.game_squares
 where game_template_id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000008'
 );

-- ---------------------------------------------------------------------------
-- Airport Bingo (PRD §70 examples included)
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000001', v.text, v.diff, v.ord
from (values
  (1,  'Shoes off at the gate', 'easy'),
  (2,  'Neck pillow already on', 'easy'),
  (3,  'Running toward a gate', 'easy'),
  (4,  'Oversized carry-on', 'easy'),
  (5,  'Sleeping across multiple seats', 'easy'),
  (6,  'Airport beer before 10 AM', 'medium'),
  (7,  'Gate crowd before boarding is called', 'easy'),
  (8,  'Someone arguing about bag size', 'medium'),
  (9,  'Matching luggage set', 'easy'),
  (10, 'Charging outlet competition', 'easy'),
  (11, 'Boarding pass held in teeth', 'medium'),
  (12, 'Family of five in matching shirts', 'medium'),
  (13, 'Someone watching a show with no headphones', 'medium'),
  (14, 'Pilot pulling a tiny suitcase', 'easy'),
  (15, 'A dog in a carrier', 'medium'),
  (16, 'Full sprint on the moving walkway', 'medium'),
  (17, 'Someone eating a full meal at the gate', 'easy'),
  (18, 'Announcement nobody can understand', 'easy'),
  (19, 'Someone asleep sitting straight up', 'medium'),
  (20, 'A lost-looking person staring at the departures board', 'easy'),
  (21, 'Golf clubs at baggage claim', 'medium'),
  (22, 'Someone in a suit and sneakers', 'medium'),
  (23, 'Kid riding a suitcase', 'medium'),
  (24, 'Duty-free bag bigger than a carry-on', 'hard'),
  (25, 'Someone claps when the plane lands (heard or seen)', 'hard'),
  (26, 'Line for coffee longer than security', 'medium'),
  (27, 'Someone doing laptop work on the floor', 'easy'),
  (28, 'Travel-size everything spread across a bench', 'hard'),
  (29, 'Person with a boarding-zone question for the agent', 'easy'),
  (30, 'Souvenir shirt from the city you are in', 'medium'),
  (31, 'Overhead-bin Tetris in progress', 'easy'),
  (32, 'Someone re-packing a suitcase at check-in', 'medium'),
  (33, 'A crying toddler in the security line', 'medium'),
  (34, 'Somebody loses a water bottle at security', 'medium'),
  (35, 'Two gate agents huddled at the desk', 'easy'),
  (36, 'A delayed flight groan heard nearby', 'medium'),
  (37, 'Someone wearing sunglasses indoors', 'easy'),
  (38, 'A phone call on speaker', 'easy'),
  (39, 'Someone stretching like it is a gym', 'medium'),
  (40, 'A rolling bag flips over and drags sideways', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- State Fair Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000002', v.text, v.diff, v.ord
from (values
  (1,  'Someone carrying a giant turkey leg', 'easy'),
  (2,  'Food on a stick that should not be on a stick', 'easy'),
  (3,  'A prize animal getting brushed', 'medium'),
  (4,  'Oversized stuffed-animal prize being carried', 'easy'),
  (5,  'Matching family shirts', 'easy'),
  (6,  'A stroller traffic jam', 'easy'),
  (7,  'Someone eating fried Oreos', 'medium'),
  (8,  'A cowboy hat and shorts combo', 'medium'),
  (9,  'A ride operator who looks completely done', 'medium'),
  (10, 'A carnival game argument', 'hard'),
  (11, 'Someone showing off a ribbon or trophy', 'medium'),
  (12, 'A butter sculpture or giant vegetable display', 'hard'),
  (13, 'Kid crying about a balloon', 'medium'),
  (14, 'Line longer than 20 people for food', 'easy'),
  (15, 'Someone in full livestock-show gear', 'medium'),
  (16, 'A lemonade the size of a bucket', 'easy'),
  (17, 'Fanny pack spotted', 'easy'),
  (18, 'Someone lost and calling their group', 'medium'),
  (19, 'Tractor or farm equipment display', 'easy'),
  (20, 'A sunburn that has a shape', 'hard'),
  (21, 'Free sample line', 'easy'),
  (22, 'Somebody wins a carnival game and celebrates big', 'medium'),
  (23, 'A funnel cake powdered-sugar disaster', 'medium'),
  (24, 'Someone carrying four drinks at once', 'medium'),
  (25, 'A band or musician performing', 'easy'),
  (26, 'Petting zoo hand-sanitizer line', 'medium'),
  (27, 'Someone asleep on a bench in full sun', 'hard'),
  (28, 'Deep-fried item you have never heard of', 'medium'),
  (29, 'A wagon carrying kids instead of stuff', 'easy'),
  (30, 'A ride that looks like it should not be legal', 'medium'),
  (31, 'Someone photographing their food', 'easy'),
  (32, 'A group in matching bandanas or hats', 'medium'),
  (33, 'A corn dog bigger than a forearm', 'medium'),
  (34, 'Someone fanning themselves with a pamphlet', 'medium'),
  (35, 'A misting-fan crowd cluster', 'hard'),
  (36, 'Grandstand ticket line confusion', 'hard'),
  (37, 'Someone rehearsing a 4-H presentation', 'hard'),
  (38, 'A double stroller with zero kids in it', 'medium'),
  (39, 'Someone comparing ride wristbands', 'medium'),
  (40, 'A goat yelling', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Youth Basketball Bingo (PRD §70 examples included)
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000003', v.text, v.diff, v.ord
from (values
  (1,  'Parent coaching from the bleachers', 'easy'),
  (2,  'Ref hears about a travel', 'easy'),
  (3,  'Coach asks for a timeout angrily', 'medium'),
  (4,  'Player loses a shoe', 'medium'),
  (5,  'Someone yells "box out"', 'easy'),
  (6,  'Scorekeeper confusion', 'medium'),
  (7,  'Parent filming the entire game', 'easy'),
  (8,  'Kid checks the scoreboard during play', 'easy'),
  (9,  'Ball rolls onto another court', 'medium'),
  (10, 'Someone complains about the clock', 'medium'),
  (11, 'Air ball met with total silence', 'medium'),
  (12, 'A shot goes in for the wrong team', 'hard'),
  (13, 'Player waves at family mid-game', 'medium'),
  (14, 'Coach crouching like it is the NBA finals', 'easy'),
  (15, 'A sibling running wild under the bleachers', 'easy'),
  (16, 'Water bottle spill on the court', 'medium'),
  (17, 'Everyone confused about which basket is theirs', 'hard'),
  (18, 'A defensive stance with zero movement', 'easy'),
  (19, 'Jump ball that takes three tries', 'medium'),
  (20, 'A "great hustle" consolation shout', 'easy'),
  (21, 'Shorts past the knees or above mid-thigh', 'easy'),
  (22, 'The gym echo makes the whistle painful', 'easy'),
  (23, 'A parent pacing the sideline', 'easy'),
  (24, 'Halftime orange slices or snack bags', 'medium'),
  (25, 'A kid asks the coach how long is left', 'medium'),
  (26, 'Free throw does not reach the rim', 'medium'),
  (27, 'Somebody double-dribbles and keeps going', 'easy'),
  (28, 'The bench celebrates louder than the crowd', 'medium'),
  (29, 'A tie-shoe timeout', 'medium'),
  (30, 'Grandparents with a folding seat cushion', 'medium'),
  (31, 'A buzzer scare that startles the gym', 'medium'),
  (32, 'Coach draws a play nobody follows', 'hard'),
  (33, 'A jersey tucked into shorts up to the ribs', 'medium'),
  (34, 'Post-game handshake line high-five miss', 'medium'),
  (35, 'A parent disputes the score total', 'hard'),
  (36, 'Someone brings a dog to the gym', 'hard'),
  (37, 'A full-court press against 8-year-olds', 'hard'),
  (38, 'The good player everyone whispers about', 'medium'),
  (39, 'A concession-stand candy negotiation', 'medium'),
  (40, 'Kid shoots from way too far and everyone gasps', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Bar & Brewery Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000004', v.text, v.diff, v.ord
from (values
  (1,  'Someone explains an IPA at length', 'easy'),
  (2,  'A flight of tiny beers', 'easy'),
  (3,  'Darts being played badly', 'medium'),
  (4,  'A birthday group with a sash or crown', 'medium'),
  (5,  'Someone sends a drink back', 'hard'),
  (6,  'Bartender flair move (shaker toss, bottle spin)', 'medium'),
  (7,  'A first date that is obviously a first date', 'medium'),
  (8,  'Someone photographs their beer', 'easy'),
  (9,  'The one friend who knows the bartender', 'medium'),
  (10, 'A toast with clinking glasses', 'easy'),
  (11, 'Trivia or bingo night in progress', 'hard'),
  (12, 'Someone reads the entire tap list aloud', 'medium'),
  (13, 'A dog at the brewery', 'medium'),
  (14, 'Giant Jenga or cornhole inside', 'medium'),
  (15, 'Someone orders "whatever is local"', 'medium'),
  (16, 'A tab dispute or card juggling at close-out', 'hard'),
  (17, 'Group photo taken by a stranger', 'medium'),
  (18, 'Someone nursing water between rounds', 'medium'),
  (19, 'The TV sport nobody is actually watching', 'easy'),
  (20, 'A bachelorette or bachelor party', 'hard'),
  (21, 'Someone in a jersey of a team not playing', 'medium'),
  (22, 'Popcorn, pretzels, or free snacks spotted', 'easy'),
  (23, 'A loud laugh you can hear across the room', 'easy'),
  (24, 'Someone asks for a lime or extra garnish', 'easy'),
  (25, 'A beard that belongs on a hop farm', 'medium'),
  (26, 'Live music or an open-mic performer', 'hard'),
  (27, 'Someone spins a coaster or peels a label', 'easy'),
  (28, 'The table that keeps adding chairs', 'medium'),
  (29, 'A dropped glass and the crowd reaction', 'hard'),
  (30, 'Someone orders food for the whole table', 'medium'),
  (31, 'A flannel shirt count of three or more', 'easy'),
  (32, 'Someone using two phones at once', 'medium'),
  (33, 'The couple sitting on the same side of the booth', 'medium'),
  (34, 'A growler or crowler fill', 'hard'),
  (35, 'Someone loudly recaps their week', 'easy'),
  (36, 'A designated driver ordering a mocktail', 'medium'),
  (37, 'Karaoke or someone singing along anyway', 'hard'),
  (38, 'A "we should do this more often" overheard', 'medium'),
  (39, 'Someone squints at the chalkboard menu', 'easy'),
  (40, 'Last-call scramble', 'hard')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Wedding Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000005', v.text, v.diff, v.ord
from (values
  (1,  'Someone cries during the ceremony', 'easy'),
  (2,  'A toast that goes too long', 'medium'),
  (3,  'The Cha-Cha Slide or Cupid Shuffle', 'easy'),
  (4,  'Kids sliding across the dance floor', 'easy'),
  (5,  'An uncle with surprising dance moves', 'medium'),
  (6,  'Someone barefoot with heels in hand', 'easy'),
  (7,  'Phone flashlights during a slow song', 'hard'),
  (8,  'The photographer lying on the ground for a shot', 'medium'),
  (9,  'A guest in white being judged', 'hard'),
  (10, 'Bouquet toss chaos', 'medium'),
  (11, 'Someone sneaks extra cake', 'medium'),
  (12, 'Grandma on the dance floor', 'medium'),
  (13, 'A groomsman loses his boutonniere', 'hard'),
  (14, 'An open-bar line longer than the buffet', 'easy'),
  (15, 'The DJ mispronounces a name', 'hard'),
  (16, 'A ring bearer or flower girl goes rogue', 'medium'),
  (17, 'Someone recording the first dance vertically', 'easy'),
  (18, 'Matching bridesmaid robes or jackets', 'medium'),
  (19, 'A guest asleep at a table', 'hard'),
  (20, 'The couple does a choreographed dance', 'hard'),
  (21, 'A best man pulls out folded paper notes', 'easy'),
  (22, 'Someone loosens their tie by hour two', 'easy'),
  (23, 'Signature cocktail with a pun name', 'medium'),
  (24, 'The table centerpiece gets moved for food room', 'easy'),
  (25, 'A conga line forms', 'hard'),
  (26, 'Someone tears up during the toasts', 'easy'),
  (27, 'Late-night snack (pizza, sliders, tacos) appears', 'medium'),
  (28, 'A kid in formalwear with sneakers', 'medium'),
  (29, 'Someone catches the garter and regrets it', 'hard'),
  (30, 'The venue staff resetting chairs mid-event', 'medium'),
  (31, 'A guest who knows every single song', 'easy'),
  (32, 'Champagne pop heard across the room', 'medium'),
  (33, 'The couple visits every table', 'medium'),
  (34, 'Someone fixes the bride''s train or veil', 'easy'),
  (35, 'Disposable cameras or a photo booth line', 'medium'),
  (36, 'An emotional father-daughter or mother-son dance', 'easy'),
  (37, 'Someone trades seats to sit with friends', 'easy'),
  (38, 'Sparkler, bubble, or confetti send-off', 'hard'),
  (39, 'A guest double-fisting drinks "for a friend"', 'medium'),
  (40, 'The last song brings everyone to the floor', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Tailgate Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000006', v.text, v.diff, v.ord
from (values
  (1,  'A grill with a line of people around it', 'easy'),
  (2,  'Cornhole game in progress', 'easy'),
  (3,  'A team flag flying from a truck', 'easy'),
  (4,  'Full body paint or face paint', 'medium'),
  (5,  'A TV running on a generator', 'medium'),
  (6,  'Someone in a jersey of a retired player', 'easy'),
  (7,  'A cooler that requires two people to carry', 'easy'),
  (8,  'A questionable parking job', 'easy'),
  (9,  'Someone frying a turkey or something ambitious', 'hard'),
  (10, 'A dog wearing team gear', 'medium'),
  (11, 'A canopy tent losing to the wind', 'medium'),
  (12, 'Beer pong or flip cup table', 'medium'),
  (13, 'A stranger offered food by another group', 'medium'),
  (14, 'Rival fans walking through and getting heckled', 'medium'),
  (15, 'A speaker battle between two tailgates', 'medium'),
  (16, 'Someone already sunburned before kickoff', 'medium'),
  (17, 'An RV with a full setup', 'easy'),
  (18, 'Foam finger spotted', 'medium'),
  (19, 'Someone tossing a football too close to food', 'easy'),
  (20, 'A folding chair failure', 'hard'),
  (21, 'Matching group shirts with a slogan', 'medium'),
  (22, 'The one person still working on a laptop', 'hard'),
  (23, 'A porta-potty line strategy discussion', 'medium'),
  (24, 'Someone grilling in team-branded apron or mitts', 'medium'),
  (25, 'A parking lot lap "just to see the setups"', 'easy'),
  (26, 'Ladder golf or another retro yard game', 'medium'),
  (27, 'A radio pregame show playing loudly', 'easy'),
  (28, 'Someone predicting the final score confidently', 'easy'),
  (29, 'A kid throwing a perfect spiral', 'medium'),
  (30, 'A cowbell, air horn, or vuvuzela', 'medium'),
  (31, 'A tent with a chandelier-level setup', 'hard'),
  (32, 'The tinfoil tray buffet table', 'easy'),
  (33, 'Someone lost trying to find their group', 'medium'),
  (34, 'A fan in gear from head to toe including socks', 'medium'),
  (35, 'A "we should have left earlier" conversation', 'medium'),
  (36, 'Someone icing a drink in a helmet', 'hard'),
  (37, 'A generator that will not start', 'hard'),
  (38, 'The pregame walk of players or the band', 'hard'),
  (39, 'A group photo with the stadium behind', 'easy'),
  (40, 'Pack-up scramble at kickoff time', 'medium')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Grocery Store Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000007', v.text, v.diff, v.ord
from (values
  (1,  'A cart with a squeaky or broken wheel', 'easy'),
  (2,  'Someone sampling grapes before buying', 'medium'),
  (3,  'A cart left in the middle of the aisle', 'easy'),
  (4,  'Someone on the phone asking "which kind?"', 'easy'),
  (5,  'A kid begging for cereal or candy', 'easy'),
  (6,  'Free sample station with a line', 'medium'),
  (7,  'Someone smelling the produce', 'easy'),
  (8,  'A dropped jar or spill cleanup', 'hard'),
  (9,  'Reusable bags forgotten in the car (overheard)', 'medium'),
  (10, 'The person with just milk and eggs in a huge cart', 'medium'),
  (11, 'Self-checkout "unexpected item" meltdown', 'easy'),
  (12, 'Someone counting items in the express lane', 'medium'),
  (13, 'A coupon negotiation at the register', 'medium'),
  (14, 'Two carts gridlocked in one aisle', 'easy'),
  (15, 'Someone reading a label for a full minute', 'easy'),
  (16, 'A kid riding under the cart', 'medium'),
  (17, 'An abandoned cold item on a random shelf', 'medium'),
  (18, 'The endcap display nobody can resist', 'easy'),
  (19, 'Someone asks staff where an item is', 'easy'),
  (20, 'A cart with one wheel off the ground turning', 'hard'),
  (21, 'Flowers being bought last-minute', 'medium'),
  (22, 'Someone comparing two identical-looking items', 'easy'),
  (23, 'A full cart in the 15-items-or-less lane', 'hard'),
  (24, 'The birthday cake window shopper', 'medium'),
  (25, 'Rotisserie chicken in a cart', 'easy'),
  (26, 'Someone doubling back for a forgotten item', 'easy'),
  (27, 'A toddler pushing a mini cart', 'medium'),
  (28, 'Someone lost in the international aisle', 'medium'),
  (29, 'The freezer-door fog stare', 'easy'),
  (30, 'A price-check announcement or wait', 'hard'),
  (31, 'Someone bags their own groceries at full speed', 'medium'),
  (32, 'A grocery list on actual paper', 'medium'),
  (33, 'Someone eating a snack they have not paid for yet', 'medium'),
  (34, 'Cart return corral overflowing', 'medium'),
  (35, 'The couple splitting up to shop faster', 'medium'),
  (36, 'A pyramid display someone almost bumps', 'hard'),
  (37, 'Someone checking eggs for cracks', 'easy'),
  (38, 'The last cart with no baskets left', 'hard'),
  (39, 'A "cleanup on aisle" moment announced', 'hard'),
  (40, 'Someone pays in exact change', 'hard')
) as v(ord, text, diff);

-- ---------------------------------------------------------------------------
-- Road Trip Bingo
-- ---------------------------------------------------------------------------
insert into public.game_squares (game_template_id, text, difficulty, sort_order)
select '00000000-0000-4000-8000-000000000008', v.text, v.diff, v.ord
from (values
  (1,  'A license plate from 500+ miles away', 'easy'),
  (2,  'A car with a mattress on the roof', 'hard'),
  (3,  'Billboard for an attraction 100 miles ahead', 'easy'),
  (4,  'Someone singing hard in their car', 'medium'),
  (5,  'A dog with its head out the window', 'easy'),
  (6,  'Roadside fruit or fireworks stand', 'medium'),
  (7,  'A truck hauling something unidentifiable', 'medium'),
  (8,  'Gas station hot dog roller in motion', 'easy'),
  (9,  'The world''s largest [anything] sign', 'hard'),
  (10, 'A minivan with a stick-figure family', 'easy'),
  (11, 'Someone asleep in the passenger seat, mouth open', 'easy'),
  (12, 'A rest stop vending machine argument', 'hard'),
  (13, 'Construction zone with zero workers visible', 'medium'),
  (14, 'A car packed to the ceiling', 'easy'),
  (15, 'An RV towing a car towing bikes', 'hard'),
  (16, 'Historic marker nobody stops for', 'medium'),
  (17, 'A bumper sticker manifesto', 'medium'),
  (18, 'Someone eating a full meal while driving', 'medium'),
  (19, 'A wind farm or endless cornfield', 'easy'),
  (20, 'The gas price double-take', 'easy'),
  (21, 'A tourist family unfolding a paper map', 'hard'),
  (22, 'Motorcycle group of five or more', 'medium'),
  (23, 'A car with one very different wheel', 'medium'),
  (24, 'Water tower with the town name', 'easy'),
  (25, 'Someone stretching dramatically at a rest stop', 'easy'),
  (26, 'A semi with a funny mud flap or airbrushed art', 'medium'),
  (27, 'Fast-food bag launched toward a trash can', 'medium'),
  (28, 'The "last exit for gas" panic sign', 'medium'),
  (29, 'A hitchhiking thumb or cardboard sign', 'hard'),
  (30, 'A speed trap spotted too late by someone else', 'medium'),
  (31, 'Kids screens glowing in a back seat', 'easy'),
  (32, 'A car dealership inflatable tube dancer', 'medium'),
  (33, 'Antique or classic car on the highway', 'medium'),
  (34, 'A U-Haul changing lanes bravely', 'easy'),
  (35, 'Someone reorganizing a trunk at a gas station', 'medium'),
  (36, 'A diner claiming world-famous anything', 'medium'),
  (37, 'The exact same car as yours, waved at or not', 'hard'),
  (38, 'A state welcome sign photo stop', 'hard'),
  (39, 'Cows. Just, cows.', 'easy'),
  (40, 'The driver refuses to stop "until the next town"', 'medium')
) as v(ord, text, diff);
