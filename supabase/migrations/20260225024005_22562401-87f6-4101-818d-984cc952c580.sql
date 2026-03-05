
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Votre Société SARL',
  ice TEXT NOT NULL DEFAULT '',
  if_number TEXT NOT NULL DEFAULT '',
  rc TEXT NOT NULL DEFAULT '',
  patente TEXT NOT NULL DEFAULT '',
  cnss TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT,
  rib TEXT NOT NULL DEFAULT '',
  bank TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  capital_social TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON public.company_settings
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_company_settings_updated
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
