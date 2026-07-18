alter table public.plants
  add column if not exists growing_method text,
  add column if not exists pot_min_liters integer,
  add column if not exists pot_water_notes text;
