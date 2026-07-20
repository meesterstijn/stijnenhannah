-- Dedicated "skip today" state for the watering reminder, separate from
-- last_watered_at. Fixes a bug where skipping today's reminder was
-- implemented by shifting last_watered_at forward, which silently
-- corrupted the true watering baseline (and compounded on repeat clicks).
alter table public.plants
  add column if not exists water_skip_until date;
