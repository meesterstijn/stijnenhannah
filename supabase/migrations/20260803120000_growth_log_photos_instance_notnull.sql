-- Fixup: adds NOT NULL constraint to growth_log_photos.plant_instance_id.
-- Only needed if 20260803100000 was already executed with the nullable
-- definition. If you are running migrations for the first time, this is a
-- no-op (the NOT NULL was added in the original migration).
--
-- Safe precondition: the table is new and contains no rows with null
-- plant_instance_id (the app never inserts null; the import skips such rows).
-- If you have null rows from an earlier build, delete them first:
--   DELETE FROM public.growth_log_photos WHERE plant_instance_id IS NULL;

ALTER TABLE public.growth_log_photos
  ALTER COLUMN plant_instance_id SET NOT NULL;
