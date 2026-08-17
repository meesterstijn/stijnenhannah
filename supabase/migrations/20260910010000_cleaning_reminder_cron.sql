select
  cron.schedule(
    'send-cleaning-reminder',
    '*/10 * * * *',
    $$
    select net.http_post(
      url := 'https://lrqivcfuiuskqkpmyxfo.supabase.co/functions/v1/send-cleaning-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
    $$
  );
