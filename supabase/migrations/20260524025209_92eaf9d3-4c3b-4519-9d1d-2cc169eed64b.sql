
-- 1) Remove broad authenticated SELECT on services base table.
-- Non-admin reads must go through public.services_public view (which excludes
-- supplier API URLs, headers, request templates, and success rules).
DROP POLICY IF EXISTS "Authenticated view active services" ON public.services;

-- 2) Lock down Supabase Realtime channel subscriptions for support tickets.
-- Without RLS on realtime.messages, any authenticated user can subscribe to
-- another user's ticket topic. Restrict subscriptions by topic.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can read own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Admins can subscribe to anything
  public.has_role(auth.uid(), 'admin')
  -- The admin-only channel
  OR (realtime.topic() = 'admin-tickets' AND public.has_role(auth.uid(), 'admin'))
  -- The generic user channel: postgres_changes payloads are still RLS-filtered
  OR realtime.topic() = 'user-tickets'
  -- Per-ticket channel: only the ticket owner (or admin via above) may subscribe
  OR (
    realtime.topic() LIKE 'ticket-%'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = substring(realtime.topic() from 8)
        AND t.user_id = auth.uid()
    )
  )
);
