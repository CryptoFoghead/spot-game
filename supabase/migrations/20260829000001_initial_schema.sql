-- SPOT — initial schema (PRD §11–§17)
-- UUID primary keys everywhere except room codes; all timestamps timestamptz.

create extension if not exists pgcrypto;

-- Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (PRD §11)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (PRD §12) — lookup table, seeded; admin-managed
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  icon text,
  sort_order integer,
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- game_templates (PRD §11, §53)
-- ---------------------------------------------------------------------------
create table public.game_templates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 3 and 80),
  slug text unique,
  description text check (description is null or char_length(description) <= 300),
  category text not null references public.categories (slug),
  content_rating text not null default 'family'
    check (content_rating in ('family', 'standard', 'unfiltered')),
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  card_size integer not null default 5 check (card_size between 3 and 7),
  free_center boolean not null default true,
  play_count integer not null default 0,
  -- Remix lineage (PRD §53); populated by Duplicate in later phases.
  source_game_template_id uuid references public.game_templates (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index game_templates_creator_idx on public.game_templates (creator_id);
create index game_templates_discovery_idx
  on public.game_templates (visibility, status, category);

create trigger game_templates_updated_at
  before update on public.game_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- game_squares (PRD §11)
-- ---------------------------------------------------------------------------
create table public.game_squares (
  id uuid primary key default gen_random_uuid(),
  game_template_id uuid not null references public.game_templates (id) on delete cascade,
  text text not null check (char_length(text) between 2 and 180),
  points integer not null default 1,
  difficulty text check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  sort_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_squares_template_idx on public.game_squares (game_template_id);

create trigger game_squares_updated_at
  before update on public.game_squares
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- rooms (PRD §13)
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  game_template_id uuid not null references public.game_templates (id),
  host_user_id uuid references auth.users (id) on delete set null,
  room_code varchar(6) unique not null,
  status text not null default 'lobby'
    check (status in ('lobby', 'active', 'paused', 'completed', 'expired')),
  game_mode text not null default 'classic'
    check (game_mode in ('classic', 'blackout', 'double', 'four_corners', 'timed', 'points', 'endless')),
  continue_after_win boolean not null default true,
  started_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  winner_player_id uuid, -- FK added after room_players exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index rooms_status_expiry_idx on public.rooms (status, expires_at);

create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- room_players (PRD §14)
-- ---------------------------------------------------------------------------
create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  guest_token_hash text,
  nickname text not null check (char_length(nickname) between 1 and 24),
  role text not null default 'player' check (role in ('host', 'player')),
  status text not null default 'active' check (status in ('active', 'removed', 'left')),
  score integer not null default 0,
  marked_count integer not null default 0,
  has_bingo boolean not null default false,
  bingo_at timestamptz,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index room_players_room_idx on public.room_players (room_id);

alter table public.rooms
  add constraint rooms_winner_player_fk
  foreign key (winner_player_id) references public.room_players (id) on delete set null;

-- ---------------------------------------------------------------------------
-- player_cards (PRD §15)
-- ---------------------------------------------------------------------------
create table public.player_cards (
  id uuid primary key default gen_random_uuid(),
  room_player_id uuid not null unique references public.room_players (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- player_card_squares (PRD §16)
-- ---------------------------------------------------------------------------
create table public.player_card_squares (
  id uuid primary key default gen_random_uuid(),
  player_card_id uuid not null references public.player_cards (id) on delete cascade,
  game_square_id uuid references public.game_squares (id) on delete set null,
  position integer not null,
  row_index integer not null,
  column_index integer not null,
  display_text text not null,
  is_free boolean not null default false,
  marked boolean not null default false,
  marked_at timestamptz,
  unique (player_card_id, position)
);

create index player_card_squares_card_idx on public.player_card_squares (player_card_id);

-- ---------------------------------------------------------------------------
-- room_events — audit/event history (PRD §17)
-- ---------------------------------------------------------------------------
create table public.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  room_player_id uuid references public.room_players (id) on delete set null,
  event_type text not null check (event_type in (
    'player_joined', 'player_left', 'player_removed',
    'game_started', 'game_paused', 'game_resumed',
    'square_marked', 'square_unmarked',
    'bingo', 'game_completed'
  )),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index room_events_room_idx on public.room_events (room_id, created_at);
