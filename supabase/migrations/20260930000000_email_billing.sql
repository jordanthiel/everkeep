CREATE TABLE billing_orders (
  session_id TEXT PRIMARY KEY,
  payment_intent TEXT NOT NULL,
  email TEXT NOT NULL,
  account_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX billing_orders_email ON billing_orders(email);
CREATE INDEX billing_orders_account ON billing_orders(account_id);
CREATE TABLE billing_payment_blocks (payment_intent TEXT PRIMARY KEY, reason TEXT NOT NULL);
ALTER TABLE public.billing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_orders, public.billing_payment_blocks FROM anon, authenticated;
