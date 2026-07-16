alter table public.plants
  add column if not exists planted boolean not null default false;
