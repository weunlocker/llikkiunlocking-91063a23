
-- 1) Fix mutable search_path on pgmq helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2) Tighten support-attachments SELECT policy: require uploader ownership (or admin),
-- not just a guessable folder-prefix match.
DROP POLICY IF EXISTS "Owners read own support attachments" ON storage.objects;
CREATE POLICY "Owners read own support attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
