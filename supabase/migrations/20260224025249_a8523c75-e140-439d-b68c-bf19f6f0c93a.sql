
-- ══════════════════════════════════════════════
-- ENUMS
-- ══════════════════════════════════════════════
CREATE TYPE public.client_type AS ENUM ('company', 'individual');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'validated', 'paid', 'cancelled', 'avoir');
CREATE TYPE public.movement_type AS ENUM ('sale', 'purchase', 'return', 'manual');

-- ══════════════════════════════════════════════
-- CLIENTS
-- ══════════════════════════════════════════════
CREATE TABLE public.clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_type    public.client_type NOT NULL DEFAULT 'company',
  business_name  TEXT NOT NULL,
  ice            TEXT DEFAULT '',
  if_number      TEXT DEFAULT '',
  rc             TEXT,
  address        TEXT NOT NULL DEFAULT '',
  city           TEXT NOT NULL DEFAULT '',
  email          TEXT,
  phone          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- PRODUCTS
-- ══════════════════════════════════════════════
CREATE TABLE public.products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  unit_price          NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate            SMALLINT NOT NULL DEFAULT 20 CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  unit                TEXT DEFAULT 'Unité',
  stock               INTEGER NOT NULL DEFAULT 0,
  min_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- INVOICES
-- ══════════════════════════════════════════════
CREATE TABLE public.invoices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number                  TEXT NOT NULL DEFAULT 'BROUILLON',
  invoice_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id               UUID NOT NULL REFERENCES public.clients(id),
  status                  public.invoice_status NOT NULL DEFAULT 'draft',
  notes                   TEXT,
  payment_method          TEXT,
  payment_ref             TEXT,
  subtotal_ht             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tva               NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc               NUMERIC(14,2) NOT NULL DEFAULT 0,
  timbre                  NUMERIC(10,2) NOT NULL DEFAULT 0,
  hash                    TEXT,
  previous_hash           TEXT,
  signature               TEXT,
  original_invoice_id     UUID REFERENCES public.invoices(id),
  has_avoir               BOOLEAN NOT NULL DEFAULT FALSE,
  avoir_id                UUID REFERENCES public.invoices(id),
  total_paid              NUMERIC(14,2) NOT NULL DEFAULT 0,
  bl_id                   UUID,
  dgi_status              TEXT,
  dgi_registration_number TEXT,
  signed_pdf_url          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.invoices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- INVOICE LINES
-- ══════════════════════════════════════════════
CREATE TABLE public.invoice_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate      SMALLINT NOT NULL DEFAULT 20 CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  sort_order    INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.invoice_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- PAYMENTS
-- ══════════════════════════════════════════════
CREATE TABLE public.payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  method        TEXT NOT NULL,
  reference     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- STOCK MOVEMENTS
-- ══════════════════════════════════════════════
CREATE TABLE public.stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type          public.movement_type NOT NULL,
  quantity      INTEGER NOT NULL,
  new_balance   INTEGER NOT NULL,
  document_ref  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.stock_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
