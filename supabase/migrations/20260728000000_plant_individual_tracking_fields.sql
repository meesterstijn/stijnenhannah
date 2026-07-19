-- Individual-plant tracking fields (per-plant reality, distinct from the
-- existing botanical advice/recommendation fields).
alter table public.plants
  add column if not exists health_status text,
  add column if not exists last_checked_at date,
  add column if not exists current_height_cm integer,
  add column if not exists pot_size_liters integer,
  add column if not exists pot_material text,
  add column if not exists pot_color text,
  add column if not exists soil_type text,
  add column if not exists soil_mix_notes text,
  add column if not exists last_repotted_at date,
  add column if not exists acquired_at date,
  add column if not exists source text,
  add column if not exists price numeric(10, 2);
