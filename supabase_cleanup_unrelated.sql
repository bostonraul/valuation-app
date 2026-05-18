-- =============================================================================
-- OPTIONAL: Remove non–valuation-app tables from this Supabase project
--
-- Your project was mixed with a workshop/booking schema. This script drops ONLY
-- those tables. It does NOT touch: valuations, assumptions, projections, comps.
--
-- ⚠️  This permanently deletes booking/workshop data. Back up first if needed.
-- Run once in SQL Editor after reviewing the table list below.
-- =============================================================================

-- Drop in dependency order (children first)
drop table if exists public.booking_participants cascade;
drop table if exists public.bookings cascade;
drop table if exists public.workshops cascade;
drop table if exists public.communities cascade;

-- Verify valuation tables remain (should return 4 rows):
-- select table_name from information_schema.tables
-- where table_schema = 'public'
--   and table_name in ('valuations', 'assumptions', 'projections', 'comps')
-- order by table_name;
