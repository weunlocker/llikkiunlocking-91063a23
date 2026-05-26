UPDATE storage.buckets SET public = false WHERE id = 'support-attachments';

DROP POLICY IF EXISTS "Support attachments public read" ON storage.objects;

CREATE POLICY "Owners read own support attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);