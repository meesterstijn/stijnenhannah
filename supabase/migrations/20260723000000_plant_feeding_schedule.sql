alter table public.plants
  add column if not exists feeding_frequency text,
  add column if not exists feeding_months text[] not null default '{}';
