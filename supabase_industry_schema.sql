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
