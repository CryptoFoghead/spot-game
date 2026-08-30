-- Adding `p_duration_seconds` with a default did not replace create_room — in
-- Postgres a different argument list is a different function, so the database
-- ended up holding both the five- and six-argument versions.
--
-- Every existing caller passes five named arguments, which then matches both
-- and fails with "Could not choose the best candidate function". Every call in
-- the app broke at once, caught by the mode tests.
--
-- Drop the superseded signature so exactly one create_room exists.

drop function if exists public.create_room(uuid, text, text, text, boolean);
