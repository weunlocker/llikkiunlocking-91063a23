SELECT cron.unschedule('binance-poll-deposits');
SELECT cron.schedule(
  'binance-poll-deposits',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jhkumqyugvezfulkoine.supabase.co/functions/v1/binance-poll-deposits',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);