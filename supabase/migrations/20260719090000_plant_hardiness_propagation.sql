alter table public.plants
  add column if not exists winter_hardiness text,
  add column if not exists winter_notes text,
  add column if not exists propagation_methods text[] not null default '{}',
  add column if not exists propagation_notes text;
