
CREATE TABLE IF NOT EXISTS public.email_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  smtp_host TEXT,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  from_email TEXT,
  from_name TEXT NOT NULL DEFAULT 'LIKKI UNLOCKING',
  reply_to TEXT,
  -- templates: {subject, html} per event
  tpl_welcome JSONB NOT NULL DEFAULT '{"subject":"Welcome to {{site_name}}","html":"<h2>Welcome {{name}}!</h2><p>Your account has been created.</p>"}'::jsonb,
  tpl_order_success JSONB NOT NULL DEFAULT '{"subject":"Order #{{order_number}} completed","html":"<h2>Order completed</h2><p>Hi {{name}},</p><p>Your order #{{order_number}} for IMEI <b>{{imei}}</b> is ready.</p><pre>{{result}}</pre>"}'::jsonb,
  tpl_order_rejected JSONB NOT NULL DEFAULT '{"subject":"Order #{{order_number}} rejected","html":"<h2>Order rejected</h2><p>Hi {{name}},</p><p>Your order #{{order_number}} for IMEI <b>{{imei}}</b> was rejected.</p><p>Reason: {{error}}</p><p>Your balance has been refunded.</p>"}'::jsonb,
  tpl_balance_update JSONB NOT NULL DEFAULT '{"subject":"Balance updated","html":"<h2>Balance updated</h2><p>Hi {{name}},</p><p>Your balance has been adjusted by <b>{{amount}}</b>. New balance: <b>{{balance}}</b>.</p><p>{{note}}</p>"}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_settings_singleton CHECK (id = 1)
);

INSERT INTO public.email_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email settings"
  ON public.email_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role reads via edge functions (bypasses RLS naturally)

CREATE TRIGGER email_settings_updated_at
  BEFORE UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
