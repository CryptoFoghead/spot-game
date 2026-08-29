PRODUCT REQUIREMENTS DOCUMENT
Working Title: SPOT — Social People-Watching Bingo
Document Type: Product Requirements + Technical Build SpecificationVersion: 1.0Target: Launchable MVPPrimary Platform: Mobile-first web / PWARecommended Stack: Next.js 16 + TypeScript + Supabase + VercelPrimary Development Method: Claude CodeProduct Category: Social game / real-world multiplayer game

1. Executive Summary
SPOT is a mobile-first multiplayer social game that turns real-world people-watching into a competitive bingo experience.
A host creates or chooses a bingo game based on a location, event, activity, or theme. Players join the game using a QR code or short room code. Each player receives a randomized bingo card made from the same pool of observations.
Players tap squares as they observe them in the real world. Scores, player progress, Bingo status, and game activity update live for everyone.
Examples include:
- Airport Bingo
- Iowa State Fair Bingo
- Youth Basketball Tournament Bingo
- Bar Bingo
- Wedding Bingo
- Cruise Ship Bingo
- Tailgate Bingo
- Family Vacation Bingo
- Office Meeting Bingo
- Theme Park Bingo
The product should require essentially no explanation.
The desired flow is:
Open → Pick/Create → Start → Scan → Play
No app installation is required.
No account is required to join a game.

2. Product Vision
The product should not be marketed primarily as a bingo-card generator.
The larger concept is:
The multiplayer game happening all around you.
Players do not need a game board, cards, dice, trivia questions, or prepared entertainment.
The environment supplies the content.
The application turns ordinary environments into social games.
The core product advantages are:
- Immediate participation
- Real-time multiplayer
- User-generated games
- AI-assisted creation
- Location-specific humor
- No installation requirement
- QR-code joining
- Every player receives a unique card
- Community-created content can eventually scale the catalog
- Built for phones from the beginning

3. Product Principles
Every product decision should favor these principles.
3.1 Joining must be nearly frictionless
A player should be able to:
- Scan QR
- Enter nickname
- Tap Join
- Play
Do not require registration.
Do not require email.
Do not require password.
Do not require app installation.

3.2 Creating should not feel like work
Creators should never stare at 25 empty boxes wondering what to type.
Creation methods:
AI Create
Creator enters:
Iowa State Fair
AI generates suggestions.
Manual Create
Creator enters every item manually.
AI + Edit
Preferred mode.
AI supplies ideas and the creator changes them.
This should eventually become the default creation experience.

4. Terminology
Use consistent terminology throughout code and UI.
Game Template
A reusable bingo configuration containing title, description, category, content level, and a pool of possible squares.
Example:
Iowa State Fair Bingo

Room
A live multiplayer session created from a Game Template.
Example:
Room 4827

Host
The person controlling a Room.

Player
A person participating in a live Room.

Square
One possible observation.
Example:
Someone carrying more than three drinks.

Card
The specific 5×5 layout assigned to one Player.

Mark
A Player indicating they observed a Square.

5. Target Users
Primary
Groups of 2–12 friends or family members.
Common environments:
- airport
- bar
- sporting event
- fair
- festival
- wedding
- vacation
- amusement park
- restaurant
- shopping
- tailgate

Secondary
Larger social groups.
Examples:
- bachelor/bachelorette parties
- family reunions
- corporate outings
- tournaments
- conferences

Future Commercial Users
- bars
- breweries
- resorts
- festivals
- conferences
- event companies
- tourism organizations
- sports organizations

6. Launch MVP
The MVP is the version that should be built first.
Do NOT allow Claude to continuously expand scope while building.
MVP functionality
Game creation
- Create Game Template
- Enter title
- Enter optional description
- Select category
- Select content level
- Add/edit/delete Square
- AI suggestion endpoint
- Save Game Template
- Public/private toggle
Game library
- Built-in starter Games
- User-created Games
- View Game
- Start Room
- Duplicate Game
Multiplayer
- Start Room
- Generate short Room code
- Generate QR code
- Join anonymously
- Choose nickname
- Unique randomized Card for every Player
- Realtime Room updates
- Mark/unmark Square
- Live score/progress
- Bingo detection
- Winner event
- Continue after Bingo option
- End Room
Host
- View Players
- Start Room
- Pause Room
- Resume Room
- End Room
- Remove Player
- Select win mode
- Copy Room link
- Display QR code
Authentication
Accounts only required to:
- create saved Games
- maintain a Game library
- edit owned Games
Players joining Rooms remain anonymous.

7. Explicitly Excluded From Initial Build
Unless everything else is working and tested, do NOT build:
- native iOS application
- native Android application
- public creator profiles
- comments
- following creators
- achievements
- complex badges
- push notifications
- direct messaging
- tournament brackets
- business dashboards
- advertising system
- complicated subscriptions
- advanced analytics UI
- user-uploaded photos
- player chat
- geolocation requirements
These can come later.

8. Recommended Technology
Frontend
Next.js 16
Use:
- App Router
- TypeScript
- Server Components where appropriate
- Client Components only where interactivity requires them
- Server Actions/Functions for mutations where appropriate
- Route Handlers for webhook/API-style endpoints
Next.js App Router is the current recommended architecture and supports Server Components and Server Functions.

Styling
Tailwind CSS
Recommended component library:
shadcn/ui
Recommended icons:
Lucide React
Avoid unnecessary UI libraries.

Database/backend
Supabase
Use:
- PostgreSQL
- Auth
- Realtime
- Row Level Security
- database functions/RPCs where transactions are useful

Realtime
Use:
Supabase Broadcast
For:
- square marked
- square unmarked
- player score changed
- player joined
- player removed
- game started
- game paused
- game resumed
- Bingo
- game ended
Supabase Presence
For:
- active players
- online/offline indication
Persist authoritative game state to PostgreSQL.
Realtime messages improve responsiveness but must not be the sole source of truth.
Supabase currently recommends Broadcast over Postgres Changes for better scalability/security in realtime scenarios.

9. Security Architecture
Security is mandatory from the beginning.
Enable RLS on every table exposed through Supabase.
Supabase recommends RLS for granular authorization and notes that exposed tables should be protected accordingly.
Never expose:
- Supabase service-role/secret key
- AI API secret
- Stripe secret
- administrative functions
to the browser.
Client may use only the Supabase publishable key.
Server-only secrets belong in environment variables.

10. Authentication Strategy
Creators
Supabase Auth.
MVP sign-in methods:
- Email magic link
- Google optional
Avoid password-management complexity initially.

Players
Do not require Supabase account registration.
Create a guest identity/session.
Recommended implementation:
Generate:
guest_token
UUID stored in:
- secure browser storage or cookie
- associated room_players record
The player receives an opaque guest access token generated server-side.
Never rely only on nickname for identity.

11. Database Schema
Use UUID primary keys except Room codes.
All timestamps use timestamptz.

profiles
profiles
--------
id uuid primary key references auth.users(id)
display_name text
avatar_url text null
created_at timestamptz default now()
updated_at timestamptz default now()

game_templates
game_templates
--------------
id uuid primary key default gen_random_uuid()

creator_id uuid references auth.users(id) null

title text not null
slug text null
description text null

category text not null
content_rating text not null default 'family'

visibility text not null default 'private'
-- private
-- unlisted
-- public

status text not null default 'draft'
-- draft
-- published
-- archived

card_size integer not null default 5

free_center boolean not null default true

play_count integer not null default 0

created_at timestamptz default now()
updated_at timestamptz default now()
published_at timestamptz null
CHECK:
card_size BETWEEN 3 AND 7
CHECK:
content_rating IN ('family','standard','unfiltered')
CHECK:
visibility IN ('private','unlisted','public')

game_squares
game_squares
------------
id uuid primary key default gen_random_uuid()

game_template_id uuid not null
references game_templates(id)
on delete cascade

text text not null

points integer not null default 1

difficulty text null

sort_order integer null

is_active boolean not null default true

created_at timestamptz default now()
updated_at timestamptz default now()
Validate Square text:
- minimum 2 characters
- recommended max 120 characters
- hard max 180 characters
MVP requires at least 24 active Squares when FREE center is enabled.
Without FREE center, require at least 25.
Recommended Game creation target:
40–60 Squares.

12. Categories
Use a lookup table instead of hardcoding long term.
categories
categories
----------
id uuid primary key
slug text unique not null
name text not null
icon text null
sort_order integer
active boolean default true
Seed:
- airport
- airplane
- road-trip
- cruise
- hotel
- theme-park
- county-fair
- state-fair
- concert
- festival
- wedding
- graduation
- youth-basketball
- youth-baseball
- football-game
- basketball-game
- tailgate
- golf
- mall
- grocery-store
- restaurant
- coffee-shop
- bar
- brewery
- office
- conference
- family-reunion
- custom

13. Rooms
rooms
-----
id uuid primary key default gen_random_uuid()

game_template_id uuid not null
references game_templates(id)

host_user_id uuid references auth.users(id) null

room_code varchar(6) unique not null

status text not null default 'lobby'

game_mode text not null default 'classic'

continue_after_win boolean default true

started_at timestamptz null
paused_at timestamptz null
ended_at timestamptz null

winner_player_id uuid null

created_at timestamptz default now()
updated_at timestamptz default now()

expires_at timestamptz not null
Room statuses:
lobby
active
paused
completed
expired
Game modes initially:
classic
blackout
Schema should allow later:
double
four_corners
timed
points
endless

14. Room Players
room_players
------------
id uuid primary key default gen_random_uuid()

room_id uuid not null
references rooms(id)
on delete cascade

user_id uuid references auth.users(id) null

guest_token_hash text null

nickname text not null

role text not null default 'player'

status text not null default 'active'

score integer not null default 0

marked_count integer not null default 0

has_bingo boolean not null default false

bingo_at timestamptz null

joined_at timestamptz default now()
last_seen_at timestamptz default now()
Roles:
host
player
Statuses:
active
removed
left
Nickname constraints:
- 1–24 characters
- sanitize control characters
- reject empty/whitespace-only names
Duplicate names should be allowed but UI may show:
RyanRyan (2)

15. Player Cards
player_cards
------------
id uuid primary key default gen_random_uuid()

room_player_id uuid not null unique
references room_players(id)
on delete cascade

room_id uuid not null
references rooms(id)
on delete cascade

created_at timestamptz default now()

16. Player Card Squares
player_card_squares
-------------------
id uuid primary key default gen_random_uuid()

player_card_id uuid not null
references player_cards(id)
on delete cascade

game_square_id uuid null
references game_squares(id)

position integer not null

row_index integer not null
column_index integer not null

display_text text not null

is_free boolean default false

marked boolean default false

marked_at timestamptz null
Unique:
(player_card_id, position)
For a 5×5 card:
positions:
0–24
Center:
12
If FREE center:
display_text = "FREE"
is_free = true
marked = true

17. Player Marks / Audit History
Although marked state exists on player_card_squares, also maintain an audit/event table.
room_events
-----------
id uuid primary key default gen_random_uuid()

room_id uuid not null
references rooms(id)
on delete cascade

room_player_id uuid null
references room_players(id)

event_type text not null

payload jsonb null

created_at timestamptz default now()
Events:
player_joined
player_left
player_removed
game_started
game_paused
game_resumed
square_marked
square_unmarked
bingo
game_completed
This becomes useful later for:
- activity feeds
- analytics
- troubleshooting
- replay
- fraud investigation

18. Card Generation Algorithm
Card creation must occur server-side.
Pseudo-flow:
load active squares from template

validate enough squares exist

shuffle using cryptographically reasonable randomization

take 24 if free-center
or 25 without free-center

create card

assign positions

insert all card squares

return card
Do not allow client browser to determine authoritative card contents.
Each player receives an independently shuffled selection.
With pools greater than 24/25, players can receive different Squares as well as different positioning.
This creates better replayability.

19. Join Room Flow
URL:
/join/[roomCode]
Example:
/join/4827
Flow:
- Load Room
- Validate Room exists
- Validate not expired
- Validate not completed
- Show Game title
- Show content rating
- Enter nickname
- Player taps JOIN GAME
- Server creates room_player
- Server generates guest token
- Server generates Card
- Store guest session
- Broadcast player_joined
- Redirect /room/[roomCode]/play
Player should reach board in seconds.

20. Room Code
Use 4–6 characters.
Preferred MVP:
4 digits
Example:
4827
Avoid easily confusing alphabetic characters.
When Room volume becomes large, migrate to 6-character alphanumeric codes.
Generation:
Generate random code.
Check uniqueness among active Rooms.
Retry if collision.
Do not rely on Room code as authorization.
Room code is discovery only.
Guest token determines Player identity.

21. QR Codes
When Room is created:
Generate join URL:
https://domain.com/join/4827
Render QR dynamically.
Do not initially store QR images.
Recommended package:
qrcode
or equivalent lightweight React QR component.
Host screen includes:
SCAN TO JOIN
Room 4827
QR
Copy Link

22. Game State Machine
Allowed transitions:
LOBBY → ACTIVE

ACTIVE → PAUSED

PAUSED → ACTIVE

ACTIVE → COMPLETED

PAUSED → COMPLETED
Do not permit:
COMPLETED → ACTIVE
Instead provide:
Play Again
which creates a new Room.

23. Mark Square Transaction
This is important.
When Player taps Square:
Call authoritative server/database operation.
Recommended RPC:
toggle_card_square(
    player_id,
    card_square_id,
    guest_token
)
Transaction should:
- Authenticate Player
- Confirm Room active
- Confirm Card belongs to Player
- Toggle marked status
- Update marked_at
- Recalculate marked count
- Calculate Bingo
- Update Player
- Insert room_event
- If first Bingo, update winner if appropriate
- Return updated game state
This should be atomic.
Avoid:
client sets Squarethen client separately updates scorethen client separately checks Bingo
That creates race-condition opportunities.

24. Bingo Detection
For 5×5:
Winning sets:
Rows:
0 1 2 3 4
5 6 7 8 9
10 11 12 13 14
15 16 17 18 19
20 21 22 23 24
Columns:
0 5 10 15 20
1 6 11 16 21
2 7 12 17 22
3 8 13 18 23
4 9 14 19 24
Diagonals:
0 6 12 18 24
4 8 12 16 20
Classic wins when any set is fully marked.
Blackout wins when all 25 positions are marked.
FREE center counts as marked.
Bingo detection must run server-side.
Client may calculate visually but does not determine official win state.

25. First Winner Behavior
When Player achieves Bingo:
Transaction:
if room.winner_player_id IS NULL:
    room.winner_player_id = player.id

player.has_bingo = true
player.bingo_at = now()
Create:
event_type = bingo
Broadcast:
{
  "type": "BINGO",
  "playerId": "...",
  "nickname": "Ryan",
  "timestamp": "..."
}
All clients show celebration.
If:
continue_after_win = true
Room stays active.
Otherwise Room transitions to completed.

26. Realtime Channels
Use one Room-scoped channel:
room:{room_id}
Example:
room:75f73c...
Never use public Game title as authorization boundary.
Events:
PLAYER_JOINED
PLAYER_LEFT
PLAYER_REMOVED

ROOM_STARTED
ROOM_PAUSED
ROOM_RESUMED
ROOM_ENDED

SQUARE_MARKED
SQUARE_UNMARKED

PLAYER_PROGRESS
BINGO

27. Presence
Presence payload:
{
  "playerId": "...",
  "nickname": "Ryan",
  "role": "player"
}
Presence is used ONLY for UI connectivity.
Do not infer participation records from Presence.
Database is authoritative.

28. Optimistic UI
When Square tapped:
Immediately visually mark it.
Send mutation.
If server succeeds:
keep state.
If server fails:
revert Square.
Show toast:
Could not update. Try again.
The game should feel instant.

29. Reconnection
Mobile connectivity will frequently be imperfect.
Design for:
- airport Wi-Fi
- cellular dead spots
- crowded events
- stadium networks
When realtime reconnects:
Fetch authoritative Room state.
Fetch current player's Card.
Reconcile UI.
Never assume missed Broadcast messages will eventually reconstruct state.

30. Player Game Screen
Mobile-first.
Header:
Iowa State Fair Bingo

Room 4827
● LIVE
Below:
You: 14
Leader: Mike 16
Then:
5×5 board
Then bottom navigation/actions:
Board
Players
Room
Do not waste valuable vertical screen space.

31. Bingo Board UX
Squares should be large enough to tap.
Use responsive CSS Grid:
grid-cols-5
Each Square displays:
- short text
- marked state
- optional points later
Marked Square:
- obvious checkmark
- strong fill/background
- still readable
Unmarked:
- clear borders
- easy tap target
Center:
FREE
Do not put tiny checkboxes inside squares.
The entire tile is the button.

32. Player Drawer / Leaderboard
Show:
1. Mike       16
2. Ryan       14
3. Jen        11
4. Amy         9
Optional indicators:
🔥 = one Square from Bingo
🏆 = Bingo
● = online
Avoid revealing another Player's entire Card.

33. Lobby Screen
Host view:
Iowa State Fair Bingo

ROOM 4827

[ QR CODE ]

Players

✓ Ryan
✓ Mike
✓ Jen
✓ Amy

4 Players

[ START GAME ]
Player view:
You're in!

Waiting for host...

Players
Ryan
Mike
Jen
Amy
When host starts:
broadcast ROOM_STARTED.
All clients transition automatically.

34. Winner Experience
Full-screen modal/overlay:
🎉 BINGO!

RYAN GOT BINGO

14 squares spotted
Buttons host may see:
Keep Playing
End Game
Other Players:
Keep Playing
View Leaderboard
Do not automatically navigate everyone away from their Card.

35. Game Creation Screen
Route:
/create
Step-based interface.
Step 1
What are we watching?
Input:
Iowa State Fair
Buttons:
✨ Generate Ideas
Start From Scratch

Step 2
Settings:
Title
Description
Category
Content rating:
Family
Standard
Unfiltered
Visibility:
Private
Unlisted
Public

Step 3
Squares.
Each generated Square appears as editable card/list item.
Example:
☰ Someone carrying a giant turkey leg
                 Edit   Delete
Actions:
+ Add Square

✨ Add 10 Ideas

✨ Replace Weak Ideas
Counter:
42 Squares
Minimum: 24
Recommended: 40+

36. AI Generation
Implement through server-side route:
POST /api/ai/generate-squares
Input:
{
  "location": "Iowa State Fair",
  "category": "state-fair",
  "rating": "standard",
  "count": 40,
  "existingSquares": []
}
Expected structured result:
{
  "title": "Iowa State Fair Bingo",
  "description": "...",
  "squares": [
    {
      "text": "Someone carrying a giant turkey leg",
      "difficulty": "easy"
    }
  ]
}
Require structured JSON output.
Validate server-side before returning.

37. AI System Prompt
Use approximately:
You create funny, observable, respectful squares for a social
people-watching bingo game.

Every square must describe something a player can reasonably observe
in a public or social environment.

Rules:

- Keep each square concise.
- Do not require interacting with strangers.
- Do not require photographing strangers.
- Do not identify a specific private individual.
- Do not target protected characteristics.
- Avoid cruelty, humiliation, or harassment.
- Avoid dangerous behavior.
- Avoid sexually explicit descriptions.
- Avoid duplicates and near-duplicates.
- Make the observations specific enough to be entertaining.
- Vary difficulty.
- Match the requested content rating.
- Return valid structured JSON only.

38. AI Content Ratings
Family
Suitable for children.
No:
- alcohol jokes
- profanity
- sexual references
- crude observations

Standard
General adult/social humor.
May reference:
- beer
- mild awkward behavior
- funny clothing
- social situations
Still avoid explicit material.

Unfiltered
Edgier humor.
Still prohibit:
- hate
- harassment
- protected-class targeting
- explicit sexual content
- criminal encouragement
- photographing unsuspecting people
"Unfiltered" does not mean unlimited.

39. Built-In Starter Games
Seed 8–12 strong Games before launch.
Suggested:
- Airport Bingo
- State Fair Bingo
- Youth Basketball Bingo
- Bar & Brewery Bingo
- Wedding Bingo
- Tailgate Bingo
- Theme Park Bingo
- Grocery Store Bingo
- Road Trip Bingo
- Concert Bingo
- Cruise Bingo
- Office Meeting Bingo
Each should contain roughly:
40–60 Squares.
This makes the product enjoyable before user-generated content exists.

40. Home Page
Primary hero:
The game happening all around you.
Subtext:
Turn airports, fairs, games, bars, vacations and everyday people-watching into live multiplayer Bingo.
Buttons:
Start Playing
Create a Game
Secondary:
Join a Room
Room code input.
Then:
Popular Games
Category chips.
How it works:
- Pick a Game
- Invite your friends
- Spot it
- Get Bingo

41. Game Detail Page
Route:
/games/[slug]
Show:
Iowa State Fair Bingo

Standard

42 possible Squares

Great for fairs and festivals.
Buttons:
START GAME
Preview
Duplicate
If creator:
EDIT

42. My Games
Route:
/dashboard/games
Tabs:
Created
Drafts
Saved
MVP may omit Saved.
Cards show:
- title
- visibility
- Square count
- date updated
- Start Game
- Edit
- Duplicate
- Archive

43. Host Dashboard During Game
Route:
/room/[code]/host
Show:
Room code
QR
Players
Status
Leaderboard
Controls:
START
PAUSE
RESUME
END
COPY INVITE
Player overflow:
Remove Player

44. Host Authorization
Only Room host can:
- start
- pause
- resume
- end
- remove Players
Enforce server-side.
Never rely on hidden buttons.

45. Public vs Unlisted vs Private
Public
Visible in discovery/search.
Anyone may start Room.

Unlisted
Not searchable.
Anyone with URL may use.

Private
Only creator may access/start.
A private Game can still produce a Room where guests participate.

46. RLS Requirements
Claude must implement explicit policies.
profiles
SELECT:
public basic profile or authenticated as determined.
UPDATE:
auth.uid() = id

game_templates
SELECT permitted if:
visibility = 'public'
OR
visibility = 'unlisted' with direct authorized access
OR
creator_id = auth.uid()
UPDATE/DELETE:
creator_id = auth.uid()
INSERT:
authenticated user only.

game_squares
SELECT based on parent Game visibility.
INSERT/UPDATE/DELETE:
parent Game creator only.

rooms
Room state should be read only by participants and host, using controlled access path.
Sensitive host mutations must go through validated server/database functions.

room_players
Players may read limited Player information for their Room.
Players should not be able to arbitrarily update:
- score
- has_bingo
- role
- status
Those fields are server-controlled.

player_card_squares
Player reads own Card.
Do not expose every Player's exact Card by default.
Marks are changed via validated function.

47. RPC / Database Functions
Build transactional functions where useful.
Required:
create_room()
join_room()
start_room()
toggle_square()
pause_room()
resume_room()
end_room()
remove_player()
Optional:
get_room_snapshot()
The goal is avoiding multi-request race conditions.

48. create_room
Input:
game_template_id
game_mode
continue_after_win
Validate:
- Game exists
- requester authorized
- enough Squares
- Game not archived
Create:
- Room
- room code
- Host Room Player if desired
Return:
{
  "roomId": "...",
  "roomCode": "4827"
}

49. join_room
Input:
room_code
nickname
Server:
- validates Room
- creates guest token
- stores only hash server-side where appropriate
- creates room_player
- creates randomized Card
- returns guest credentials + Player/Card
Protect against replay abuse.

50. Player Score
For Classic MVP:
Score = number of marked non-free Squares.
Do not trust submitted score.
Calculate from database state.
Future Points mode:
sum Square points.

51. Activity Feed
Optional but easy after room_events exists.
Examples:
Mike spotted "Matching family shirts"

Jen joined the game

Ryan got BINGO!
Do not flood screen.
Show latest 5–10.

52. Community Phase
After MVP works:
Add Explore.
Route:
/explore
Sections:
Trending
Popular This Week
New
Categories
Search
Users may:
- Play
- Save
- Rate
- Duplicate
- Remix

53. Remix
Every copied Game should optionally store:
source_game_template_id
Then display:
Remixed from Iowa State Fair Bingo by Ryan
This can eventually create a creator network.

54. Ratings
Future table:
game_ratings
------------
id uuid
game_template_id uuid
user_id uuid
rating integer
created_at timestamptz
Unique:
(game_template_id, user_id)
Rating:
1–5.
Require account.

55. Moderation
Every public Game eventually gets:
Report Game
Table:
reports
-------
id uuid
reporter_user_id uuid null
game_template_id uuid
reason text
details text null
status text default 'open'
created_at timestamptz
Reasons:
- harassment
- hateful content
- sexual content
- unsafe behavior
- privacy concern
- spam
- other

56. Safety Rule
Display in appropriate places:
Keep it fun. Observe — don't harass, follow, photograph, or interfere with strangers.
The app's gameplay should never reward:
- photographing people
- approaching people
- provoking behavior
- following someone
- collecting private information

57. Data Retention
Recommended:
Anonymous completed Room detailed state:
retain 30–90 days initially.
Aggregate analytics can remain longer.
Users may delete their authored Games.
Accounts should eventually support deletion.
Avoid collecting unnecessary personal information.

58. Analytics Events
Implement lightweight product analytics.
Recommended events:
homepage_viewed
game_viewed
game_created
game_ai_generated
game_published

room_created
room_joined
room_started
square_marked
bingo_achieved
room_completed

invite_copied
qr_joined
game_duplicated
Important business metrics:
- Rooms created
- Players per Room
- Room start rate
- average session length
- Squares marked per Player
- percentage of Rooms producing Bingo
- Game reuse
- invite conversion
- AI generation usage

59. Monetization Architecture
Do not make payment integration a prerequisite for proving gameplay.
Prepare schema now.
Later options:
Free
- join unlimited Rooms
- play public Games
- manual creation
- basic multiplayer
Plus
Possible:
$2.99/month
or
$19.99/year
Features:
- AI creation
- unlimited private Games
- advanced modes
- no ads
- customization
Event Pass
Potential:
$4.99
72-hour access.
Useful for:
- weddings
- bachelor parties
- vacations
- reunions
Business
Custom pricing.

60. Stripe Architecture
When monetization is enabled, use Stripe Checkout initially rather than building custom card entry.
Stripe Checkout supports one-time payments and recurring subscriptions and minimizes payment UI development.
Store:
subscriptions
-------------
id uuid
user_id uuid
stripe_customer_id text
stripe_subscription_id text
stripe_price_id text
status text
current_period_end timestamptz
created_at timestamptz
updated_at timestamptz
Stripe webhook is authoritative for subscription status.
Never set premium status simply because browser returns from Checkout.

61. PWA
After basic game works:
Add:
manifest.webmanifest
Include:
- name
- short_name
- icons
- theme
- start_url
- display: standalone
This allows Add to Home Screen without native application development.
Do not let PWA work delay first deployment.

62. Responsive Requirements
Primary viewport:
iPhone-sized screen.
Test at:
375px
390px
430px
Tablet
Desktop
The board must never require horizontal scrolling.

63. Accessibility
Minimum:
- buttons keyboard accessible
- sufficient contrast
- marked state not represented only by color
- semantic buttons
- aria labels where necessary
- focus indicators
- readable font sizing

64. Error Handling
Friendly errors.
Example:
Bad Room code:
We couldn't find that Room.
Expired:
This game has ended.
Removed:
The host removed you from this game.
Connectivity:
Connection lost. Reconnecting…
Restored:
You're back online.

65. Rate Limiting
Rate-limit:
- Room creation
- Room joining
- AI generation
- nickname attempts
- mark requests
- report submissions
AI endpoint especially.
Never allow unauthenticated unlimited AI requests.
For MVP:
AI generation requires authenticated creator.

66. Environment Variables
Suggested:
NEXT_PUBLIC_SITE_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SECRET_KEY=

AI_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
Only variables prefixed appropriately should enter client bundle.
Supabase has moved toward publishable/secret key terminology, and its current Realtime documentation notes the newer key model.

67. Project Structure
Recommended:
/app

  /(marketing)
    page.tsx
    explore/
    games/[slug]/

  /(auth)
    login/
    auth/callback/

  /(dashboard)
    dashboard/
    create/
    games/[id]/edit/

  /join/[code]/

  /room/[code]/
    play/
    host/

  /api/
    ai/generate-squares/
    stripe/webhook/

/components

  /game
    BingoBoard.tsx
    BingoSquare.tsx
    Leaderboard.tsx
    PlayerList.tsx
    ActivityFeed.tsx

  /room
    RoomLobby.tsx
    RoomQRCode.tsx
    RoomHeader.tsx
    ConnectionStatus.tsx

  /creator
    GameEditor.tsx
    SquareEditor.tsx
    SquareList.tsx
    AIGenerator.tsx

  /ui

/lib

  /supabase
    client.ts
    server.ts
    admin.ts

  /game
    bingo.ts
    shuffle.ts
    scoring.ts

  /auth
    guest.ts

  /validation
    game.ts
    room.ts

/types

/supabase
  /migrations
  seed.sql

68. Coding Standards
Require:
- strict TypeScript
- no any unless unavoidable and documented
- Zod validation
- server-side authorization
- reusable components
- small files where practical
- descriptive names
- no hardcoded secrets
- no business logic duplicated in components
- database migrations committed to Git
- lint clean
- TypeScript build clean

69. Validation
Use Zod.
Examples:
Game:
title: 3–80 chars
description: <= 300
square text: 2–180
Nickname:
1–24
Room code:
exact expected format
Do not trust browser validation.

70. Seed Data
Create seed script.
At minimum launch with:
Airport Bingo
Example Squares:
- Shoes off at the gate
- Neck pillow already on
- Running toward a gate
- Oversized carry-on
- Sleeping across multiple seats
- Airport beer
- Gate crowd before boarding
- Someone arguing about bag size
- Matching luggage
- Charging outlet competition
Youth Basketball Bingo
Examples:
- Parent coaching from bleachers
- Ref hears about a travel
- Coach asks for a timeout angrily
- Player loses a shoe
- Someone yells "box out"
- Scorekeeper confusion
- Parent filming entire game
- Kid checks scoreboard during play
- Ball rolls onto another court
- Someone complains about the clock
Write full 40–60 Square pools for launch.

71. Testing Strategy
Use:
- unit tests for Bingo detection
- unit tests for Card generation
- integration tests for Room lifecycle
- integration tests for mark transaction
- browser/e2e testing for major flows
Recommended:
Vitest
Playwright

72. Mandatory Unit Tests
Bingo:
- each row
- each column
- both diagonals
- no false Bingo
- FREE center
- blackout
Card:
- correct Square count
- no duplicate Squares
- correct FREE center
- independent Card randomization

73. Mandatory E2E Scenario
Automate:
- Creator signs in
- Creator opens Game
- Creator starts Room
- Player A joins
- Player B joins
- Host starts
- Player A marks Squares
- Player B sees progress update
- Player A completes Bingo
- Player B sees Bingo alert
- Host ends Room
If this test fails, product is not release-ready.

74. Manual Multiplayer Test
Before launch:
Use:
- laptop host
- iPhone Player 1
- second browser/private window Player 2
- another phone if available
Test on separate networks if possible.
Test:
- join
- disconnect
- reconnect
- background Safari
- return
- refresh
- duplicate tap
- rapid taps
- host end
- Player removal

75. Performance Goals
Initial load:
target under ~2–3 seconds on normal LTE.
Square interaction:
visual response immediate.
Realtime event:
generally perceived under one second.
Avoid unnecessary page reloads.

76. SEO
Public Games should have server-rendered metadata.
Example title:
Iowa State Fair Bingo | SPOT
Description:
Play Iowa State Fair people-watching Bingo with friends. Start a multiplayer game and invite players instantly.
OpenGraph image eventually.

77. Share Experience
Share text:
Join my Iowa State Fair Bingo game.
Link includes Room code URL.
Use Web Share API on supported devices.
Fallback:
Copy Link.

78. Branding Direction
The brand should feel:
- playful
- modern
- social
- bold
- not childish
- not casino-like
Avoid traditional bingo aesthetics such as:
- bingo hall clip art
- bingo cage imagery
- dated red/blue styling
Think:
modern party/social game.

79. Possible Names
Do not delay coding waiting for final brand.
Use configurable product name.
Working options:
SPOT
Spotted
Spot Bingo
Bystander
Do not use a competitor-conflicting name.
Repository/code should use a neutral internal name if necessary:
spot-game

80. Definition of MVP Done
MVP is done when:
A new visitor can:
- open site
- choose an existing Game
- start a Room
- invite another person
- second person joins without registration
- both receive Cards
- host starts
- Player marks Squares
- updates appear live
- system accurately detects Bingo
- winner appears for all Players
- host ends Room
A logged-in creator can additionally:
- create Game
- add/edit/delete Squares
- use AI suggestions
- save Game
- reopen/edit it
- launch Room from it
If all 18 work reliably on mobile, launch.

81. BUILD ORDER FOR CLAUDE CODE
Claude should build in this exact sequence.
Phase 1 — Foundation
- create Next.js project
- TypeScript
- Tailwind
- shadcn
- Supabase clients
- environment config
- database migrations
- RLS
- seed categories
- seed Games
STOP.
Run:
npm run lint
npm run build
Fix all errors.
Commit.

Phase 2 — Game Library
Build:
- home page
- Game detail
- basic Explore
- create Game
- edit Game
- Square editor
No realtime yet.
Test.
Commit.

Phase 3 — Room Creation
Build:
- create Room
- Room code
- join URL
- QR
- lobby
- guest join
- player Card generation
Test two browsers.
Commit.

Phase 4 — Gameplay
Build:
- board
- Square marking
- atomic toggle
- score
- Bingo detection
- winner
- Room states
Test without realtime first if necessary.
Commit.

Phase 5 — Realtime
Add:
- Broadcast channel
- Presence
- Player joining
- progress updates
- Room status events
- Bingo events
- reconnect/resync
Test multiple devices.
Commit.

Phase 6 — AI
Build:
- AI endpoint
- structured response
- AI creator interface
- regenerate
- add suggestions
- duplicate filtering
- safety constraints
Commit.

Phase 7 — Polish
- loading states
- empty states
- error states
- mobile spacing
- QR sharing
- share sheet
- connection indicator
- animations
- winner celebration
Commit.

Phase 8 — QA
Run:
npm run lint
npm run typecheck
npm run test
npm run build
Then Playwright.
Fix everything.

Phase 9 — Deploy
- create production Supabase
- apply migrations
- add environment variables
- deploy Vercel
- configure Supabase redirect URLs
- verify production Realtime
- test phone-to-phone
Launch.

82. CLAUDE CODE OPERATING RULES
Give Claude these instructions.
You are the lead engineer for this project.

Do not redesign the product without asking.

Follow the PRD.

Work one phase at a time.

At the beginning of each phase:
1. inspect the existing repository
2. explain what you will change
3. identify migrations or environment variables
4. implement
5. run tests
6. run lint
7. run TypeScript/build checks
8. fix failures before stopping

Never leave TODO placeholders for core functionality.

Never fake server behavior with hardcoded frontend state when
the PRD requires persistence.

Never bypass RLS to make development easier.

Never expose server secrets to the client.

All authorization must be enforced server-side/database-side,
not only through UI controls.

Prefer database transactions/RPCs where multiple related
mutations must succeed atomically.

Do not introduce a new dependency unless it provides clear value.

Do not expand scope until the MVP acceptance criteria pass.

When something is ambiguous, choose the simplest implementation
that preserves the requirements and document the decision.

Maintain a BUILD_STATUS.md file containing:
- completed features
- current phase
- migrations applied
- environment variables required
- known issues
- next actions

83. FIRST CLAUDE CODE PROMPT
Paste the entire PRD into the repository as:
docs/PRD.md
Then give Claude:
Read docs/PRD.md completely.

We are building this application from scratch today.

Act as lead engineer.

First inspect the current repository and installed dependencies.

Then create a detailed implementation checklist in
docs/BUILD_PLAN.md mapping every MVP requirement to:

- database
- backend
- frontend
- realtime
- tests

Do not begin broad implementation until the plan exists.

After the plan is created, begin Phase 1 only.

Phase 1 includes:

- Next.js 16 App Router
- TypeScript strict mode
- Tailwind
- shadcn/ui
- Supabase browser/server clients
- environment variable validation
- complete initial database migration
- RLS policies
- seed categories
- seed starter games
- foundational layout/navigation

Use current supported package APIs.

When Phase 1 is complete:

- run lint
- run TypeScript checking
- run tests that exist
- run production build

Fix every error.

Update docs/BUILD_STATUS.md.

Then stop and give me:

1. what was built
2. database changes
3. environment variables I need to supply
4. commands I need to run
5. anything blocking Phase 2

Do not begin Phase 2 until Phase 1 is clean.

84. SECOND CLAUDE PROMPT
After Phase 1 succeeds:
Read docs/PRD.md, docs/BUILD_PLAN.md and docs/BUILD_STATUS.md.

Implement Phase 2: Game Templates and creator experience.

Requirements:

- home page
- browse starter Games
- Game detail page
- authentication
- My Games
- Create Game
- Edit Game
- Square creation
- Square editing
- Square deletion
- validation
- Game visibility
- content ratings
- Duplicate Game

Do not implement multiplayer yet.

The UI must be mobile-first.

All mutations must enforce ownership server-side.

Add appropriate tests.

Run lint, typecheck, tests and production build.

Fix every failure.

Update BUILD_STATUS.md and stop.

85. THIRD CLAUDE PROMPT
Implement Phase 3 from the PRD.

Build Room creation and joining.

Required:

- create_room authoritative server/database operation
- unique Room code
- QR join link
- Room lobby
- host controls
- anonymous guest Player joining
- secure guest token
- nickname validation
- randomized server-generated Card
- FREE center
- Player list
- start Room

Do not implement realtime gameplay yet unless needed for lobby
functionality.

Test the entire flow using at least two separate browser contexts.

Add automated tests where practical.

Run lint, typecheck, tests and production build.

Fix all failures and update BUILD_STATUS.md.

86. FOURTH CLAUDE PROMPT
Implement authoritative gameplay.

Required:

- BingoBoard
- BingoSquare
- mark/unmark
- atomic toggle_square operation
- marked count
- score
- Classic Bingo detection
- Blackout detection
- winner persistence
- Room pause/resume/end
- prevent marking unless Room is active
- prevent Player from modifying someone else's Card

Add comprehensive unit tests for Bingo detection.

Add integration tests for Square marking.

Run all checks and fix every failure.

87. FIFTH CLAUDE PROMPT
Implement Supabase Realtime.

Use Room-scoped channels.

Use Broadcast for game events and Presence for connectivity.

The database remains authoritative.

Implement:

- player joined
- player left/presence
- Room started
- Room paused
- Room resumed
- Room ended
- Square progress
- leaderboard updates
- Bingo notification
- winner overlay

Implement reconnect behavior:

When reconnecting, fetch a fresh authoritative Room snapshot
and Player Card rather than assuming all Broadcast events were
received.

Test with at least two simultaneous browser contexts.

Do not consider this complete until one Player's actions update
the other Player's screen without manual refresh.

88. SIXTH CLAUDE PROMPT
Implement AI-assisted Game creation.

Create a server-only AI service.

Requirements:

- authenticated creator only
- rate limiting
- structured JSON response
- Zod validation
- request context:
  location/theme
  category
  content rating
  number of Squares
  existing Squares
- duplicate detection
- safe-generation system prompt from PRD

Creator features:

- Generate Ideas
- Add 10 More
- edit generated Square
- delete generated Square
- regenerate suggestion

AI key must never reach the client.

Add error/loading states.

Run all checks.

89. FINAL CLAUDE RELEASE PROMPT
We are preparing the MVP for production.

Read the entire PRD and compare every MVP requirement against
the implementation.

Create docs/RELEASE_AUDIT.md.

For every MVP requirement mark:

PASS
FAIL
PARTIAL

Do not mark PASS unless you verified it.

Fix every FAIL that prevents the core flow.

Then run:

- lint
- TypeScript validation
- unit tests
- integration tests
- Playwright E2E tests
- production build

Perform an E2E test:

creator opens Game
creator starts Room
Player A joins
Player B joins
host starts
Player A marks Squares
Player B sees realtime progress
Player A gets Bingo
Player B sees winner
host ends game

Test mobile layouts.

Check for exposed secrets.

Review RLS.

Review all server actions/routes for authorization.

Review guest Player authorization.

Review AI rate limiting.

List all remaining non-blocking issues.

Do not add new features.

The goal is a stable deployable MVP.

90. TODAY'S SUCCESS CRITERIA
Do not measure today's success by whether every business idea is implemented.
The goal is:
Tonight, two people can open their phones, join the same Room, play a real people-watching Bingo game against one another, and experience a live winner.
If that works reliably, the core product exists.
Everything else can iterate from there.

91. POST-MVP PRIORITY ORDER
Once real people have played:
- Improve gameplay based on observations
- Community Game library
- Clone/remix
- Ratings
- Search
- Timed mode
- Points mode
- Party/TV screen
- Monetization
- Event passes
- Business/event offering
- Native apps only if usage justifies them

92. PRODUCT NORTH STAR
The metric that matters most initially:
Completed multiplayer Rooms per week
Supporting:
Players per completed Room
A Game that gets hundreds of web visitors but very few actual multiplayer Rooms is not succeeding.
A Game where hosts consistently invite 3–6 other people has organic distribution built into the gameplay.

93. FINAL PRODUCT POSITIONING
Do not lead with:
Make customizable bingo cards online.
Lead with:
The game happening all around you.
Pick a place. Invite your friends. Start watching.
The technology should disappear.
The experience should feel like someone says:
"You guys want to play?"
Ten seconds later, everyone is playing.
