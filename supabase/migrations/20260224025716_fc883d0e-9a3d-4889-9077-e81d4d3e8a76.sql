
-- ══════════════════════════════════════════════
-- ENUMS for new tables
-- ══════════════════════════════════════════════
CREATE TYPE public.devis_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');
CREATE TYPE public.bc_status AS ENUM ('draft', 'confirmed', 'converted', 'cancelled');
CREATE TYPE public.bl_status AS ENUM ('draft', 'delivered', 'converted', 'cancelled');
CREATE TYPE public.achat_status AS ENUM ('draft', 'validated', 'paid', 'cancelled');

-- ══════════════════════════════════════════════
-- DEVIS (Quotes)
-- ══════════════════════════════════════════════
CREATE TABLE public.devis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number          TEXT NOT NULL,
  devis_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date   DATE,
  client_id       UUID NOT NULL REFERENCES public.clients(id),
  status          public.devis_status NOT NULL DEFAULT 'draft',
  notes           TEXT,
  payment_method  TEXT,
  subtotal_ht     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tva       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_converted    BOOLEAN NOT NULL DEFAULT FALSE,
  converted_bc_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.devis FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.devis_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id      UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate      SMALLINT NOT NULL DEFAULT 20 CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  sort_order    INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.devis_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.devis_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- BON DE COMMANDE (Purchase Orders)
-- ══════════════════════════════════════════════
CREATE TABLE public.bon_commande (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number          TEXT NOT NULL,
  bc_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id       UUID NOT NULL REFERENCES public.clients(id),
  status          public.bc_status NOT NULL DEFAULT 'draft',
  notes           TEXT,
  payment_method  TEXT,
  subtotal_ht     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tva       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_converted    BOOLEAN NOT NULL DEFAULT FALSE,
  source_devis_id UUID REFERENCES public.devis(id),
  converted_bl_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bon_commande ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.bon_commande FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.bc_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bc_id         UUID NOT NULL REFERENCES public.bon_commande(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate      SMALLINT NOT NULL DEFAULT 20 CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  sort_order    INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.bc_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.bc_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- BON DE LIVRAISON (Delivery Notes)
-- ══════════════════════════════════════════════
CREATE TABLE public.bon_livraison (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number            TEXT NOT NULL,
  bl_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id         UUID NOT NULL REFERENCES public.clients(id),
  status            public.bl_status NOT NULL DEFAULT 'draft',
  notes             TEXT,
  subtotal_ht       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tva         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc         NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_converted      BOOLEAN NOT NULL DEFAULT FALSE,
  source_bc_id      UUID REFERENCES public.bon_commande(id),
  source_invoice_id UUID REFERENCES public.invoices(id),
  linked_invoice_id UUID REFERENCES public.invoices(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bon_livraison ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.bon_livraison FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Add FK on invoices.bl_id -> bon_livraison
ALTER TABLE public.invoices
  ADD CONSTRAINT fk_invoices_bl
  FOREIGN KEY (bl_id) REFERENCES public.bon_livraison(id);

CREATE TABLE public.bl_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bl_id         UUID NOT NULL REFERENCES public.bon_livraison(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate      SMALLINT NOT NULL DEFAULT 20 CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  sort_order    INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.bl_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.bl_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- ACHATS (Purchases)
-- ══════════════════════════════════════════════
CREATE TABLE public.achats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number          TEXT NOT NULL,
  achat_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name   TEXT NOT NULL,
  supplier_ice    TEXT,
  supplier_if     TEXT,
  status          public.achat_status NOT NULL DEFAULT 'draft',
  payment_method  TEXT,
  payment_ref     TEXT,
  subtotal_ht     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tva       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.achats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.achats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.achat_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id      UUID NOT NULL REFERENCES public.achats(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id),
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate      SMALLINT NOT NULL DEFAULT 20 CHECK (vat_rate IN (0, 7, 10, 14, 20)),
  sort_order    INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.achat_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.achat_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- EXPENSES
-- ══════════════════════════════════════════════
CREATE TABLE public.expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  category        TEXT NOT NULL,
  description     TEXT,
  amount          NUMERIC(14,2) NOT NULL,
  payment_method  TEXT,
  reference       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- AUDIT LOGS (Append-Only)
-- ══════════════════════════════════════════════
CREATE TABLE public.audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name        TEXT NOT NULL DEFAULT '',
  action           TEXT NOT NULL,
  document_type    TEXT NOT NULL,
  document_id      TEXT,
  document_number  TEXT,
  details          TEXT,
  old_value        JSONB,
  new_value        JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for now" ON public.audit_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert for now" ON public.audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Immutability triggers
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only. UPDATE and DELETE are forbidden.';
END;
$$;

CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- ══════════════════════════════════════════════
-- CLOSED FISCAL YEARS
-- ══════════════════════════════════════════════
CREATE TABLE public.closed_fiscal_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INTEGER NOT NULL UNIQUE,
  master_hash TEXT,
  closed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.closed_fiscal_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.closed_fiscal_years FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════
-- updated_at triggers for new tables
-- ══════════════════════════════════════════════
CREATE TRIGGER trg_devis_updated_at BEFORE UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bon_commande_updated_at BEFORE UPDATE ON public.bon_commande FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bon_livraison_updated_at BEFORE UPDATE ON public.bon_livraison FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_achats_updated_at BEFORE UPDATE ON public.achats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
