-- ══════════════════════════════════════════════
-- 3.11 — STOCK MOVEMENTS
-- ══════════════════════════════════════════════
CREATE TABLE public.stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.company_settings(id),
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type          public.movement_type NOT NULL,
  quantity      INTEGER NOT NULL,  -- positive = in, negative = out
  new_balance   INTEGER NOT NULL,
  document_ref  TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);

-- ══════════════════════════════════════════════
-- 3.12 — EXPENSES
-- ══════════════════════════════════════════════
CREATE TABLE public.expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.company_settings(id),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  category        TEXT NOT NULL,
  description     TEXT,
  amount          NUMERIC(14,2) NOT NULL,
  payment_method  TEXT,
  reference       TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_expenses_company ON public.expenses(company_id);

-- ══════════════════════════════════════════════
-- 3.13 — AUDIT LOGS (Append-Only)
-- ══════════════════════════════════════════════
CREATE TABLE public.audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id),
  user_name        TEXT NOT NULL,
  action           TEXT NOT NULL,
  document_type    TEXT NOT NULL,
  document_id      UUID,
  document_number  TEXT,
  details          TEXT,
  old_value        JSONB,
  new_value        JSONB,
  ip_address       INET,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ⛔ IMMUTABILITY: Block UPDATE and DELETE on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
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
-- 3.14 — CLOSED FISCAL YEARS
-- ══════════════════════════════════════════════
CREATE TABLE public.closed_fiscal_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.company_settings(id),
  year        INTEGER NOT NULL,
  master_hash TEXT,
  closed_by   UUID REFERENCES auth.users(id),
  closed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, year)
);

ALTER TABLE public.closed_fiscal_years ENABLE ROW LEVEL SECURITY;
