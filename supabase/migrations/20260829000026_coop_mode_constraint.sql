-- The rooms.game_mode CHECK was written from the PRD's original list, which
-- has no 'coop' — that mode came out of the two-people-at-a-table case, after
-- the schema was set. create_room accepted it and the insert then failed the
-- constraint, so every co-op room errored.
--
-- Caught by the co-op tests on their first run. Worth noting that validating in
-- the function is not enough on its own: the table has the final say.

alter table public.rooms drop constraint if exists rooms_game_mode_check;

alter table public.rooms
  add constraint rooms_game_mode_check
  check (game_mode in (
    'classic',      -- any line
    'blackout',     -- every square
    'double',       -- two lines
    'four_corners', -- the corners
    'points',       -- any line, ranked by square value
    'timed',        -- beat the clock, highest score wins
    'coop',         -- one shared card, played together
    'endless'       -- reserved; not implemented
  ));
