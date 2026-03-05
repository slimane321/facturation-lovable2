
-- Replace all permissive "Allow all for now" policies with proper auth-based ones
-- Pattern: authenticated users can SELECT, admins+agents can INSERT/UPDATE, admins can DELETE

-- === CLIENTS ===
DROP POLICY IF EXISTS "Allow all for now" ON public.clients;
CREATE POLICY "Authenticated can read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update clients" ON public.clients FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete clients" ON public.clients FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === PRODUCTS ===
DROP POLICY IF EXISTS "Allow all for now" ON public.products;
CREATE POLICY "Authenticated can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update products" ON public.products FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete products" ON public.products FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === INVOICES ===
DROP POLICY IF EXISTS "Allow all for now" ON public.invoices;
CREATE POLICY "Authenticated can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === INVOICE_LINES ===
DROP POLICY IF EXISTS "Allow all for now" ON public.invoice_lines;
CREATE POLICY "Authenticated can read invoice_lines" ON public.invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert invoice_lines" ON public.invoice_lines FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update invoice_lines" ON public.invoice_lines FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete invoice_lines" ON public.invoice_lines FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === PAYMENTS ===
DROP POLICY IF EXISTS "Allow all for now" ON public.payments;
CREATE POLICY "Authenticated can read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update payments" ON public.payments FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete payments" ON public.payments FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === DEVIS ===
DROP POLICY IF EXISTS "Allow all for now" ON public.devis;
CREATE POLICY "Authenticated can read devis" ON public.devis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert devis" ON public.devis FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update devis" ON public.devis FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete devis" ON public.devis FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === DEVIS_LINES ===
DROP POLICY IF EXISTS "Allow all for now" ON public.devis_lines;
CREATE POLICY "Authenticated can read devis_lines" ON public.devis_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert devis_lines" ON public.devis_lines FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update devis_lines" ON public.devis_lines FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete devis_lines" ON public.devis_lines FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === BON_COMMANDE ===
DROP POLICY IF EXISTS "Allow all for now" ON public.bon_commande;
CREATE POLICY "Authenticated can read bon_commande" ON public.bon_commande FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert bon_commande" ON public.bon_commande FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update bon_commande" ON public.bon_commande FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete bon_commande" ON public.bon_commande FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === BC_LINES ===
DROP POLICY IF EXISTS "Allow all for now" ON public.bc_lines;
CREATE POLICY "Authenticated can read bc_lines" ON public.bc_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert bc_lines" ON public.bc_lines FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update bc_lines" ON public.bc_lines FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete bc_lines" ON public.bc_lines FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === BON_LIVRAISON ===
DROP POLICY IF EXISTS "Allow all for now" ON public.bon_livraison;
CREATE POLICY "Authenticated can read bon_livraison" ON public.bon_livraison FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert bon_livraison" ON public.bon_livraison FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update bon_livraison" ON public.bon_livraison FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete bon_livraison" ON public.bon_livraison FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === BL_LINES ===
DROP POLICY IF EXISTS "Allow all for now" ON public.bl_lines;
CREATE POLICY "Authenticated can read bl_lines" ON public.bl_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert bl_lines" ON public.bl_lines FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update bl_lines" ON public.bl_lines FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete bl_lines" ON public.bl_lines FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === ACHATS ===
DROP POLICY IF EXISTS "Allow all for now" ON public.achats;
CREATE POLICY "Authenticated can read achats" ON public.achats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert achats" ON public.achats FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update achats" ON public.achats FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete achats" ON public.achats FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === ACHAT_LINES ===
DROP POLICY IF EXISTS "Allow all for now" ON public.achat_lines;
CREATE POLICY "Authenticated can read achat_lines" ON public.achat_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert achat_lines" ON public.achat_lines FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update achat_lines" ON public.achat_lines FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete achat_lines" ON public.achat_lines FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === STOCK_MOVEMENTS ===
DROP POLICY IF EXISTS "Allow all for now" ON public.stock_movements;
CREATE POLICY "Authenticated can read stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete stock_movements" ON public.stock_movements FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === EXPENSES ===
DROP POLICY IF EXISTS "Allow all for now" ON public.expenses;
CREATE POLICY "Authenticated can read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Agent can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin/Agent can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'agent'::public.app_role)
);
CREATE POLICY "Admin can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- === AUDIT_LOGS (keep append-only: authenticated can SELECT + INSERT) ===
DROP POLICY IF EXISTS "Allow read for now" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow insert for now" ON public.audit_logs;
CREATE POLICY "Authenticated can read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- === CLOSED_FISCAL_YEARS ===
DROP POLICY IF EXISTS "Allow all for now" ON public.closed_fiscal_years;
CREATE POLICY "Authenticated can read closed_fiscal_years" ON public.closed_fiscal_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage closed_fiscal_years" ON public.closed_fiscal_years FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- === COMPANY_SETTINGS ===
DROP POLICY IF EXISTS "Allow all for now" ON public.company_settings;
CREATE POLICY "Authenticated can read company_settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage company_settings" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
