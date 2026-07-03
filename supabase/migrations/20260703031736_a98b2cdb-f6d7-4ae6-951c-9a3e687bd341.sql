
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number bigserial UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_order_id uuid UNIQUE REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'binance',
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USDT',
  coin text,
  tx_id text,
  status text NOT NULL DEFAULT 'paid',
  notes text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON public.invoices(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.invoices_invoice_number_seq TO authenticated, service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create invoice when payment_orders is credited
CREATE OR REPLACE FUNCTION public.create_invoice_on_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.credited = true AND (OLD.credited IS DISTINCT FROM true) THEN
    INSERT INTO public.invoices (user_id, payment_order_id, provider, amount, currency, coin, tx_id, status, issued_at)
    VALUES (NEW.user_id, NEW.id, NEW.provider, NEW.amount, NEW.currency, NEW.coin, NEW.tx_id, 'paid', COALESCE(NEW.matched_at, now()))
    ON CONFLICT (payment_order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS payment_orders_create_invoice ON public.payment_orders;
CREATE TRIGGER payment_orders_create_invoice
  AFTER INSERT OR UPDATE OF credited ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.create_invoice_on_credit();

-- Backfill invoices for already-credited top-ups
INSERT INTO public.invoices (user_id, payment_order_id, provider, amount, currency, coin, tx_id, status, issued_at, created_at)
SELECT po.user_id, po.id, po.provider, po.amount, po.currency, po.coin, po.tx_id, 'paid', COALESCE(po.matched_at, po.created_at), po.created_at
FROM public.payment_orders po
WHERE po.credited = true
ON CONFLICT (payment_order_id) DO NOTHING;
