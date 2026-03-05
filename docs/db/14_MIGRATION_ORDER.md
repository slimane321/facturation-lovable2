# FacturaPro — Ordre de Migration & Edge Functions

## Ordre d'exécution des fichiers SQL

| # | Fichier | Contenu |
|---|---------|---------|
| 1 | `02_ENUMS.sql` | Tous les types ENUM |
| 2 | `03_TABLES_identity.sql` | profiles, user_roles, company_settings |
| 3 | `04_TABLES_clients_products.sql` | clients, products |
| 4 | `05_TABLES_invoices.sql` | invoices, invoice_lines, payments |
| 5 | `06_TABLES_devis.sql` | devis, devis_lines |
| 6 | `07_TABLES_bon_commande.sql` | bon_commande, bc_lines |
| 7 | `08_TABLES_bon_livraison.sql` | bon_livraison, bl_lines + FK invoices.bl_id |
| 8 | `09_TABLES_achats.sql` | achats, achat_lines |
| 9 | `10_TABLES_stock_audit_fiscal.sql` | stock_movements, expenses, audit_logs, closed_fiscal_years |
| 10 | `11_FUNCTIONS.sql` | has_role, is_admin, is_agent, is_comptable, is_company_member |
| 11 | `12_RLS_POLICIES.sql` | Toutes les politiques RLS |
| 12 | `13_TRIGGERS_updated_at.sql` | Triggers updated_at automatiques |

## Edge Functions requises

| Fonction | Objectif |
|----------|----------|
| `sign-invoice` | Calcul SHA-256 hash & signature HMAC côté serveur avec clé secrète en env |
| `validate-invoice` | Attribution numéro séquentiel, hash, mise à jour statut atomique |
| `close-fiscal-year` | Calcul master hash pour toutes les factures d'un exercice |
| `verify-chain` | Re-calcul et vérification de l'intégrité de la chaîne complète |
