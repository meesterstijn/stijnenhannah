alter table public.plants
  add column if not exists toxic_to_humans boolean not null default false,
  add column if not exists toxic_to_cats boolean not null default false;
