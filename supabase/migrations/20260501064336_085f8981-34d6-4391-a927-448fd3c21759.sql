ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS pdf_filename text,
  ADD COLUMN IF NOT EXISTS pdf_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_size_bytes integer,
  ADD COLUMN IF NOT EXISTS pdf_mime_type text DEFAULT 'application/pdf';

CREATE INDEX IF NOT EXISTS quotes_pdf_storage_path_idx
  ON public.quotes(pdf_storage_path)
  WHERE pdf_storage_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quote-pdfs', 'quote-pdfs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "quote pdfs owner select" ON storage.objects;
DROP POLICY IF EXISTS "quote pdfs owner insert" ON storage.objects;
DROP POLICY IF EXISTS "quote pdfs owner update" ON storage.objects;
DROP POLICY IF EXISTS "quote pdfs owner delete" ON storage.objects;

CREATE POLICY "quote pdfs owner select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'quote-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "quote pdfs owner insert"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'quote-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "quote pdfs owner update"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'quote-pdfs' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'quote-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "quote pdfs owner delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'quote-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);