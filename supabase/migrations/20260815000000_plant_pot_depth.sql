-- Tuingids — minimale en aanbevolen potdiepte (cm) naast de al bestaande
-- pot_min_liters/pot_recommended_liters advieswaarden op public.plants.
-- Zelfde eenheid-suffix-conventie als size_cm/spacing_cm.
alter table public.plants
  add column if not exists pot_min_depth_cm integer,
  add column if not exists pot_recommended_depth_cm integer;
