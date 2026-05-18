-- =============================================================================
-- Valuation App — Supabase schema (valuation tables only)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Tables: valuations, assumptions, projections, comps
-- Safe to re-run (IF NOT EXISTS + DROP POLICY IF EXISTS).
--
-- Unrelated tables (bookings, workshops, etc.) are NOT part of this app.
-- To remove them from an existing project, run: supabase_cleanup_unrelated.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Core: one row per valuation run (full JSON from Claude)
-- -----------------------------------------------------------------------------
create table if not exists public.valuations (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.valuations is 'Full valuation JSON per ticker run (source of truth for cache)';
comment on column public.valuations.ticker is 'Uppercase symbol, e.g. AAPL';
comment on column public.valuations.payload is 'Complete API response: scenarios, wacc, projections, comps, etc.';

create index if not exists valuations_ticker_created_idx
  on public.valuations (ticker, created_at desc);

-- -----------------------------------------------------------------------------
-- Child: scenario assumptions (bear / base / bull)
-- -----------------------------------------------------------------------------
create table if not exists public.assumptions (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.valuations (id) on delete cascade,
  scenario text not null check (scenario in ('bear', 'base', 'bull')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.assumptions is 'Per-scenario assumption block linked to a valuation';

create index if not exists assumptions_valuation_id_idx
  on public.assumptions (valuation_id);

-- -----------------------------------------------------------------------------
-- Child: projection schedules (e.g. base case years)
-- -----------------------------------------------------------------------------
create table if not exists public.projections (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.valuations (id) on delete cascade,
  scenario text not null,
  year_label text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.projections is 'Projection tables (revenue, EBITDA, FCF) by scenario';

create index if not exists projections_valuation_id_idx
  on public.projections (valuation_id);

-- -----------------------------------------------------------------------------
-- Child: trading comps peers
-- -----------------------------------------------------------------------------
create table if not exists public.comps (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.valuations (id) on delete cascade,
  peer_ticker text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.comps is 'Peer comp metrics linked to a valuation';

create index if not exists comps_valuation_id_idx
  on public.comps (valuation_id);

create index if not exists comps_peer_ticker_idx
  on public.comps (peer_ticker);

-- -----------------------------------------------------------------------------
-- Row Level Security (anon key from FastAPI / optional frontend)
-- -----------------------------------------------------------------------------
alter table public.valuations enable row level security;
alter table public.assumptions enable row level security;
alter table public.projections enable row level security;
alter table public.comps enable row level security;

drop policy if exists "valuation_anon_select" on public.valuations;
drop policy if exists "valuation_anon_insert" on public.valuations;
drop policy if exists "assumptions_anon_select" on public.assumptions;
drop policy if exists "assumptions_anon_insert" on public.assumptions;
drop policy if exists "projections_anon_select" on public.projections;
drop policy if exists "projections_anon_insert" on public.projections;
drop policy if exists "comps_anon_select" on public.comps;
drop policy if exists "comps_anon_insert" on public.comps;

-- Remove legacy policy names from earlier schema versions
drop policy if exists "Allow anon read valuations" on public.valuations;
drop policy if exists "Allow anon insert valuations" on public.valuations;
drop policy if exists "Allow anon read assumptions" on public.assumptions;
drop policy if exists "Allow anon insert assumptions" on public.assumptions;
drop policy if exists "Allow anon read projections" on public.projections;
drop policy if exists "Allow anon insert projections" on public.projections;
drop policy if exists "Allow anon read comps" on public.comps;
drop policy if exists "Allow anon insert comps" on public.comps;

create policy "valuation_anon_select"
  on public.valuations for select to anon using (true);

create policy "valuation_anon_insert"
  on public.valuations for insert to anon with check (true);

create policy "assumptions_anon_select"
  on public.assumptions for select to anon using (true);

create policy "assumptions_anon_insert"
  on public.assumptions for insert to anon with check (true);

create policy "projections_anon_select"
  on public.projections for select to anon using (true);

create policy "projections_anon_insert"
  on public.projections for insert to anon with check (true);

create policy "comps_anon_select"
  on public.comps for select to anon using (true);

create policy "comps_anon_insert"
  on public.comps for insert to anon with check (true);
