-- ══════════════════════════════════════════════
-- 3.3 — CLIENTS
-- ══════════════════════════════════════════════
CREATE TABLE public.clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES public.company_settings(id),
  client_type    public.client_type NOT NULL DEFAULT 'company',
  business_name  TEXT NOT NULL,
  ice            TEXT,
  if_number      TEXT,
  rc             TEXT,
  address        TEXT NOT NULL DEFAULT '',
  city           TEXT NOT NULL DEFAULT '',
  email          TEXT,
  phone          TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clients_company ON public.clients(company_id);
CREATE INDEX idx_clients_ice ON public.clients(ice) WHERE ice IS NOT NULL;

-- ══════════════════════════════════════════════
-- 3.4 — PRODUCTS
-- ══════════════════════════════════════════════
CREATE TABLE public.products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.company_settings(id),
  reference           TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  unit_price          NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate            SMALLINT NOT NULL DEFAULT 20
                        CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  unit                TEXT DEFAULT 'Unité',
  stock               INTEGER NOT NULL DEFAULT 0,
  min_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, reference)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_company ON public.products(company_id);
