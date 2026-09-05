# Paid-entry fundraisers — where this becomes gambling

**Written 2026-08-30. Nothing here is built, and nothing here should be built
until the questions at the bottom have been answered by an actual lawyer.**

> **This is not legal advice.** It is a map of the terrain so the conversation
> with a gaming/charitable-gaming attorney starts from specific questions
> rather than an open one. Every material rule below varies by state, and some
> states differ from the general pattern entirely. Verify before relying on
> any of it.

## The idea being assessed

A host — a school, a booster club, a church, a volunteer fire department — runs
an event. People pay roughly a dollar to enter. Everyone plays SPOT. The
organisation awards prizes or cash, holds its own state charitable-gaming
licence, and SPOT takes a small fee per registration.

The comparison offered was the 50/50 raffle: the same organisations, the same
kind of event, an activity nobody thinks twice about.

## The test

Three elements. All three present, and it is gambling:

| element | in this idea |
|---|---|
| **Consideration** | the dollar to enter |
| **Chance** | the card |
| **Prize** | the cash or goods awarded |

Remove any one and it generally stops being gambling. All three are present
here, so the only paths are a charitable-gaming exemption, or restructuring to
drop an element.

### The skill argument does not save this

It is tempting to argue SPOT is a game of skill — you have to actually notice
things, which is not true of drawn numbers. Do not build on it. **The card is
randomly dealt**: 24 squares drawn from a pool of 40, in random positions. Most
states apply a "dominant factor" test, and a random deal is a large chance
element; some states are stricter still and treat *any* material chance as
enough. A business resting on this argument is resting on a coin flip in every
jurisdiction it enters.

## Charitable gaming exemptions are real, and narrow

This is the regime 50/50 raffles run under, and it does permit paid-entry
prize games. Conditions commonly include:

- the organisation must be a qualifying nonprofit, often with a minimum
  operating history **in that state**
- a licence or per-event permit, obtained in advance
- the game must be **run by the organisation's own members**, frequently
  unpaid volunteers only
- caps on individual and aggregate prize values
- proceeds restricted to the charitable purpose
- record-keeping, reporting, and sometimes a dedicated bank account

An organisation that clears all of that can lawfully run the event. **That
licence covers them. It says nothing about us.**

## The risk that is actually ours

Most states that permit charitable gaming **separately regulate the vendors who
supply it** — variously "suppliers", "distributors", or "manufacturers" — with
their own licensing, bonding and reporting.

And a very common provision in those regimes: **a vendor may not be compensated
as a percentage of the handle, or per player.** Flat fees only. That rule exists
precisely to stop anyone profiting in proportion to the amount wagered.

**"A small fee per registration" is close to the exact structure those rules
target.** This is the single most important sentence in this document. The
model as described puts SPOT in the position the rules were written about,
while the licence everyone is relying on belongs to somebody else.

## Two walls that arrive before a regulator does

**Stripe prohibits gambling** absent prior written approval, and entry fees for
prize games flowing through a Stripe account is the thing that gets frozen —
without warning, with funds held, and potentially with clawbacks. In practice
this is the first constraint hit, not the last. Talk to Stripe before writing
payment code, not after.

**Money flow decides what we look like.** If entry fees and prize money move
through our platform, we resemble an operator. If the organisation collects its
own money under its own licence and we sell software, we resemble a vendor.
Regulators, processors and courts all read the money first.

## "But everyone runs 50/50 raffles"

A meaningful share of those raffles are technically non-compliant. They are
tolerated because one PTA selling tickets in a gym is invisible.

**A platform doing it a thousand times is not invisible.** Scale changes the
risk profile even when the activity is identical: we would be the efficient
enforcement target, the party with money worth pursuing, and the one holding
records of every event in every state. "Other people do it" has never been a
defence, and it is a worse one at scale.

## Three structures

| | what it is | what it needs | risk |
|---|---|---|---|
| **A. Per-player fee** *(as described)* | We take a cut of each entry; money flows through us | Supplier licensing in every state we operate; conflicts with percentage-compensation bans; Stripe gambling approval | **Highest.** Do not build this first |
| **B. Flat software licence** | Org pays a flat fee per event or per season. They collect entry money, hold the licence, award prizes, use their own bank | Supplier-licensing check per state; contract making the division explicit | **Much lower.** We sell a tool. Recommended path if paid-entry is pursued |
| **C. No prize** | Donations plus a game. Nothing is awarded by chance | Nothing beyond ordinary nonprofit fundraising rules | **Lowest.** Buildable today |

Structure **B** keeps most of the upside and removes us from the wager. The
per-player economics are attractive precisely because they scale with the
handle — which is the same reason they are regulated.

## What could be built today, with no exposure

- **No-prize fundraiser mode.** A donation flow plus a game. Removes the prize
  element entirely, so the three-element test is not met.
- **Sponsored squares.** Local businesses pay to appear on the cards. No entry
  fee, no prize, no chance in the transaction.
- **Flat-fee school/club licence.** Sell the software. Stay out of the money.

None of these require a gaming lawyer to ship, and all of them are compatible
with the entitlement seam already built (G-28).

## Tripwires — stop and get advice if any of these appear in a PR

1. Anything that collects an **entry fee** for a game with a prize.
2. Any fee we charge that is **per player, per entry, or a percentage** of
   money staked.
3. Prize money, pot value, or payouts **stored or moved** by our systems.
4. Any feature that lets a host **advertise a cash prize** through us.
5. Copy that describes SPOT as being for "raffles", "wagers", "pots" or "cash
   prizes".
6. Enabling any of the above **before** the answers below exist in writing.

## Questions for the attorney

1. In our launch states, does a software vendor to a licensed charitable-gaming
   organisation require its own supplier/distributor licence?
2. Do those states prohibit vendor compensation tied to the number of players or
   a percentage of proceeds? Is a **flat per-event fee** permitted?
3. Does an online registration and card-dealing service, where play happens in
   person, count as "internet gambling" for UIGEA or state purposes?
4. Does a randomly dealt card make this chance-dominant in these states,
   regardless of the observational element?
5. If the organisation holds the licence and touches all money, what written
   agreement do we need to keep the separation defensible?
6. Which states should be excluded outright at launch? (Utah and Hawaii permit
   essentially no gambling; several others restrict charitable gaming to
   specific organisation types or bar it entirely.)
7. What is our exposure under 18 U.S.C. § 1955 if an organisation turns out to
   be unlicensed or non-compliant — and what diligence would shift it?

## Position

**Do not build structure A.** If paid-entry fundraisers are pursued, start from
**B**, and get questions 1, 2 and 5 answered in writing first. **C** is
available now and needs nobody's permission.

Related: [GAP_LIST.md](GAP_LIST.md) G-22 (monetization), and the entitlement
seam in [ENDLESS_MODE.md](ENDLESS_MODE.md)'s sibling migration 0027 — the tier
plumbing already exists and is agnostic about how anyone pays.

---

## Addendum, 2026-08-30 — room-size pricing

A better model surfaced after this was written: charge the **host** for room
capacity, not the players for entry. See [PRICING.md](PRICING.md).

It removes the hard problem. There is no consideration flowing toward a prize,
so the three-element test is not met at all — this is a software fee, which is
structure **B** above arrived at from a different direction.

One question it adds to the list for the attorney: a fee **banded by headcount**
is close to the "compensation per player" language some state vendor rules use.
For a host running a licensed charitable-gaming event, prefer a **flat
per-event or per-season** price even if ordinary consumer pricing stays banded.
