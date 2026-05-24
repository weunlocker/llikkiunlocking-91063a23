
-- 1. Atomic balance credit RPC
CREATE OR REPLACE FUNCTION public.credit_balance(p_user_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_bal numeric;
BEGIN
  UPDATE public.profiles
     SET balance = balance + p_amount
   WHERE id = p_user_id
  RETURNING balance INTO new_bal;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  RETURN new_bal;
END;
$$;

-- 2. Scope realtime user-tickets topic to the owning user (topic must include user id)
DROP POLICY IF EXISTS "Authenticated can read own realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can read own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (realtime.topic() = 'admin-tickets' AND public.has_role(auth.uid(), 'admin'))
  OR realtime.topic() = ('user-tickets-' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'ticket-%'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = substring(realtime.topic() FROM 8)
        AND t.user_id = auth.uid()
    )
  )
);

-- 3. Explicit admin-only write policies for email-assets storage bucket
DROP POLICY IF EXISTS "Admins upload email-assets" ON storage.objects;
CREATE POLICY "Admins upload email-assets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update email-assets" ON storage.objects;
CREATE POLICY "Admins update email-assets" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete email-assets" ON storage.objects;
CREATE POLICY "Admins delete email-assets" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));
