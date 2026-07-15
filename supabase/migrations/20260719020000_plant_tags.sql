alter table public.plants
  add column if not exists water_tags text[] not null default '{}',
  add column if not exists harvest_months text[] not null default '{}',
  add column if not exists harvest_week text;
