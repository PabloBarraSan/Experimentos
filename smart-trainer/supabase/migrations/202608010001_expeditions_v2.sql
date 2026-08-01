alter table public.ghost_traces
  add column if not exists mission_id text,
  add column if not exists mission_version integer not null default 1,
  add column if not exists score integer not null default 0,
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.challenges
  add column if not exists mission_version integer not null default 1,
  add column if not exists invite_code text unique default substr(md5(random()::text || clock_timestamp()::text), 1, 16);

alter table public.challenge_entries
  add column if not exists max_combo integer not null default 0,
  add column if not exists completed_at timestamptz;

alter table public.user_progress
  add column if not exists progress_version integer not null default 2,
  add column if not exists best_results jsonb not null default '{}'::jsonb,
  add column if not exists cosmetics jsonb not null default '{}'::jsonb,
  add column if not exists streak jsonb not null default '{}'::jsonb;

create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;

drop policy if exists "ghosts owned" on public.ghost_traces;
create policy "ghosts writable by owner" on public.ghost_traces
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ghosts readable when shared" on public.ghost_traces
  for select to authenticated
  using (
    visibility = 'public'
    or auth.uid() = user_id
    or (
      visibility = 'friends'
      and exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and ((c.requester_id = auth.uid() and c.addressee_id = ghost_traces.user_id)
            or (c.addressee_id = auth.uid() and c.requester_id = ghost_traces.user_id))
      )
    )
  );

drop policy if exists "challenges readable" on public.challenges;
create policy "challenges readable" on public.challenges
  for select to authenticated
  using (
    visibility = 'public'
    or auth.uid() = owner_id
    or exists (
      select 1 from public.connections c
      where visibility = 'friends' and c.status = 'accepted'
        and ((c.requester_id = auth.uid() and c.addressee_id = challenges.owner_id)
          or (c.addressee_id = auth.uid() and c.requester_id = challenges.owner_id))
    )
  );

drop policy if exists "entries readable by member" on public.challenge_entries;
create or replace function public.is_challenge_member(target_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_entries
    where challenge_id = target_challenge and user_id = auth.uid()
  );
$$;

create policy "entries readable by challenge members" on public.challenge_entries
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.is_challenge_member(challenge_id)
  );

create or replace function public.join_challenge_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id from public.challenges
  where invite_code = code and ends_at >= now();
  if target_id is null then raise exception 'Código de reto no válido'; end if;
  insert into public.challenge_entries (challenge_id, user_id)
  values (target_id, auth.uid())
  on conflict (challenge_id, user_id) do nothing;
  return target_id;
end;
$$;
grant execute on function public.join_challenge_by_code(text) to authenticated;

create policy "events insert own" on public.product_events
  for insert to authenticated with check (auth.uid() = user_id);
create policy "events select own" on public.product_events
  for select to authenticated using (auth.uid() = user_id);

create index if not exists ghost_traces_mission_score_idx
  on public.ghost_traces (mission_id, mission_version, score desc);
create index if not exists product_events_user_created_idx
  on public.product_events (user_id, created_at desc);
