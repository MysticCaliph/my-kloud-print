ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS original_filename text;

ALTER TABLE public.print_jobs
DROP CONSTRAINT IF EXISTS print_jobs_paper_size_check;

ALTER TABLE public.print_jobs
ADD CONSTRAINT print_jobs_paper_size_check
CHECK (paper_size IN ('A4', 'Legal', 'LEGAL'));
