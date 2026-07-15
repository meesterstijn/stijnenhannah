alter table public.plants
  add column if not exists bloom_months text[] not null default '{}',
  add column if not exists bloom_week text,
  add column if not exists bloom_notes text;
