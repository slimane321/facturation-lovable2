-- ══════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- ══════════════════════════════════════════════

-- ── profiles ──
CREATE POLICY "Users read own or admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── user_roles ──
CREATE POLICY "Only admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── company_settings ──
CREATE POLICY "Company members read settings" ON public.company_settings
  FOR SELECT TO authenticated
  USING (public.is_company_member(id));

CREATE POLICY "Admins manage company settings" ON public.company_settings
  FOR ALL TO authenticated
  USING (public.is_admin() AND public.is_company_member(id))
  WITH CHECK (public.is_admin() AND public.is_company_member(id));

-- ── clients ──
CREATE POLICY "Company members read clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Admin/Agent create clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin() OR public.is_agent()) AND public.is_company_member(company_id));

CREATE POLICY "Admin/Agent update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING ((public.is_admin() OR public.is_agent()) AND public.is_company_member(company_id));

CREATE POLICY "Admin deletes clients" ON public.clients
  FOR DELETE TO authenticated
  USING (public.is_admin() AND public.is_company_member(company_id));

-- ── invoices ──
CREATE POLICY "Company members read invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Admin/Agent create invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin() OR public.is_agent()) AND public.is_company_member(company_id));

CREATE POLICY "Admin/Agent update draft invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.is_company_member(company_id)
    AND (
      public.is_admin()
      OR (public.is_agent() AND status = 'draft')
    )
  );

CREATE POLICY "Admin deletes draft invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.is_admin() AND public.is_company_member(company_id) AND status = 'draft');

-- ── audit_logs (append-only) ──
CREATE POLICY "All authenticated read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated insert audit" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ══════════════════════════════════════════════
-- PATTERN FOR REMAINING TABLES
-- ══════════════════════════════════════════════
-- Apply the same pattern to: products, devis, devis_lines,
-- bon_commande, bc_lines, bon_livraison, bl_lines,
-- achats, achat_lines, invoice_lines, payments,
-- stock_movements, expenses, closed_fiscal_years
--
--   SELECT:  is_company_member(company_id)
--   INSERT:  (is_admin() OR is_agent()) AND is_company_member(company_id)
--   UPDATE:  (is_admin() OR is_agent()) AND is_company_member(company_id)
--   DELETE:  is_admin() AND is_company_member(company_id)
