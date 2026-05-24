
INSERT INTO storage.buckets (id, name, public) VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Support attachments public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-attachments');

CREATE POLICY "Authenticated users upload own support attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can manage support attachments"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'));
