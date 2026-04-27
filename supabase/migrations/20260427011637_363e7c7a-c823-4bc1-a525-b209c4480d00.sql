-- Service: success rules + request body
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS success_rules jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS api_request_body text;

COMMENT ON COLUMN public.services.success_rules IS
'Array of rules: [{"path":"success","op":"eq","value":true}]. ALL must pass for success. ops: eq, neq, contains, not_contains, exists, truthy';

-- Profile: telegram + notification preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_telegram boolean NOT NULL DEFAULT false;