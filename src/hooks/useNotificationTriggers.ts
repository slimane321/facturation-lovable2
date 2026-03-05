/**
 * useNotificationTriggers — Detects conditions and fires notifications.
 * Runs once per mount with dedup to prevent spam.
 */
import { useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useDocuments } from '@/contexts/DocumentContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRole } from '@/contexts/RoleContext';
import { useSettings } from '@/contexts/SettingsContext';

export function useNotificationTriggers() {
  const { invoices, clients, products } = useData();
  const { notify, hasSent, registerSent } = useNotifications();
  const { currentUser, isAdmin } = useRole();
  const { closedYears } = useSettings();

  // ── Stock alerts ──
  useEffect(() => {
    products.forEach(p => {
      const stock = p.stock ?? 0;
      const threshold = p.minStockThreshold ?? 5;
      const key = `stock_low_${p.id}_${stock}`;
      if (stock <= threshold && stock > 0 && !hasSent(key)) {
        registerSent(key);
        notify({
          category: 'stock',
          title: 'Stock Faible',
          message: `Le produit "${p.name}" n'a plus que ${stock} unités (seuil: ${threshold}).`,
          href: '/products',
        });
      }
      const outKey = `stock_out_${p.id}`;
      if (stock === 0 && !hasSent(outKey)) {
        registerSent(outKey);
        notify({
          category: 'stock',
          title: 'Rupture de Stock',
          message: `Le produit "${p.name}" est en rupture de stock totale.`,
          href: '/products',
        });
      }
    });
  }, [products, notify, hasSent, registerSent]);

  // ── Overdue invoices ──
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    invoices.forEach(inv => {
      if (
        inv.status === 'validated' &&
        inv.dueDate &&
        inv.dueDate < today &&
        (inv.totals.totalTTC - (inv.totalPaid || 0)) > 0
      ) {
        const key = `overdue_${inv.id}`;
        if (!hasSent(key)) {
          registerSent(key);
          const client = clients.find(c => c.id === inv.clientId);
          notify({
            category: 'payment',
            title: 'Retard de Paiement',
            message: `Facture ${inv.number} du client ${client?.businessName || 'Inconnu'} est en retard de paiement.`,
            href: `/invoices/${inv.id}`,
          });
        }
      }
    });
  }, [invoices, clients, notify, hasSent, registerSent]);

  // ── DGI errors ──
  useEffect(() => {
    if (!isAdmin) return;
    invoices.forEach(inv => {
      if ((inv as any).dgiStatus === 'error') {
        const key = `dgi_error_${inv.id}`;
        if (!hasSent(key)) {
          registerSent(key);
          notify({
            category: 'dgi',
            title: 'Erreur DGI',
            message: `La transmission DGI pour la facture ${inv.number} a échoué. Action requise.`,
            href: `/invoices/${inv.id}`,
          });
        }
      }
    });
  }, [invoices, isAdmin, notify, hasSent, registerSent]);

  // ── Fiscal closing reminder ──
  useEffect(() => {
    if (!isAdmin) return;
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    const currentYear = now.getFullYear();
    const key = `fiscal_reminder_${currentYear}_${now.getMonth()}`;

    if (daysLeft <= 5 && now.getMonth() === 11 && !closedYears.includes(currentYear) && !hasSent(key)) {
      registerSent(key);
      notify({
        category: 'system',
        title: 'Rappel Clôture Fiscale',
        message: `Plus que ${daysLeft} jour(s) avant la fin de l'exercice ${currentYear}. Pensez à effectuer la clôture annuelle.`,
        href: '/settings',
      });
    }
  }, [isAdmin, closedYears, notify, hasSent, registerSent]);
}
