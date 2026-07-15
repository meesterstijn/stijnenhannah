-- Check every 10 minutes whether today's daily prompt is due; the function
-- itself guards against sending twice in one day (daily_prompt_runs.run_date
-- is unique) and against firing before the configured time.

select
  cron.schedule(
    'send-daily-prompt',
    '*/10 * * * *',
    $$
    select net.http_post(
      url := 'https://lrqivcfuiuskqkpmyxfo.supabase.co/functions/v1/send-daily-prompt',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
    $$
  );
