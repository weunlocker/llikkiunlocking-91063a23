ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS supplier_reference TEXT,
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS poll_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_pending_poll ON public.orders(status, last_polled_at) WHERE status = 'pending' AND supplier_reference IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old schedule if re-running
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'poll-dhru-orders';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'poll-dhru-orders',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := 'https://jhkumqyugvezfulkoine.supabase.co/functions/v1/poll-dhru-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impoa3VtcXl1Z3ZlemZ1bGtvaW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTA2MTgsImV4cCI6MjA5Mjc4NjYxOH0.Pq6aFEXaj0M8rNiUvVg26aWV_5Ft8hRtFrop60PaoEg'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);