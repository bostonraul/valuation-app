create table if not exists industry_profiles (
  id           uuid default gen_random_uuid() primary key,
  slug         text not null unique,
  profile_data jsonb,
  fetched_at   timestamp with time zone default now()
);

create table if not exists industry_news (
  id              uuid default gen_random_uuid() primary key,
  slug            text not null,
  headline        text,
  category        text,
  enriched_data   jsonb,
  published_at    timestamp with time zone,
  fetched_at      timestamp with time zone default now()
);

create index if not exists industry_news_slug_idx on industry_news(slug);
create index if not exists industry_news_cat_idx  on industry_news(category);

-- RLS: allow server (anon or service role) to read/write cache rows
alter table public.industry_profiles enable row level security;
alter table public.industry_news enable row level security;

drop policy if exists "industry_profiles_anon_all" on public.industry_profiles;
drop policy if exists "industry_news_anon_all" on public.industry_news;

create policy "industry_profiles_anon_all"
  on public.industry_profiles for all to anon using (true) with check (true);

create policy "industry_news_anon_all"
  on public.industry_news for all to anon using (true) with check (true);

-- service_role bypasses RLS by default; policies above cover legacy anon JWT
