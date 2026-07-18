alter table public.plants
  add column if not exists feeding_reminders_enabled boolean not null default true;
