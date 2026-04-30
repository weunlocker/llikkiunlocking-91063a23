-- Add sequential order number to orders
CREATE SEQUENCE IF NOT EXISTS public.orders_number_seq START 1;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number integer;

-- Backfill existing rows in created_at order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.orders
)
UPDATE public.orders o
SET order_number = ordered.rn
FROM ordered
WHERE o.id = ordered.id AND o.order_number IS NULL;

-- Advance sequence past the max existing value
SELECT setval('public.orders_number_seq', GREATEST((SELECT COALESCE(MAX(order_number), 0) FROM public.orders), 1));

-- Default new rows to nextval
ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT nextval('public.orders_number_seq');

ALTER TABLE public.orders
  ALTER COLUMN order_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders(order_number);

ALTER SEQUENCE public.orders_number_seq OWNED BY public.orders.order_number;