-- Separates location (kas/buiten) from cultivation method (pot/volle grond).
--
-- Previously "greenhouse" was stored as a cultivation_type value, incorrectly
-- conflating WHERE a plant grows (location) with HOW it grows (method).
-- A valid combination like "kas + pot" was impossible to represent.
--
-- This migration:
--   1. Adds indoor_outdoor ("outdoor" | "indoor" | null) for the location axis.
--   2. Migrates existing cultivation_type = 'greenhouse' rows: the instance
--      was in a greenhouse (location → indoor) but had no method recorded —
--      set indoor_outdoor = 'indoor' and clear cultivation_type to null so the
--      user can choose the method (pot / volle grond) separately.
--   3. Drops the 'greenhouse' value from the soft enum; valid cultivation_type
--      values are now "pot" | "open_ground" | "raised_bed".

ALTER TABLE public.plant_instances
  ADD COLUMN IF NOT EXISTS indoor_outdoor text
    CHECK (indoor_outdoor IN ('outdoor', 'indoor'));

UPDATE public.plant_instances
SET
  indoor_outdoor = 'indoor',
  cultivation_type = NULL
WHERE cultivation_type = 'greenhouse';
