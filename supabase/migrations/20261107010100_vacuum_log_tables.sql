-- Wekelijks de logtabellen vacuümen (7 nov 2026).
--
-- net._http_response was 82 MB met maar ~180 echte regels: pg_net wist oude
-- antwoorden na 6 uur, maar de vrijgekomen ruimte werd niet hergebruikt
-- (autovacuum had er sinds augustus niet meer gedraaid). Een gewone VACUUM
-- maakt die ruimte weer bruikbaar, zodat de tabel niet blijft groeien.
-- Geen VACUUM FULL: die vergrendelt de tabel en is hier niet nodig.

select cron.schedule(
  'vacuum-log-tables',
  '47 3 * * 0',
  $$vacuum (analyze) cron.job_run_details, net._http_response$$
);
