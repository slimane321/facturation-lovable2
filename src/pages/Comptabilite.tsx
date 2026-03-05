import { useMemo, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useDocuments } from '@/contexts/DocumentContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, TrendingDown, Calculator, FileText, ArrowRightLeft, CalendarIcon } from 'lucide-react';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const VAT_RATES = [0, 7, 10, 14, 20];

export default function Comptabilite() {
  const { t } = useLang();
  const { invoices, clients } = useData();
  const { achatsList } = useDocuments();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');

  // Sales: validated + paid + avoir invoices
  const salesInvoices = useMemo(
    () => invoices.filter(i =>
      (i.status === 'validated' || i.status === 'paid' || i.status === 'avoir') &&
      new Date(i.date).getFullYear() === year &&
      (month === 'all' || new Date(i.date).getMonth() === month)
    ),
    [invoices, year, month]
  );

  // Purchases
  const purchases = useMemo(
    () => achatsList.filter(a =>
      new Date(a.date).getFullYear() === year &&
      (month === 'all' || new Date(a.date).getMonth() === month)
    ),
    [achatsList, year, month]
  );

  // Totals
  const salesHT = useMemo(() => salesInvoices.reduce((s, i) => s + i.totals.subtotalHT, 0), [salesInvoices]);
  const salesTVA = useMemo(() => salesInvoices.reduce((s, i) => s + i.totals.totalTVA, 0), [salesInvoices]);
  const salesTTC = useMemo(() => salesInvoices.reduce((s, i) => s + i.totals.totalTTC, 0), [salesInvoices]);

  const purchasesHT = useMemo(() => purchases.reduce((s, a) => s + a.totals.subtotalHT, 0), [purchases]);
  const purchasesTVA = useMemo(() => purchases.reduce((s, a) => s + a.totals.totalTVA, 0), [purchases]);
  const purchasesTTC = useMemo(() => purchases.reduce((s, a) => s + a.totals.totalTTC, 0), [purchases]);

  const tvaNet = salesTVA - purchasesTVA;

  // Monthly chart data (always full year)
  const chartData = useMemo(() => {
    const yearInvoices = invoices.filter(i =>
      (i.status === 'validated' || i.status === 'paid' || i.status === 'avoir') &&
      new Date(i.date).getFullYear() === year
    );
    const yearPurchases = achatsList.filter(a => new Date(a.date).getFullYear() === year);
    return MONTHS_SHORT.map((label, idx) => {
      const mSales = yearInvoices.filter(i => new Date(i.date).getMonth() === idx);
      const mPurchases = yearPurchases.filter(a => new Date(a.date).getMonth() === idx);
      return {
        label,
        tvaCollectee: mSales.reduce((s, i) => s + i.totals.totalTVA, 0),
        tvaRecuperable: mPurchases.reduce((s, a) => s + a.totals.totalTVA, 0),
      };
    });
  }, [invoices, achatsList, year]);

  // Helper: get VAT amount for a specific rate from an invoice's vatBreakdown
  const getVatByRate = (vatBreakdown: Array<{ rate: number; base: number; amount: number }>, rate: number) => {
    const entry = vatBreakdown.find(v => v.rate === rate);
    return entry ? entry.amount : 0;
  };

  // CSV export for accountant — with ICE + TVA per rate
  const handleExportCSV = () => {
    const vatRateHeaders = VAT_RATES.map(r => `TVA ${r}%`);
    const headers = ['Type', 'N° Document', 'Nom Client/Fournisseur', 'ICE', 'Date', 'Total HT', ...vatRateHeaders, 'Total TVA', 'Total TTC', 'N° DGI', 'Signature Numérique'];
    const salesRows = salesInvoices.map(inv => {
      const client = clients.find(c => c.id === inv.clientId);
      const vatCols = VAT_RATES.map(r => getVatByRate(inv.totals.vatBreakdown, r).toFixed(2));
      return [
        inv.status === 'avoir' ? 'Avoir' : 'Vente',
        inv.number,
        client?.businessName || '',
        client?.ice ? `="${client.ice.replace(/[^0-9]/g, '')}"` : '',
        inv.date,
        inv.totals.subtotalHT.toFixed(2),
        ...vatCols,
        inv.totals.totalTVA.toFixed(2),
        inv.totals.totalTTC.toFixed(2),
        inv.dgiRegistrationNumber || '',
        inv.signature ? inv.signature.substring(0, 12).toUpperCase() : '',
      ].join(';');
    });
    const purchaseRows = purchases.map(a => {
      const vatCols = VAT_RATES.map(r => getVatByRate(a.totals.vatBreakdown, r).toFixed(2));
      return [
        'Achat',
        a.supplierInvoiceNumber,
        a.supplierName,
        a.supplierICE ? `="${a.supplierICE.replace(/[^0-9]/g, '')}"` : '',
        a.date,
        a.totals.subtotalHT.toFixed(2),
        ...vatCols,
        a.totals.totalTVA.toFixed(2),
        a.totals.totalTTC.toFixed(2),
      ].join(';');
    });
    const csv = [headers.join(';'), ...salesRows, ...purchaseRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabel = month === 'all' ? year : `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
    a.download = `comptabilite-${periodLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const years = [2024, 2025, 2026, 2027];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comptabilité</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Synthèse TVA collectée / récupérable pour votre comptable
            {month !== 'all' && ` — ${MONTHS_FR[month]} ${year}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <select
              value={month === 'all' ? 'all' : month}
              onChange={e => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">Tous les mois</option>
              {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exporter pour le comptable (CSV)
          </button>
        </div>
      </div>
      <div className="gold-accent-line w-24" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">TVA Collectée</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(salesTVA)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{salesInvoices.length} facture(s)</p>
          </div>
        </div>
        <div className="stat-card flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-destructive/10">
            <TrendingDown className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">TVA Récupérable</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(purchasesTVA)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{purchases.length} achat(s)</p>
          </div>
        </div>
        <div className="stat-card flex items-start gap-4">
          <div className="p-2.5 rounded-xl" style={{ background: 'hsl(var(--gold-light))' }}>
            <Calculator className="w-5 h-5" style={{ color: 'hsl(var(--gold-foreground))' }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">TVA Nette à reverser</p>
            <p className={`text-xl font-bold mt-1 ${tvaNet >= 0 ? 'text-foreground' : 'text-primary'}`}>
              {formatCurrency(Math.abs(tvaNet))}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tvaNet >= 0 ? 'À payer à la DGI' : 'Crédit de TVA'}
            </p>
          </div>
        </div>
        <div className="stat-card flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Marge HT</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(salesHT - purchasesHT)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">CA HT: {formatCurrency(salesHT)}</p>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">
            Récapitulatif {month !== 'all' ? `${MONTHS_FR[month]} ` : 'annuel '}{year}
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catégorie</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total HT</th>
              {VAT_RATES.map(r => (
                <th key={r} className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TVA {r}%</th>
              ))}
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total TVA</th>
              <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <SummaryRow
              label="Ventes (TVA Collectée)"
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
              items={salesInvoices}
              tvaColor="hsl(var(--gold-foreground))"
            />
            <SummaryRow
              label="Achats (TVA Récupérable)"
              icon={<TrendingDown className="w-4 h-4 text-destructive" />}
              items={purchases}
              tvaColor="hsl(var(--destructive))"
              isPurchase
            />
            <tr className="bg-muted/40 font-semibold">
              <td className="px-6 py-3 text-foreground">TVA Nette</td>
              <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(salesHT - purchasesHT)}</td>
              {VAT_RATES.map(r => {
                const salesByRate = salesInvoices.reduce((s, i) => s + getVatByRate(i.totals.vatBreakdown, r), 0);
                const purchByRate = purchases.reduce((s, a) => s + getVatByRate(a.totals.vatBreakdown, r), 0);
                return (
                  <td key={r} className="px-3 py-3 text-right tabular-nums" style={{ color: 'hsl(var(--gold-foreground))' }}>
                    {formatCurrency(salesByRate - purchByRate)}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: 'hsl(var(--gold-foreground))' }}>
                {formatCurrency(tvaNet)}
              </td>
              <td className="px-6 py-3 text-right tabular-nums text-primary">{formatCurrency(salesTTC - purchasesTTC)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">TVA Collectée vs Récupérable — {year}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Évolution mensuelle</p>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(145 20% 45%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(145 20% 45%)' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'tvaCollectee' ? 'TVA Collectée' : 'TVA Récupérable'
                ]}
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(145 15% 88%)', fontSize: 12 }}
              />
              <Bar dataKey="tvaCollectee" name="tvaCollectee" radius={[4, 4, 0, 0]} fill="hsl(43 96% 48%)" />
              <Bar dataKey="tvaRecuperable" name="tvaRecuperable" radius={[4, 4, 0, 0]} fill="hsl(0 72% 51% / 0.6)" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(43 96% 48%)' }} />
              TVA Collectée (Ventes)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(0 72% 51% / 0.6)' }} />
              TVA Récupérable (Achats)
            </span>
          </div>
        </div>
      </div>

      {/* Detail: Sales invoices */}
      <DetailTable
        title="Factures de vente"
        icon={<FileText className="w-4 h-4 text-primary" />}
        count={salesInvoices.length}
        items={salesInvoices.map(inv => {
          const client = clients.find(c => c.id === inv.clientId);
          return {
            id: inv.id,
            number: inv.number,
            name: client?.businessName || '—',
            ice: client?.ice || '—',
            date: inv.date,
            ht: inv.totals.subtotalHT,
            vatBreakdown: inv.totals.vatBreakdown,
            tva: inv.totals.totalTVA,
            ttc: inv.totals.totalTTC,
            isAvoir: inv.status === 'avoir',
          };
        })}
        tvaColorClass="text-gold-foreground"
      />

      {/* Detail: Purchase invoices */}
      <DetailTable
        title="Factures d'achat"
        icon={<FileText className="w-4 h-4 text-destructive" />}
        count={purchases.length}
        items={purchases.map(a => ({
          id: a.id,
          number: a.supplierInvoiceNumber,
          name: a.supplierName,
          ice: a.supplierICE || '—',
          date: a.date,
          ht: a.totals.subtotalHT,
          vatBreakdown: a.totals.vatBreakdown,
          tva: a.totals.totalTVA,
          ttc: a.totals.totalTTC,
          isAvoir: false,
        }))}
        tvaColorClass="text-destructive"
      />
    </div>
  );
}

// ── Helper: summary row ──────────────────────────────
function SummaryRow({ label, icon, items, tvaColor, isPurchase }: {
  label: string;
  icon: React.ReactNode;
  items: Array<{ totals: { subtotalHT: number; totalTVA: number; totalTTC: number; vatBreakdown: Array<{ rate: number; base: number; amount: number }> } }>;
  tvaColor: string;
  isPurchase?: boolean;
}) {
  const ht = items.reduce((s, i) => s + i.totals.subtotalHT, 0);
  const tva = items.reduce((s, i) => s + i.totals.totalTVA, 0);
  const ttc = items.reduce((s, i) => s + i.totals.totalTTC, 0);

  return (
    <tr className="hover:bg-muted/20">
      <td className="px-6 py-3.5 font-semibold text-foreground">
        <div className="flex items-center gap-2">{icon}{label}</div>
      </td>
      <td className="px-4 py-3.5 text-right tabular-nums text-foreground">{formatCurrency(ht)}</td>
      {VAT_RATES.map(r => {
        const amount = items.reduce((s, i) => {
          const entry = i.totals.vatBreakdown.find(v => v.rate === r);
          return s + (entry ? entry.amount : 0);
        }, 0);
        return (
          <td key={r} className="px-3 py-3.5 text-right tabular-nums text-xs" style={{ color: amount > 0 ? tvaColor : undefined }}>
            {amount > 0 ? formatCurrency(amount) : '—'}
          </td>
        );
      })}
      <td className="px-4 py-3.5 text-right tabular-nums font-bold" style={{ color: tvaColor }}>{formatCurrency(tva)}</td>
      <td className="px-6 py-3.5 text-right tabular-nums text-primary font-semibold">{formatCurrency(ttc)}</td>
    </tr>
  );
}

// ── Helper: detail table ──────────────────────────────
interface DetailItem {
  id: string;
  number: string;
  name: string;
  ice: string;
  date: string;
  ht: number;
  vatBreakdown: Array<{ rate: number; base: number; amount: number }>;
  tva: number;
  ttc: number;
  isAvoir: boolean;
}

function DetailTable({ title, icon, count, items, tvaColorClass }: {
  title: string;
  icon: React.ReactNode;
  count: number;
  items: DetailItem[];
  tvaColorClass: string;
}) {
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-foreground">{title}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{count} document(s)</span>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">N° Document</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Client / Fournisseur</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">ICE</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">HT</th>
              {VAT_RATES.map(r => (
                <th key={r} className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground">TVA {r}%</th>
              ))}
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Total TVA</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr><td colSpan={5 + VAT_RATES.length + 2} className="px-4 py-8 text-center text-muted-foreground">Aucun document</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-muted/20">
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(item.date).toLocaleDateString('fr-MA')}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {item.isAvoir && <span className="text-destructive">-</span>}
                  {item.number}
                </td>
                <td className="px-3 py-2 text-xs">{item.name}</td>
                <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{item.ice}</td>
                <td className="px-3 py-2 text-right tabular-nums text-xs">{formatCurrency(item.ht)}</td>
                {VAT_RATES.map(r => {
                  const entry = item.vatBreakdown.find(v => v.rate === r);
                  return (
                    <td key={r} className="px-2 py-2 text-right tabular-nums text-xs text-muted-foreground">
                      {entry && entry.amount > 0 ? formatCurrency(entry.amount) : '—'}
                    </td>
                  );
                })}
                <td className={`px-3 py-2 text-right tabular-nums text-xs font-semibold ${tvaColorClass}`}>
                  {formatCurrency(item.tva)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs font-bold text-primary">
                  {formatCurrency(item.ttc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
