-- ══════════════════════════════════════════════
-- 3.8 — BON DE COMMANDE (Purchase Orders)
-- ══════════════════════════════════════════════
CREATE TABLE public.bon_commande (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.company_settings(id),
  number          TEXT NOT NULL,
  bc_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id       UUID NOT NULL REFERENCES public.clients(id),
  status          public.bc_status NOT NULL DEFAULT 'draft',
  notes           TEXT,
  payment_method  TEXT,
  subtotal_ht     NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_breakdown   JSONB NOT NULL DEFAULT '[]',
  total_tva       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_converted    BOOLEAN NOT NULL DEFAULT FALSE,
  source_devis_id UUID REFERENCES public.devis(id),
  converted_bl_id UUID,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bon_commande ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bc_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bc_id         UUID NOT NULL REFERENCES public.bon_commande(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate      SMALLINT NOT NULL DEFAULT 20
                  CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  line_total_ht NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.bc_lines ENABLE ROW LEVEL SECURITY;
