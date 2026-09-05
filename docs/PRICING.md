# Pricing — free for a table, paid for an event

**Written 2026-08-30. Proposed, not built.** No code, no Stripe account, no
prices committed. This is the shape and the reasoning, so the numbers can move
later without the model being rethought from scratch.

## The idea

Room size decides the price. Small groups play free forever; an organised event
costs money, paid by the **host**, never by the players.

The original sketch was: 0–4 free, 5–20 at $2 a game, increasing from there.
The shape is right. Three of the specifics should change, for reasons below.

## Why this is the right shape

- **The free case stays genuinely free.** Two people at dinner, a family in a
  car. That is the top of the funnel and the thing people tell friends about.
  Nothing about it should ever ask for a card.
- **Cost follows value.** A booster club running an event for sixty people has
  a budget and a reason. A couple does not.
- **It follows our own costs.** More players means more realtime traffic, more
  rows and more card generation.
- **Players still never pay and never sign in.** Anonymous join is the best
  thing about the product and this does not touch it.
- **It sidesteps the gambling problem.** A fee for software capacity has no
  link between what a player stakes and what a player might win, so the
  three-element test in [FUNDRAISER_LEGAL.md](FUNDRAISER_LEGAL.md) is not met.
  This is essentially structure B from that document.

## What should change from the sketch

### 1. Free should be 8, not 4

We now ship Tailgate, Family Reunion, Concert, Graduation and football at three
levels. Every one of those is a group game. A free tier of 4 puts most of the
library behind the wall and leaves the free tier serving only the two-person
games. Eight covers a dinner party, a family and a small crew — and any real
*event* still pays.

### 2. $2 does not survive card fees

Stripe takes roughly 2.9% + 30c:

| price | fee | net | lost |
|---|---|---|---|
| $2 | $0.36 | $1.64 | **18%** |
| $5 | $0.45 | $4.55 | 9% |
| $15 | $0.73 | $14.27 | 5% |
| $49 | $1.72 | $47.28 | 4% |

A stream of $2 charges is also a fraud-review and chargeback nuisance out of
all proportion to the money. At 200 paid games a month, $2 nets about **$328**.
A **$49/year club licence** across 50 organisations nets about the same on a
fiftieth of the transactions — and it is far easier for a school to buy. A
teacher will not repeatedly expense $2; a booster club will approve one annual
line item without blinking.

**So: keep a per-event price for one-off hosts, and sell a season pass to
anyone who runs events regularly.** The pass is the real product for the
organisation buyer.

### 3. The unit is the room, not the round

A host running an evening should not be charged six times for starting six
games. One room, up to its existing 12-hour expiry, is one purchase.

## A concrete ladder to argue with

| tier | players | price | who |
|---|---|---|---|
| Free | up to 8 | $0 | a table, a family, a car |
| Event | up to 30 | $5 per room | a class, a team, a party |
| Large event | up to 100 | $15 per room | a school night, a fundraiser |
| Club licence | up to 100 | $49/year, unlimited rooms | anyone doing this more than three times a year |

The ladder is the durable part. **Every number in it is a guess** — nobody has
played SPOT at an event yet, so there is no evidence behind these figures and
they should move the moment there is.

## Where the paywall is allowed to appear

This is the part that matters most, and it is a product rule rather than a
pricing one.

**At room creation. Never at join.**

If the check fires when the fifth player taps Join, there are thirty people in
a gym watching the host try to pay on their phone. That is the worst moment in
the entire product to show a card form. The host picks an expected size when
they start the room, while nobody is waiting.

Corollaries, all non-negotiable:

- **Nobody already in a room is ever evicted or blocked.** If a free room
  reaches the cap, the host is prompted to upgrade and play continues
  uninterrupted for everyone present.
- **A payment failure never interrupts a running game.** Degrade to "you are
  over the free limit, upgrade when you can", not to a stopped game.
- **The cap is a soft ceiling on joins, not a hard stop on play.**

## Implementation notes for whoever builds it

- **Enforce in the database.** The check belongs in `join_room`; there is no
  player cap anywhere today. A client-side check is decorative — see the
  standing rule about the database being authoritative.
- **The entitlement seam already fits.** Migration 0027 gives per-account tiers
  with limits derived in SQL. Room capacity is a new entitlement dimension
  alongside `aiGenerationsPerHour`, not a new mechanism. A per-room purchase
  needs its own record, since it attaches to a room rather than an account.
- **Paid rooms need a host account.** Payment requires identity. Free rooms
  must stay anonymous exactly as they are now — that is the single best thing
  about the join flow and it should never require a sign-in.
- **Talk to Stripe before writing payment code.** Their gambling restriction is
  a real risk if the surrounding product ever mentions prizes, and their
  answer changes what can be built.

## Open questions

1. Does a *headcount-banded* fee count as "per player" compensation under
   state charitable-gaming vendor rules? For hosts running licensed gaming
   events, prefer a flat per-event or per-season price even if consumer pricing
   stays banded. Add this to the list in
   [FUNDRAISER_LEGAL.md](FUNDRAISER_LEGAL.md).
2. What stops a group of twelve running two free rooms of six? Nothing — but
   they lose one shared leaderboard, which may be friction enough. Worth
   watching rather than engineering against on day one.
3. Should an unpaid room over the cap keep working to the end of the event and
   bill afterwards? Kinder, and probably better for a first real customer, but
   it needs a payment relationship that does not exist yet.
4. Do schools want invoices rather than cards? Very likely. That is a season
   pass with an invoice, not a checkout.

## Position

The shape is right and it is worth building **after** the phone test, not
before. Free up to 8, a per-room price for one-off events, and a season pass
that is the real product for organisations. Charge at room creation, never at
join, and never interrupt a game that is already running.
