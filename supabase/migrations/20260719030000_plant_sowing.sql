alter table public.plants
  add column if not exists sow_months text[] not null default '{}',
  add column if not exists sow_week text,
  add column if not exists sow_notes text;
