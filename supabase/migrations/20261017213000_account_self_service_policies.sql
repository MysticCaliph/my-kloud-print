ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can view their own wallet"
ON public.wallets
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view their own print jobs"
ON public.print_jobs
FOR SELECT
USING (user_id = auth.uid());
