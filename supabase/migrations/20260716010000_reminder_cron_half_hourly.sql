-- Reduce reminder-check frequency from every minute to every 30 minutes.
-- cron.schedule() updates the existing job in place when the job_name matches.

select
  cron.schedule(
    'send-note-reminders',
    '*/30 * * * *',
    $$
    select net.http_post(
      url := 'https://lrqivcfuiuskqkpmyxfo.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
    $$
  );
