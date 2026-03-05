-- ══════════════════════════════════════════════
-- 3.1 — PROFILES (1:1 with auth.users)
-- ══════════════════════════════════════════════
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL DEFAULT '',
  phone       TEXT,
  avatar_url  TEXT,
  company_id  UUID,  -- FK added after company_settings exists
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ══════════════════════════════════════════════
-- 3.1 — USER ROLES (separate table — prevents privilege escalation)
-- ══════════════════════════════════════════════
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════
-- 3.2 — COMPANY SETTINGS
-- ══════════════════════════════════════════════
CREATE TABLE public.company_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    TEXT NOT NULL DEFAULT '',
  ice             TEXT,
  if_number       TEXT,
  rc              TEXT,
  patente         TEXT,
  cnss            TEXT,
  capital_social  TEXT,
  address         TEXT,
  city            TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  rib_iban        TEXT,
  bank_name       TEXT,
  logo_base64     TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Add deferred FK on profiles
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_company
  FOREIGN KEY (company_id) REFERENCES public.company_settings(id);
