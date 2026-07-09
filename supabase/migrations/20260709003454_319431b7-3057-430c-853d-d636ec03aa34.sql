DO $$ BEGIN PERFORM cron.unschedule('poll-dhru-orders-30s'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('poll-dhru-orders-15s'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'poll-dhru-orders-15s',
  '15 seconds',
  $$
  SELECT net.http_post(
    url := 'https://jhkumqyugvezfulkoine.supabase.co/functions/v1/poll-dhru-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoa3VtcXl1Z3ZlemZ1bGtvaW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTA2MTgsImV4cCI6MjA5Mjc4NjYxOH0.Pq6aFEXaj0M8rNiUvVg26aWV_5Ft8hRtFrop60PaoEg'
    ),
    body := '{}'::jsonb
  );
  $$
);