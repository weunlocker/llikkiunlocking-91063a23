
DROP POLICY IF EXISTS "Authenticated can read own realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can read own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (realtime.topic() = 'admin-tickets' AND public.has_role(auth.uid(), 'admin'))
  OR (realtime.topic() = 'notify-admin' AND public.has_role(auth.uid(), 'admin'))
  OR realtime.topic() = ('user-tickets-' || auth.uid()::text)
  OR realtime.topic() = ('notify-user-' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'ticket-%'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = substring(realtime.topic() FROM 8)
        AND t.user_id = auth.uid()
    )
  )
);
