-- 1. Prevent privilege escalation on public.profiles.role from browser/authenticated sessions
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
    ''
  );
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF jwt_role <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
      RAISE EXCEPTION 'Unauthorized: Changing profile role is not permitted.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 2. Lock down wallet RPCs so only service_role (backend API routes) can execute them
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('atomic_wallet_topup', 'atomic_deduct_print_cost')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.func_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role, postgres', r.func_sig);
  END LOOP;
END $$;

-- 3. Automatic customer notification when print_jobs.status changes
CREATE OR REPLACE FUNCTION public.notify_customer_on_print_job_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := upper(coalesce(NEW.status, ''));
  v_old_status text := upper(coalesce(OLD.status, ''));
  v_title text;
  v_message text;
BEGIN
  IF NEW.user_id IS NULL OR v_status = v_old_status THEN
    RETURN NEW;
  END IF;

  IF v_status = 'PRINTED' THEN
    v_title := 'Order Printed (' || coalesce(NEW.token, '') || ')';
    v_message := 'Your print job ' || coalesce(NEW.token, '') || ' has been printed and is ready for handoff/delivery.';
  ELSIF v_status = 'DISPATCHED' THEN
    v_title := 'Order Out for Delivery (' || coalesce(NEW.token, '') || ')';
    v_message := 'Your print job ' || coalesce(NEW.token, '') || ' is out for delivery.';
  ELSIF v_status = 'DELIVERED' THEN
    v_title := 'Order Delivered (' || coalesce(NEW.token, '') || ')';
    v_message := 'Your print job ' || coalesce(NEW.token, '') || ' has been marked as delivered. Thank you for using PrintKloud!';
  ELSIF v_status = 'CANCELLED' THEN
    v_title := 'Order Cancelled & Refunded (' || coalesce(NEW.token, '') || ')';
    v_message := 'Your print job ' || coalesce(NEW.token, '') || ' was cancelled and ৳' || to_char(coalesce(NEW.total_cost_poisha, 0)::numeric / 100.0, 'FM999999990.00') || ' has been refunded to your wallet.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, is_read)
  VALUES (NEW.user_id, v_title, v_message, false);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block status updates if notification insert fails
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_customer_on_print_job_status_change ON public.print_jobs;
CREATE TRIGGER trg_notify_customer_on_print_job_status_change
  AFTER UPDATE OF status ON public.print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_on_print_job_status_change();

