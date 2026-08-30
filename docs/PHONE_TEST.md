# Phone-to-phone test (PRD §74) — G-01

The last MVP acceptance step. Everything else is verified by automation; this
one needs two real people on two real devices, because it answers a question
automation can't: **is it actually fun?**

**Site:** https://spot-game-green.vercel.app

## Setup

- You + one other person, each with a phone
- Ideally **different networks** (one on wifi, one on cellular) — that's what
  exercises reconnect behaviour
- Somewhere with things to look at, if you want the real experience. A coffee
  shop or an airport beats a kitchen table.

Nobody needs an account. Nobody needs to install anything.

## The run

| # | Step | What should happen |
|---|---|---|
| 1 | You: open the site, tap **Explore**, pick a game | Games load |
| 2 | You: **Start Game**, enter a nickname, pick a mode | Lands on the host screen with a QR code and a 4-digit code |
| 3 | Them: scan the QR with their camera | Opens the join screen showing the game title and rating |
| 4 | Them: enter a nickname, **Join Game** | They get a 5×5 card with a FREE centre |
| 5 | You: check your player list | Their name appears **without you refreshing** |
| 6 | You: **Start Game** | Both boards go LIVE, no refresh |
| 7 | Both: tap squares as you spot things | Tile fills immediately |
| 8 | Watch each other's scores | The other person's score moves **on its own** |
| 9 | One of you completes a line | 🎉 overlay on **both** phones, 🏆 in the leaderboard |
| 10 | You: **End Game** | Both see the game has ended |

**If step 5, 8, or 9 needs a manual refresh, that's a bug — write it down.**

## Then try to break it

These are the conditions the PRD calls out, and the ones real players hit:

- [ ] **Lock the screen** for a minute, unlock — does the board still work?
- [ ] **Switch apps** and come back
- [ ] **Turn wifi off** mid-game (fall to cellular) — does it recover?
- [ ] **Walk into a dead zone** and back
- [ ] **Refresh** the page mid-game — are your marks still there?
- [ ] **Tap the same square fast, repeatedly** — does the count stay right?
- [ ] **Tap two squares at once** with two thumbs
- [ ] Host: **Pause**, have them try to mark → should be refused politely
- [ ] Host: **Remove** the other player → they should be told, not just broken
- [ ] Them: try to **rejoin after being removed** → should be refused

## Worth noticing (not bugs, but the real questions)

- Is the text on the tiles **readable at arm's length**?
- Are the squares **easy to tap** without hitting the wrong one?
- Did you actually **look around the room**, or just stare at the phone?
- Was it obvious what to do **without anyone explaining**?
- Would you play a second round?

That last one is the actual test.

## Recording what you find

- Bugs → add a row to [BUG_LIST.md](BUG_LIST.md) with what you did and what
  happened
- Missing things → add to [GAP_LIST.md](GAP_LIST.md)
- Errors should now also appear in Sentry (`spot-game` project) with email
  alerts, so check there afterwards for anything you didn't notice

## If something looks broken before you start

Check https://spot-game-green.vercel.app/api/health — it returns the deployed
commit. If the site seems dead entirely, the free-tier Supabase project may have
paused after a week of inactivity; restore it from the Supabase dashboard.
