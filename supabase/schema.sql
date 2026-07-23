-- ===========================================================================
-- Hiking Team Challenge Poonagala 2026 — Supabase schema
-- Paste this into Supabase → SQL Editor and run it once.
-- Implements the data model in spec §13, plus RLS (public read, admin write).
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---- tables ---------------------------------------------------------------
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  entry_no    text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  name        text not null,
  is_leader   boolean not null default false,
  order_index int not null default 0
);

create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  scoring_method text not null check (scoring_method in ('TEAM','INDIVIDUAL')),
  event_total    numeric,
  scale_to       numeric,
  status         text not null default 'draft' check (status in ('draft','final')),
  order_index    int not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists criteria (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('number','time','penalty')),
  max_marks   numeric,
  order_index int not null default 0
);

create table if not exists scores (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  criterion_id uuid not null references criteria(id) on delete cascade,
  team_id      uuid not null references teams(id) on delete cascade,
  player_id    uuid references players(id) on delete cascade,
  value        numeric,
  time_start   text,
  time_end     text,
  updated_by   text,
  updated_at   timestamptz not null default now()
);
create index if not exists scores_lookup on scores (event_id, criterion_id, team_id, player_id);

create table if not exists adjustments (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  delta       numeric not null,
  reason      text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       text,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  reason      text,
  team_id     uuid,
  event_id    uuid,
  created_at  timestamptz not null default now()
);

create table if not exists settings (
  id             text primary key default 'settings',
  tie_break_text text not null,
  rounding_dp    int not null default 1
);

-- ---- realtime -------------------------------------------------------------
alter publication supabase_realtime add table teams, players, events, criteria, scores, adjustments, settings;

-- ---- row level security ---------------------------------------------------
-- Public (anon) may READ everything except the audit log.
-- Only authenticated admins may WRITE, and may read the audit log.
alter table teams        enable row level security;
alter table players      enable row level security;
alter table events       enable row level security;
alter table criteria     enable row level security;
alter table scores       enable row level security;
alter table adjustments  enable row level security;
alter table settings     enable row level security;
alter table audit_log    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['teams','players','events','criteria','scores','adjustments','settings']
  loop
    execute format('drop policy if exists public_read on %I;', t);
    execute format('create policy public_read on %I for select using (true);', t);
    execute format('drop policy if exists admin_write on %I;', t);
    execute format('create policy admin_write on %I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- audit log: only authenticated admins can read or append; never update/delete.
drop policy if exists audit_read  on audit_log;
create policy audit_read  on audit_log for select to authenticated using (true);
drop policy if exists audit_write on audit_log;
create policy audit_write on audit_log for insert to authenticated with check (true);

-- ---- default settings row -------------------------------------------------
insert into settings (id, tie_break_text, rounding_dp)
values ('settings',
  'Ties are broken by (1) higher total across rubric events, then (2) fewer total penalties, then (3) lower entry number.',
  1)
on conflict (id) do nothing;

-- After running this, seed the 19 events from the app: log in as admin and use
-- "Reset competition" (or add events manually). Create admin users under
-- Supabase → Authentication → Users (email + password).
