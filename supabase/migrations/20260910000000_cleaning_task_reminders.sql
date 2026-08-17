-- Schoonmaak — meldingen: per taak bijhouden wanneer voor het laatst een
-- pushmelding is gestuurd, zodat de cron-check (elke 10 min) een taak die
-- al te doen is niet elke keer opnieuw meldt. Zelfde patroon als
-- plant_instances.last_water_reminder_sent_at (20260719010000).
alter table public.cleaning_tasks
  add column if not exists last_reminder_sent_at timestamptz;

-- cleaning_tasks heeft via 20260816010000_owner_only_lockdown.sql al een
-- brede owner-only policy voor alle acties/kolommen — geen aparte RLS-
-- wijziging nodig voor deze kolom.
