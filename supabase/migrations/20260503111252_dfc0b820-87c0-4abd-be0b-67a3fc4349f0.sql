
-- 1) Lock down sensitive columns on `services` from anon
REVOKE SELECT (api_url, api_headers, api_request_body, success_rules, supplier_id, supplier_action, api_method)
  ON public.services FROM anon;

-- Authenticated regular users also shouldn't see supplier credentials
REVOKE SELECT (api_url, api_headers, api_request_body, success_rules, supplier_id, supplier_action, api_method)
  ON public.services FROM authenticated;

-- 2) Prevent privilege escalation on profiles via a BEFORE UPDATE trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypasses
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Admins may change anything
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Block changes to protected columns for everyone else
  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.banned IS DISTINCT FROM OLD.banned
     OR NEW.user_group IS DISTINCT FROM OLD.user_group
     OR NEW.api_enabled IS DISTINCT FROM OLD.api_enabled THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
