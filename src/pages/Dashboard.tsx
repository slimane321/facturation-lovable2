import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useDocuments } from '@/contexts/DocumentContext';
import { useRole } from '@/contexts/RoleContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { useExpenses } from '@/pages/Depenses';
import { verifyChain } from '@/lib/hashUtils';
import {
  TrendingUp, Clock, Users, CheckCircle, Plus, ArrowUpRight, FileText, FileCheck, Truck, AlertCircle, ShieldCheck, ShieldAlert, PackageX, TrendingDown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Status badge ──────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    validated: 'badge-validated',
    paid: 'badge-paid',
    pending: 'badge-pending',
    avoir: 'badge-avoir',
    draft: 'text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground',
    cancelled: 'text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive',
  };
  const labels: Record<string, string> = {
    validated: 'Validée', paid: 'Payée', pending: 'En attente',
    avoir: 'Avoir', draft: 'Brouillon', cancelled: 'Annulée',
  };
  return <span className={map[status] || map.draft}>{labels[status] || status}</span>;
}

// ── Stat card ─────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, color, href
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
  href?: string;
}) {
  const Inner = (
    <div className={cn('stat-card group animate-fade-in', href && 'cursor-pointer')}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5" />
        </div>
        {href && <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />}
      </div>
      <p className="text-2xl font-bold text-foreground mb-0.5 tabular-nums">{value}</p>
      <p className="text-sm font-medium text-foreground/70">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link to={href}>{Inner}</Link> : Inner;
}

// ── Revenue chart data ─────────────────────────
function buildRevenueData(invoices: ReturnType<typeof useData>['invoices']) {
  const months: Record<string, number> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString('fr-MA', { month: 'short' });
    months[key] = 0;
  }
  invoices.forEach(inv => {
    if (['validated', 'paid'].includes(inv.status)) {
      const d = new Date(inv.date);
      const key = d.toLocaleString('fr-MA', { month: 'short' });
      if (key in months) months[key] += inv.totals.totalTTC;
    }
  });
  return Object.entries(months).map(([name, value]) => ({ name, value }));
}

const PIE_COLORS = ['hsl(145,63%,22%)', 'hsl(43,96%,48%)', 'hsl(145,55%,50%)', 'hsl(0,72%,51%)'];

export default function Dashboard() {
  const { t, lang } = useLang();
  const { invoices, clients, products } = useData();
  const { devisList, blList } = useDocuments();
  const { can } = useRole();
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const allExpenses = useExpenses();

  const getHashedInvoices = useCallback(() => {
    return invoices
      .filter(i => i.hash && (i.status === 'validated' || i.status === 'paid' || i.status === 'avoir'))
      .sort((a, b) => a.number.localeCompare(b.number))
      .map(i => ({
        number: i.number, date: i.date,
        clientICE: clients.find(c => c.id === i.clientId)?.ice || '',
        totalTTC: i.totals.totalTTC, hash: i.hash, previousHash: i.previousHash, signature: i.signature,
      }));
  }, [invoices, clients]);

  useEffect(() => {
    const hashed = getHashedInvoices();
    if (hashed.length === 0) { setChainValid(true); return; }
    verifyChain(hashed).then(res => setChainValid(res.valid));
  }, [getHashedInvoices]);

  const stats = useMemo(() => {
    const paid = invoices.filter(i => ['paid', 'validated'].includes(i.status));
    const pending = invoices.filter(i => i.status === 'pending');
    const totalRevenue = paid.reduce((s, i) => s + i.totals.totalTTC, 0);
    // Pending: show only "reste à payer" (totalTTC minus any partial payments)
    const pendingResteAPayer = pending.reduce((s, i) => s + (i.totals.totalTTC - (i.totalPaid || 0)), 0);
    // Commercial document stats
    const pendingDevis = devisList.filter(d => d.status === 'draft' || d.status === 'sent');
    const pendingDevisAmount = pendingDevis.reduce((s, d) => s + d.totals.totalTTC, 0);
    const uninvoicedBL = blList.filter(b => b.status !== 'invoiced');
    const uninvoicedBLAmount = uninvoicedBL.reduce((s, b) => s + b.totals.subtotalHT, 0);
    // Total outstanding = sum of reste à payer for validated invoices
    const totalOutstanding = invoices
      .filter(i => i.status === 'validated' && i.totals.totalTTC > 0)
      .reduce((s, i) => s + (i.totals.totalTTC - (i.totalPaid || 0)), 0);
    // Overdue invoices — only those with actual remaining balance
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueInvoices = invoices.filter(i =>
      i.status === 'validated' && i.dueDate && i.dueDate < todayStr && (i.totals.totalTTC - (i.totalPaid || 0)) > 0
    );
    const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.totals.totalTTC - (i.totalPaid || 0)), 0);
    // Total expenses for current year
    const currentYear = new Date().getFullYear();
    const totalExpenses = allExpenses
      .filter(e => new Date(e.date).getFullYear() === currentYear)
      .reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    return {
      totalRevenue, pendingCount: pending.length, pendingAmount: pendingResteAPayer, clientCount: clients.length,
      pendingDevisCount: pendingDevis.length, pendingDevisAmount,
      uninvoicedBLCount: uninvoicedBL.length, uninvoicedBLAmount,
      totalOutstanding, overdueCount: overdueInvoices.length, overdueAmount,
      totalExpenses, netProfit,
    };
  }, [invoices, clients, devisList, blList, allExpenses]);

  const revenueData = useMemo(() => buildRevenueData(invoices), [invoices]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(i => { map[i.status] = (map[i.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const recentInvoices = useMemo(
    () => [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [invoices]
  );

  const recentClients = useMemo(
    () => clients.slice(-4).reverse(),
    [clients]
  );

  const lowStockItems = useMemo(
    () => products.filter(p => (p.stock ?? 0) <= (p.minStockThreshold ?? 5))
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)),
    [products]
  );

  const outOfStockCount = useMemo(
    () => products.filter(p => (p.stock ?? 0) <= 0).length,
    [products]
  );

  const negativeStockCount = useMemo(
    () => products.filter(p => (p.stock ?? 0) < 0).length,
    [products]
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.dashboard}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {chainValid !== null && (
            <Link
              to="/settings"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                chainValid
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              }`}
            >
              {chainValid ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              {chainValid ? t.secureSystem : t.integrityCompromised}
            </Link>
          )}
          {can('create_invoice') && (
            <Link
              to="/invoices/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {t.createInvoice}
            </Link>
          )}
        </div>
      </div>

      {/* Gold accent */}
      <div className="gold-accent-line w-24" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {can('view_revenue') && (
          <StatCard
            icon={TrendingUp} label={t.totalRevenue} value={formatCurrency(stats.totalRevenue)}
            sub={t.thisMonth} color="bg-primary/10 text-primary" href="/invoices"
          />
        )}
        <StatCard
          icon={Clock} label={t.pendingInvoices} value={String(stats.pendingCount)}
          sub={formatCurrency(stats.pendingAmount)} color="bg-gold/15 text-gold-foreground" href="/invoices"
        />
        <StatCard
          icon={Users} label={t.recentClients} value={String(stats.clientCount)}
          sub={t.totalClients} color="bg-secondary text-secondary-foreground" href="/clients"
        />
        {can('view_revenue') && (
          <StatCard
            icon={AlertCircle} label={t.overdueInvoices}
            value={String(stats.overdueCount)}
            sub={formatCurrency(stats.overdueAmount)} color="bg-destructive/10 text-destructive" href="/invoices"
          />
        )}
        <StatCard
          icon={PackageX} label="Ruptures de stock"
          value={String(outOfStockCount)}
          sub={negativeStockCount > 0 ? `${negativeStockCount} négatif(s) · ${lowStockItems.length} en alerte` : `${lowStockItems.length} en alerte`}
          color="bg-destructive/10 text-destructive" href="/products"
        />
        {can('view_revenue') && (
          <StatCard
            icon={stats.netProfit >= 0 ? TrendingUp : TrendingDown}
            label="Bénéfice Net"
            value={formatCurrency(stats.netProfit)}
            sub={`Charges: ${formatCurrency(stats.totalExpenses)}`}
            color={stats.netProfit >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}
            href="/depenses"
          />
        )}
      </div>

      {/* Commercial document summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/devis">
          <div className="stat-card group animate-fade-in cursor-pointer border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: 'hsl(var(--gold))' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold-foreground flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.pendingQuotes}</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{stats.pendingDevisCount}</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm font-semibold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
              {formatCurrency(stats.pendingDevisAmount)} TTC
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.quotesNotConverted}</p>
          </div>
        </Link>
        <Link to="/bl">
          <div className="stat-card group animate-fade-in cursor-pointer border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: 'hsl(var(--primary))' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.uninvoicedBL}</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{stats.uninvoicedBLCount}</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm font-semibold text-primary tabular-nums">
              {formatCurrency(stats.uninvoicedBLAmount)} HT
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.deliveriesNoInvoice}</p>
          </div>
        </Link>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-card rounded-xl border border-destructive/20 shadow-sm overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 px-6 py-3 bg-destructive/5 border-b border-destructive/20">
            <PackageX className="w-4 h-4 text-destructive" />
            <h2 className="font-semibold text-destructive text-sm">{t.lowStock} — {lowStockItems.length} {t.lowStockProducts}</h2>
          </div>
          <div className="divide-y divide-border">
            {lowStockItems.slice(0, 5).map(p => {
              const stock = p.stock ?? 0;
              const isOut = stock === 0;
              return (
                 <div key={p.id} className="flex items-center justify-between px-6 py-2.5">
                   <div>
                     <p className="text-sm font-medium text-foreground">{p.name}</p>
                     <p className="text-xs text-muted-foreground">{p.reference} — Seuil : {p.minStockThreshold ?? 5}</p>
                   </div>
                   <span className={cn(
                     'text-xs font-bold px-2 py-0.5 rounded-full tabular-nums',
                     stock < 0 ? 'bg-destructive/15 text-destructive font-extrabold' :
                     isOut ? 'bg-destructive/10 text-destructive' : 'bg-orange-100 text-orange-700'
                   )}>
                     {stock < 0 ? `Stock: ${stock}` : isOut ? 'Rupture' : `Stock: ${stock}`}
                   </span>
                 </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue area chart */}
        <div className="lg:col-span-2 stat-card animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">{t.revenueChart}</h2>
            <span className="text-xs text-muted-foreground">{t.last6Months}</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145,63%,22%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(145,63%,22%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(145 15% 88%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(145 20% 45%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(145 20% 45%)' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'CA']}
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(145 15% 88%)', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(145,63%,22%)" strokeWidth={2}
                fill="url(#revGrad)" dot={{ r: 3, fill: 'hsl(145,63%,22%)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie */}
        <div className="stat-card animate-fade-in">
          <h2 className="font-semibold text-foreground mb-4">{t.invoiceStatus}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                dataKey="value" stroke="none">
                {statusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent invoices */}
        <div className="lg:col-span-2 stat-card animate-fade-in p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t.recentInvoicesTitle}
            </h2>
            <Link to="/invoices" className="text-xs text-primary font-medium hover:underline">
              {t.viewAll}
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentInvoices.map(inv => (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{inv.number}</p>
                  <p className="text-xs text-muted-foreground">{inv.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={inv.status} />
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    {formatCurrency(inv.totals.totalTTC)}
                  </p>
                </div>
              </Link>
            ))}
            {recentInvoices.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">{t.noInvoices}</p>
            )}
          </div>
        </div>

        {/* Recent clients */}
        <div className="stat-card animate-fade-in">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {t.recentClients}
          </h2>
          <div className="space-y-3">
            {recentClients.map(client => (
              <Link
                key={client.id}
                to="/clients"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {client.businessName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{client.businessName}</p>
                  <p className="text-xs text-muted-foreground truncate">{client.city}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
