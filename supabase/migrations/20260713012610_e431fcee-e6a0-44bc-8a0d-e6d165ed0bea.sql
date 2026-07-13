
-- Auto-create invoice as pending when a payment order is created, and keep status in sync.
CREATE OR REPLACE FUNCTION public.sync_invoice_from_payment_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_status := CASE WHEN NEW.credited THEN 'paid'
                     WHEN NEW.status IN ('failed','cancelled','expired') THEN 'void'
                     ELSE 'pending' END;
    INSERT INTO public.invoices (user_id, payment_order_id, provider, amount, currency, coin, tx_id, status, issued_at)
    VALUES (NEW.user_id, NEW.id, NEW.provider, NEW.amount, NEW.currency, NEW.coin, NEW.tx_id, v_status, COALESCE(NEW.matched_at, NEW.created_at, now()))
    ON CONFLICT (payment_order_id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- UPDATE: sync status
  v_status := CASE WHEN NEW.credited THEN 'paid'
                   WHEN NEW.status IN ('failed','cancelled','expired') THEN 'void'
                   WHEN NEW.status = 'paid' THEN 'paid'
                   ELSE 'pending' END;
  UPDATE public.invoices
     SET status = v_status,
         amount = NEW.amount,
         currency = NEW.currency,
         coin = NEW.coin,
         tx_id = COALESCE(NEW.tx_id, tx_id),
         provider = NEW.provider,
         issued_at = COALESCE(NEW.matched_at, issued_at)
   WHERE payment_order_id = NEW.id;

  -- If invoice didn't exist yet (older orders), create it now
  IF NOT FOUND THEN
    INSERT INTO public.invoices (user_id, payment_order_id, provider, amount, currency, coin, tx_id, status, issued_at)
    VALUES (NEW.user_id, NEW.id, NEW.provider, NEW.amount, NEW.currency, NEW.coin, NEW.tx_id, v_status, COALESCE(NEW.matched_at, NEW.created_at, now()))
    ON CONFLICT (payment_order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_invoice_on_payment_order_ins ON public.payment_orders;
DROP TRIGGER IF EXISTS trg_invoice_on_payment_order_upd ON public.payment_orders;
DROP TRIGGER IF EXISTS trg_create_invoice_on_credit ON public.payment_orders;

CREATE TRIGGER trg_invoice_on_payment_order_ins
AFTER INSERT ON public.payment_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_from_payment_order();

CREATE TRIGGER trg_invoice_on_payment_order_upd
AFTER UPDATE ON public.payment_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_from_payment_order();

-- Backfill invoices for existing payment orders that don't have one yet
INSERT INTO public.invoices (user_id, payment_order_id, provider, amount, currency, coin, tx_id, status, issued_at)
SELECT po.user_id, po.id, po.provider, po.amount, po.currency, po.coin, po.tx_id,
       CASE WHEN po.credited THEN 'paid'
            WHEN po.status IN ('failed','cancelled','expired') THEN 'void'
            ELSE 'pending' END,
       COALESCE(po.matched_at, po.created_at, now())
FROM public.payment_orders po
LEFT JOIN public.invoices i ON i.payment_order_id = po.id
WHERE i.id IS NULL
ON CONFLICT (payment_order_id) DO NOTHING;
