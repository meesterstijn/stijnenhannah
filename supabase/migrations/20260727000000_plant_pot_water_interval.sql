alter table public.plants
  add column if not exists pot_water_interval_days integer;
