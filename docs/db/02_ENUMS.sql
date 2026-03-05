# FacturaPro — Enums & Types

```sql
-- ══════════════════════════════════════════════
-- ENUMS
-- ══════════════════════════════════════════════

CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'comptable');

CREATE TYPE public.client_type AS ENUM ('company', 'individual');

CREATE TYPE public.invoice_status AS ENUM (
  'draft', 'pending', 'validated', 'paid', 'cancelled', 'avoir'
);

CREATE TYPE public.devis_status AS ENUM (
  'draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'
);

CREATE TYPE public.bc_status AS ENUM (
  'draft', 'confirmed', 'converted', 'cancelled'
);

CREATE TYPE public.bl_status AS ENUM (
  'draft', 'delivered', 'converted', 'cancelled'
);

CREATE TYPE public.achat_status AS ENUM (
  'draft', 'validated', 'paid', 'cancelled'
);

CREATE TYPE public.dgi_status AS ENUM (
  'pending', 'accepted', 'rejected', 'manual'
);

CREATE TYPE public.movement_type AS ENUM (
  'sale', 'purchase', 'return', 'manual'
);
```
