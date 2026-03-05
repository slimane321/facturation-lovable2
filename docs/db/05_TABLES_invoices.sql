-- ══════════════════════════════════════════════
-- 3.5 — INVOICES
-- ══════════════════════════════════════════════
CREATE TABLE public.invoices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES public.company_settings(id),
  number                  TEXT NOT NULL DEFAULT 'BROUILLON',
  invoice_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id               UUID NOT NULL REFERENCES public.clients(id),
  status                  public.invoice_status NOT NULL DEFAULT 'draft',
  notes                   TEXT,
  payment_method          TEXT,
  payment_ref             TEXT,
  -- Computed totals stored for performance
  subtotal_ht             NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_breakdown           JSONB NOT NULL DEFAULT '[]',
  total_tva               NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc               NUMERIC(14,2) NOT NULL DEFAULT 0,
  timbre                  NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Art. 210 CGI cryptographic chain
  hash                    TEXT,
  previous_hash           TEXT,
  signature               TEXT,
  -- Avoir link
  original_invoice_id     UUID REFERENCES public.invoices(id),
  has_avoir               BOOLEAN NOT NULL DEFAULT FALSE,
  avoir_id                UUID REFERENCES public.invoices(id),
  -- Payments
  total_paid              NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- BL link (FK added in 08_TABLES_bon_livraison.sql)
  bl_id                   UUID,
  -- DGI e-Facture
  dgi_status              public.dgi_status,
  dgi_registration_number TEXT,
  signed_pdf_url          TEXT,
  -- Metadata
  created_by              UUID REFERENCES auth.users(id),
  validated_by            UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invoices_company ON public.invoices(company_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE UNIQUE INDEX idx_invoices_number_unique
  ON public.invoices(company_id, number)
  WHERE number <> 'BROUILLON';

-- ══════════════════════════════════════════════
-- 3.5 — INVOICE LINES
-- ══════════════════════════════════════════════
CREATE TABLE public.invoice_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate      SMALLINT NOT NULL DEFAULT 20
                  CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  line_total_ht NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);

-- ══════════════════════════════════════════════
-- 3.6 — PAYMENTS
-- ══════════════════════════════════════════════
CREATE TABLE public.payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  method        TEXT NOT NULL,
  reference     TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
