-- Database niet laten vollopen met logboeken (7 nov 2026).
--
-- 1. De taak 'send-cleaning-reminder' (20260910010000) riep elke 10 minuten
--    een edge function aan die nooit is gedeployed: elke keer een 404.
--    Wordt niet gebruikt, dus weg. De kolom cleaning_tasks.last_reminder_sent_at
--    blijft staan (onschadelijk, geen data).
-- 2. pg_cron bewaart van elke run een regel in cron.job_run_details en ruimt
--    die zelf nooit op: sinds juli 2026 ~78.000 regels / 57 MB, en ~720 per dag
--    erbij. Voortaan elke nacht alles ouder dan 7 dagen weg.
--    (net._http_response ruimt pg_net zelf op na 6 uur, zie pg_net.ttl.)

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'send-cleaning-reminder';

-- Zelfde naam opnieuw plannen werkt de bestaande taak bij (idempotent).
select cron.schedule(
  'cleanup-cron-history',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);

delete from cron.job_run_details where end_time < now() - interval '7 days';
