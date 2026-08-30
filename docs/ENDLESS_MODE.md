# Endless mode — design proposal

**Status:** proposed, not built. Needs a decision before any code.

The PRD reserves the name `endless` in the schema (§13) and says nothing about
what it does. The database CHECK already allows the value; nothing implements
it. This is the design, written before the migration rather than after it.

---

## The problem with the obvious answer

"Endless means the game never ends" is already built, and has been since
Phase 1. `rooms.continue_after_win` defaults to **true**: someone gets a bingo,
it is announced to everyone, and play carries on. Only when it is false does
the room complete on the first win.

So `endless` cannot just mean "do not stop". That is a checkbox, not a mode. If
it means nothing more than that, **it should not be built** — a mode that
duplicates a setting is worse than an unbuilt one, because now there are two
ways to say the same thing and a player has to guess which they want.

What is genuinely missing is a shape for *long* occasions. The card content now
includes a three-hour flight, a festival, a conference and a graduation. In
every one of those, a single bingo arriving twenty minutes in ends the
interesting part of the game and leaves the rest of the occasion with nothing.

## What endless should mean: rounds

A bingo ends a **round**, not the game.

1. Someone completes a line. It is announced exactly as today.
2. That player's **bingo count** goes up by one.
3. **Every card in the room is reshuffled** and the next round begins.
4. The room does not complete. It keeps going until the host ends it, or it
   expires.
5. When the host ends it, the winner is whoever has the most bingos — ties
   broken by squares marked in the final round.

The leaderboard therefore ranks by **bingos won**, not by squares marked, with
squares as the tiebreak. That is the one real scoring change: in every other
mode a player's score is their marks, and here their marks are only the current
round.

### Why reshuffle everyone, not just the winner

The alternative is to reset only the winner's card and let everyone else keep
their progress. It is less disruptive and it is worse:

- It punishes winning. The person who just won loses all their marks while
  everyone else keeps theirs, so a strong player falls behind by succeeding.
- It has no shared beat. Round-based play gives a table a moment — *"new
  round"* — which is the entire social point of the app. An asynchronous
  version is just several solitaire games in one room.
- It drifts. After an hour, players who never win are sitting on cards that are
  nearly complete, and the next bingo becomes near-certain and meaningless.

Reshuffling everyone keeps every round a fresh race and costs one card
regeneration per player per round — 25 rows each, on an event that happens
every few minutes at most.

### Co-op

There is one shared card, so a round reshuffles that one card. Bingo counts
stay per player, credited to whoever marked the winning square, so "who ended
each round" is still visible while the win itself remains the team's.

---

## What has to change

| Layer | Change |
|---|---|
| Schema | `room_players.bingos integer not null default 0`. `rooms.round integer not null default 1`. |
| `toggle_square` | On bingo in `endless`: increment the marker's `bingos`, increment `rooms.round`, regenerate every card in the room, emit a `round_ended` event. Do **not** set `winner_player_id` and do **not** complete the room. |
| `end_room` | In `endless`, set `winner_player_id` to the top of the leaderboard before completing, so the existing "winner" screens keep working unchanged. |
| `get_room_snapshot` | Expose `round` and each player's `bingos`. |
| UI | Leaderboard shows bingos; header shows the round; the winner overlay says "won round 3" rather than "won". |
| Tests | Round increments, all cards actually change, counts accumulate, host-end picks the leader, ties break on squares, other modes untouched. |

### Deliberately not changing

- **Expiry stays at 12 hours.** "Endless" is the shape of the game, not a
  promise about storage. A flight, a shift or a festival day all fit inside 12
  hours, and unbounded rooms are a retention cost with no owner. The sweeper
  keeps working exactly as it does now.
- **`continue_after_win` is ignored in this mode** rather than removed. It
  still means what it means everywhere else; in `endless` the round structure
  supersedes it, and the create form should hide the checkbox rather than
  present a setting that does nothing.

## Risks

- **A round reshuffle is disruptive if it lands mid-thought.** Somebody one
  square away loses that square. This is inherent to rounds and is why the
  announcement matters: the reshuffle must be obvious and attributed, not a
  silent board change. If it reads as a bug, the mode has failed.
- **Long rooms make the activity feed long.** The feed is already capped for
  display; a multi-hour room should show the current round's events, not the
  whole session.
- **It is unproven.** Nobody has played SPOT for three hours. The case for
  rounds is reasoning about long occasions, not evidence from a real session.
  It would be entirely reasonable to run the phone test first and build this
  only if the answer to "we finished, now what?" turns out to be a real
  frustration rather than an imagined one.
