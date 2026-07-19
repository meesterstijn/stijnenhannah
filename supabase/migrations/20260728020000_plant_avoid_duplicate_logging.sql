-- Avoid duplicating functionality that already exists in the app:
-- - Dated plant notes already exist via the "Groeilogboek" (PlantLogboek /
--   useGrowthLog), so a separate plant_notes table would be a second,
--   competing system for the same purpose. Table was just created empty
--   in 20260728010000 and never used by any code — safe to drop.
-- - Current height is already tracked as historical entries in that same
--   growth log (height_cm per dated entry), so a single current_height_cm
--   column would create a second, possibly-inconsistent "current height".
--   The most recent logged height_cm is used instead.
drop table if exists public.plant_notes;

alter table public.plants
  drop column if exists current_height_cm;
