
-- Stock groups
CREATE TABLE public.stock_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_groups TO authenticated;
GRANT ALL ON public.stock_groups TO service_role;
ALTER TABLE public.stock_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stock_groups" ON public.stock_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER stock_groups_updated_at BEFORE UPDATE ON public.stock_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stock items
CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.stock_groups(id) ON DELETE CASCADE,
  license_key text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold')),
  sold_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  sold_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stock_items" ON public.stock_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_stock_items_group_avail ON public.stock_items (group_id, created_at) WHERE status = 'available';
CREATE INDEX idx_stock_items_group_sold  ON public.stock_items (group_id, sold_at DESC) WHERE status = 'sold';

-- Service linkage
ALTER TABLE public.services ADD COLUMN stock_group_id uuid REFERENCES public.stock_groups(id) ON DELETE SET NULL;
CREATE INDEX idx_services_stock_group ON public.services (stock_group_id) WHERE stock_group_id IS NOT NULL;

-- Atomic consume: returns license_key text, or NULL when out of stock
CREATE OR REPLACE FUNCTION public.consume_stock(p_group_id uuid, p_order_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_key text;
BEGIN
  SELECT id INTO v_id
  FROM public.stock_items
  WHERE group_id = p_group_id AND status = 'available'
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.stock_items
     SET status = 'sold',
         sold_order_id = p_order_id,
         sold_user_id = p_user_id,
         sold_at = now()
   WHERE id = v_id
   RETURNING license_key INTO v_key;

  RETURN v_key;
END;
$$;
