alter table public.plants
  drop column if exists feeding_frequency,
  add column if not exists feeding_interval_days integer,
  add column if not exists last_fed_at timestamptz,
  add column if not exists last_feeding_reminder_sent_at timestamptz;
