/**
 * Client Statement — shows Total Billed vs Total Paid vs Balance per client.
 * Accessible at /clients/statement
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useLang } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { Users, TrendingUp, AlertCircle, CheckCircle, Search, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground mb-0.5 tabular-nums">{value}</p>
      <p className="text-sm font-medium text-foreground/70">{label}</p>
    </div>
  );
}

export default function ClientStatement() {
  const { clients, invoices } = useData();
  const { t } = useLang();
  const [search, setSearch] = useState('');

  // Build per-client financial summary
  const clientStats = useMemo(() => {
    return clients.map(client => {
      const clientInvoices = invoices.filter(inv => inv.clientId === client.id);

      // Total Facturé = validated/paid invoices minus avoir amounts
      const totalBilled = clientInvoices
        .filter(inv => ['validated', 'paid'].includes(inv.status))
        .reduce((sum, inv) => sum + inv.totals.totalTTC, 0)
        - clientInvoices
          .filter(inv => inv.status === 'avoir')
          .reduce((sum, inv) => sum + Math.abs(inv.totals.totalTTC), 0);

      // Total Payé = sum of all recorded payments across invoices
      const totalPaid = clientInvoices
        .reduce((sum, inv) => sum + (inv.totalPaid || 0), 0);

      const balance = totalBilled - totalPaid;

      const invoiceCount = clientInvoices.filter(
        inv => ['validated', 'paid', 'pending'].includes(inv.status)
      ).length;

      const lastInvoice = [...clientInvoices]
        .sort((a, b) => b.date.localeCompare(a.date))[0];

      return {
        client,
        totalBilled,
        totalPaid,
        balance,
        invoiceCount,
        lastInvoiceDate: lastInvoice?.date,
      };
    });
  }, [clients, invoices]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clientStats
      .filter(cs =>
        !q ||
        cs.client.businessName.toLowerCase().includes(q) ||
        cs.client.city.toLowerCase().includes(q)
      )
      .sort((a, b) => b.balance - a.balance);
  }, [clientStats, search]);

  // Global totals
  const globalStats = useMemo(() => {
    const totalBilled = clientStats.reduce((s, cs) => s + cs.totalBilled, 0);
    const totalPaid = clientStats.reduce((s, cs) => s + cs.totalPaid, 0);
    const totalOutstanding = totalBilled - totalPaid;
    const clientsWithBalance = clientStats.filter(cs => cs.balance > 0).length;
    return { totalBilled, totalPaid, totalOutstanding, clientsWithBalance };
  }, [clientStats]);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/clients"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">État des Comptes Clients</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Suivi du total facturé, payé et solde restant par client
            </p>
          </div>
        </div>
      </div>
      <div className="gold-accent-line w-24" />

      {/* Global summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={TrendingUp}
          label="Total Facturé"
          value={formatCurrency(globalStats.totalBilled)}
          color="bg-primary/10 text-primary"
        />
        <SummaryCard
          icon={CheckCircle}
          label="Total Encaissé"
          value={formatCurrency(globalStats.totalPaid)}
          color="bg-primary/10 text-primary"
        />
        <SummaryCard
          icon={AlertCircle}
          label="Solde Impayé"
          value={formatCurrency(globalStats.totalOutstanding)}
          color="bg-gold/15 text-gold-foreground"
        />
        <SummaryCard
          icon={Users}
          label="Clients avec solde"
          value={String(globalStats.clientsWithBalance)}
          color="bg-secondary text-secondary-foreground"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client..."
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* Client Statement Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">Aucun client trouvé</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">ICE / Ville</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Facturé</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Payé</th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solde Restant</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Factures</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Dernière Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(({ client, totalBilled, totalPaid, balance, invoiceCount, lastInvoiceDate }) => (
                <tr key={client.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {client.businessName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{client.businessName}</p>
                        <p className="text-xs text-muted-foreground">{client.clientType === 'company' ? 'Société' : 'Particulier'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    {client.ice && <p className="text-xs font-mono text-muted-foreground">ICE: {client.ice}</p>}
                    <p className="text-sm text-muted-foreground">{client.city}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(totalBilled)}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm font-semibold tabular-nums text-primary">{formatCurrency(totalPaid)}</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={cn(
                      'inline-block px-3 py-1 rounded-full text-sm font-bold tabular-nums',
                      balance > 0
                        ? 'bg-gold/15 text-gold-foreground'
                        : balance < 0
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary'
                    )}>
                      {formatCurrency(balance)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center hidden lg:table-cell">
                    <Link
                      to={`/invoices?client=${client.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {invoiceCount} facture{invoiceCount !== 1 ? 's' : ''}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-right hidden lg:table-cell">
                    <p className="text-sm text-muted-foreground">
                      {lastInvoiceDate
                        ? new Date(lastInvoiceDate).toLocaleDateString('fr-MA')
                        : '—'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Footer totals row */}
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td colSpan={2} className="px-5 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">TOTAL GÉNÉRAL</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(globalStats.totalBilled)}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(globalStats.totalPaid)}</p>
                </td>
                <td className="px-5 py-3 text-right">
                  <p className={cn(
                    'text-sm font-bold tabular-nums',
                    globalStats.totalOutstanding > 0 ? 'text-gold-foreground' : 'text-primary'
                  )}>
                    {formatCurrency(globalStats.totalOutstanding)}
                  </p>
                </td>
                <td colSpan={2} className="hidden lg:table-cell" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
