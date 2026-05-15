-- Valuation app schema (run in Supabase SQL Editor)

create table if not exists valuations (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists valuations_ticker_created_idx
  on valuations (ticker, created_at desc);

create table if not exists assumptions (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid references valuations(id) on delete cascade,
  scenario text not null check (scenario in ('bear', 'base', 'bull')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists projections (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid references valuations(id) on delete cascade,
  scenario text not null,
  year_label text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists comps (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid references valuations(id) on delete cascade,
  peer_ticker text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table valuations enable row level security;
alter table assumptions enable row level security;
alter table projections enable row level security;
alter table comps enable row level security;

create policy "Allow anon read valuations" on valuations for select using (true);
create policy "Allow anon insert valuations" on valuations for insert with check (true);
create policy "Allow anon read assumptions" on assumptions for select using (true);
create policy "Allow anon insert assumptions" on assumptions for insert with check (true);
create policy "Allow anon read projections" on projections for select using (true);
create policy "Allow anon insert projections" on projections for insert with check (true);
create policy "Allow anon read comps" on comps for select using (true);
create policy "Allow anon insert comps" on comps for insert with check (true);
