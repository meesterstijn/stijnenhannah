-- Reconciliation: `plants.category` (text, nullable) already exists on the
-- live database but has no corresponding migration in history — it was
-- evidently added out-of-band. This brings migration history in sync with
-- reality without altering the live column (idempotent, no-op if present).
alter table public.plants add column if not exists category text;
