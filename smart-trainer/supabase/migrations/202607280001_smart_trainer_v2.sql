create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ftp integer not null default 200 check (ftp between 50 and 700),
  weight_kg numeric(5,2) not null default 70 check (weight_kg between 25 and 250),
  weekly_goal_minutes integer not null default 90 check (weekly_goal_minutes between 15 and 1200),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_catalog (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null,
  difficulty text not null,
  definition jsonb not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id uuid not null,
  workout_id text,
  started_at timestamptz not null,
  completed_at timestamptz,
  active_duration_seconds integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  adherence jsonb,
  game_result jsonb,
  raw_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, client_session_id)
);

create table if not exists public.ghost_traces (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trace jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  completed_missions integer not null default 0,
  total_stars integer not null default 0,
  weekly jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  unlock_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, unlock_key)
);

create table if not exists public.connections (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.challenge_entries (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  score integer,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.sessions enable row level security;
alter table public.ghost_traces enable row level security;
alter table public.user_progress enable row level security;
alter table public.unlocks enable row level security;
alter table public.connections enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.workout_catalog enable row level security;

create policy "catalog is public" on public.workout_catalog for select using (published);
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profile owned" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "settings owned" on public.user_settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions owned" on public.sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ghosts owned" on public.ghost_traces for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress owned" on public.user_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "unlocks owned" on public.unlocks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "connections visible to participants" on public.connections for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "connections created by requester" on public.connections for insert to authenticated with check (auth.uid() = requester_id);
create policy "connections updated by participants" on public.connections for update to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "challenges readable" on public.challenges for select to authenticated using (visibility = 'public' or auth.uid() = owner_id);
create policy "challenges owned" on public.challenges for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "entries readable by member" on public.challenge_entries for select to authenticated using (auth.uid() = user_id);
create policy "entries owned" on public.challenge_entries for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
