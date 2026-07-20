-- Adds optional fruit/vegetable size measurements alongside the existing
-- plant-height field on a growth log entry. Nullable, additive only —
-- existing rows and the height-based growth calculations are unaffected.
alter table public.growth_log_entries add column if not exists fruit_length_cm numeric;
alter table public.growth_log_entries add column if not exists fruit_width_cm numeric;
