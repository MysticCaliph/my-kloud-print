ALTER TABLE public.print_jobs
ADD COLUMN paper_size text NOT NULL DEFAULT 'A4'
CHECK (paper_size IN ('A4', 'Legal'));
