-- ══════════════════════════════════════════════
-- 3.10 — ACHATS (Purchases)
-- ══════════════════════════════════════════════
CREATE TABLE public.achats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.company_settings(id),
  number          TEXT NOT NULL,
  achat_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name   TEXT NOT NULL,
  supplier_ice    TEXT,
  supplier_if     TEXT,
  status          public.achat_status NOT NULL DEFAULT 'draft',
  payment_method  TEXT,
  payment_ref     TEXT,
  subtotal_ht     NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_breakdown   JSONB NOT NULL DEFAULT '[]',
  total_tva       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.achats ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.achat_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id      UUID NOT NULL REFERENCES public.achats(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate      SMALLINT NOT NULL DEFAULT 20
                  CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  line_total_ht NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.achat_lines ENABLE ROW LEVEL SECURITY;
