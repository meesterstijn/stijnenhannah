alter table public.plants
  add column if not exists pot_recommended_liters integer,
  add column if not exists spacing_cm integer,
  add column if not exists growth_habit text[] not null default '{}',
  add column if not exists watering_method text[] not null default '{}',
  add column if not exists watering_soak_minutes integer,
  add column if not exists soil_ph_min numeric,
  add column if not exists soil_ph_max numeric;
