-- 1. Upgrade public.print_jobs with print_side, upload_method, and enforce 'bw' color_mode default
ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS print_side text NOT NULL DEFAULT 'SINGLE';

ALTER TABLE public.print_jobs
  DROP CONSTRAINT IF EXISTS print_jobs_print_side_check;

ALTER TABLE public.print_jobs
  ADD CONSTRAINT print_jobs_print_side_check
  CHECK (print_side IN ('SINGLE', 'DUPLEX'));

ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS upload_method text NOT NULL DEFAULT 'DIRECT';

ALTER TABLE public.print_jobs
  DROP CONSTRAINT IF EXISTS print_jobs_upload_method_check;

ALTER TABLE public.print_jobs
  ADD CONSTRAINT print_jobs_upload_method_check
  CHECK (upload_method IN ('DIRECT', 'WHATSAPP', 'TELEGRAM'));

-- Set color_mode default to 'bw' and normalize existing rows
ALTER TABLE public.print_jobs
  ALTER COLUMN color_mode SET DEFAULT 'bw';

UPDATE public.print_jobs
  SET color_mode = 'bw'
  WHERE color_mode IS NULL OR color_mode != 'bw';

-- 2. Upgrade public.profiles with avatar_type
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_type text NOT NULL DEFAULT 'male';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_avatar_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_type_check
  CHECK (avatar_type IN ('male', 'female'));

