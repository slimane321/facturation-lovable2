import { useMemo, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useDocuments } from '@/contexts/DocumentContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useExpenses } from '@/pages/Depenses';
import { formatCurrency } from '@/lib/moroccanUtils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Download, TrendingUp, TrendingDown, Receipt, Calculator, ArrowRightLeft, FileCode, DollarSign, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const QUARTERS = ['T1 (Jan–Mar)', 'T2 (Avr–Jun)', 'T3 (Jul–Sep)', 'T4 (Oct–Déc)'];
const VAT_COLORS: Record<number, string> = { 0: 'hsl(145 15% 55%)', 7: 'hsl(43 96% 48%)', 10: 'hsl(200 80% 45%)', 14: 'hsl(270 60% 50%)', 20: 'hsl(145 63% 22%)' };
const PIE_COLORS = ['hsl(145,63%,22%)', 'hsl(43,96%,48%)', 'hsl(200,80%,45%)', 'hsl(270,60%,50%)', 'hsl(0,72%,51%)', 'hsl(145,55%,50%)', 'hsl(30,80%,50%)'];

type Period = 'monthly' | 'quarterly';

export default function Reports() {
  const { t, lang } = useLang();
  const { invoices, clients } = useData();
  const { achatsList } = useDocuments();
  const { settings } = useSettings();
  const allExpenses = useExpenses();
  const [period, setPeriod] = useState<Period>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const years = [2024, 2025, 2026, 2027];

  // Taxable invoices
  const taxableInvoices = useMemo(
    () => invoices.filter(i => (i.status === 'validated' || i.status === 'paid' || i.status === 'avoir') && new Date(i.date).getFullYear() === year),
    [invoices, year]
  );

  const purchases = useMemo(() => achatsList.filter(a => new Date(a.date).getFullYear() === year), [achatsList, year]);
  const yearExpenses = useMemo(() => allExpenses.filter(e => new Date(e.date).getFullYear() === year), [allExpenses, year]);

  // Totals
  const totalHT = useMemo(() => taxableInvoices.reduce((s, i) => s + i.totals.subtotalHT, 0), [taxableInvoices]);
  const totalTVA = useMemo(() => taxableInvoices.reduce((s, i) => s + i.totals.totalTVA, 0), [taxableInvoices]);
  const totalTTC = useMemo(() => taxableInvoices.reduce((s, i) => s + i.totals.totalTTC, 0), [taxableInvoices]);
  const purchasesHT = useMemo(() => purchases.reduce((s, a) => s + a.totals.subtotalHT, 0), [purchases]);
  const purchasesTVA = useMemo(() => purchases.reduce((s, a) => s + a.totals.totalTVA, 0), [purchases]);
  const tvaNet = totalTVA - purchasesTVA;

  // Expenses totals
  const expensesTotalTTC = useMemo(() => yearExpenses.reduce((s, e) => s + e.amount, 0), [yearExpenses]);
  const expensesTVA = useMemo(() => yearExpenses.reduce((s, e) => s + e.tvaAmount, 0), [yearExpenses]);
  const expensesHT = expensesTotalTTC - expensesTVA;

  // P&L
  const netProfit = totalHT - expensesHT - purchasesHT;
  const totalTVADeductible = purchasesTVA + expensesTVA;
  const tvaPosition = totalTVA - totalTVADeductible;

  // VAT breakdown
  const vatByRate = useMemo(() => {
    const map: Record<number, { baseHT: number; tva: number }> = {};
    for (const inv of taxableInvoices) {
      for (const entry of inv.totals.vatBreakdown) {
        if (!map[entry.rate]) map[entry.rate] = { baseHT: 0, tva: 0 };
        map[entry.rate].baseHT += entry.base;
        map[entry.rate].tva += entry.amount;
      }
    }
    return Object.entries(map).map(([rate, v]) => ({ rate: Number(rate), ...v })).sort((a, b) => a.rate - b.rate);
  }, [taxableInvoices]);

  // P&L monthly chart
  const plChartData = useMemo(() => {
    return MONTHS_FR.map((label, idx) => {
      const monthInvoices = taxableInvoices.filter(i => new Date(i.date).getMonth() === idx);
      const monthExpenses = yearExpenses.filter(e => new Date(e.date).getMonth() === idx);
      const monthPurchases = purchases.filter(a => new Date(a.date).getMonth() === idx);
      const revenue = monthInvoices.reduce((s, i) => s + i.totals.subtotalHT, 0);
      const charges = monthExpenses.reduce((s, e) => s + (e.amount - e.tvaAmount), 0) + monthPurchases.reduce((s, a) => s + a.totals.subtotalHT, 0);
      return { label, revenue, charges, profit: revenue - charges };
    });
  }, [taxableInvoices, yearExpenses, purchases]);

  // Expense pie
  const expensePieData = useMemo(() => {
    const map: Record<string, number> = {};
    yearExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [yearExpenses]);

  // TVA chart
  const tvaChartData = useMemo(() => {
    if (period === 'monthly') {
      return MONTHS_FR.map((label, idx) => {
        const monthInvoices = taxableInvoices.filter(i => new Date(i.date).getMonth() === idx);
        const monthPurchases = purchases.filter(a => new Date(a.date).getMonth() === idx);
        const monthExpenses = yearExpenses.filter(e => new Date(e.date).getMonth() === idx);
        const tvaCollectee = monthInvoices.reduce((s, i) => s + i.totals.totalTVA, 0);
        const tvaDeductible = monthPurchases.reduce((s, a) => s + a.totals.totalTVA, 0) + monthExpenses.reduce((s, e) => s + e.tvaAmount, 0);
        return { label, tvaCollectee, tvaDeductible, tvaNet: tvaCollectee - tvaDeductible };
      });
    } else {
      return QUARTERS.map((label, qi) => {
        const qMonths = [0, 1, 2].map(m => qi * 3 + m);
        const qInvoices = taxableInvoices.filter(i => qMonths.includes(new Date(i.date).getMonth()));
        const qPurchases = purchases.filter(a => qMonths.includes(new Date(a.date).getMonth()));
        const qExpenses = yearExpenses.filter(e => qMonths.includes(new Date(e.date).getMonth()));
        const tvaCollectee = qInvoices.reduce((s, i) => s + i.totals.totalTVA, 0);
        const tvaDeductible = qPurchases.reduce((s, a) => s + a.totals.totalTVA, 0) + qExpenses.reduce((s, e) => s + e.tvaAmount, 0);
        return { label, tvaCollectee, tvaDeductible, tvaNet: tvaCollectee - tvaDeductible };
      });
    }
  }, [taxableInvoices, purchases, yearExpenses, period]);

  // CSV exports
  const handleExportCSV = () => {
    const headers = ['N° Facture', 'Client', 'Date', 'HT', 'TVA', 'TTC', 'Statut'];
    const rows = taxableInvoices.map(inv => {
      const client = clients.find(c => c.id === inv.clientId);
      return [inv.number, client?.businessName || '', inv.date, inv.totals.subtotalHT.toFixed(2), inv.totals.totalTVA.toFixed(2), inv.totals.totalTTC.toFixed(2), inv.status].join(';');
    });
    const blob = new Blob(['\uFEFF' + [headers.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rapport-tva-${year}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const handleExportEDI = () => {
    const monthlyData = Array.from({ length: 12 }, (_, idx) => {
      const mInv = taxableInvoices.filter(i => new Date(i.date).getMonth() === idx);
      const mPur = purchases.filter(a => new Date(a.date).getMonth() === idx);
      return { month: idx + 1, caHT: mInv.reduce((s, i) => s + i.totals.subtotalHT, 0), tvaCollectee: mInv.reduce((s, i) => s + i.totals.totalTVA, 0), tvaRecuperable: mPur.reduce((s, a) => s + a.totals.totalTVA, 0), tvaNet: mInv.reduce((s, i) => s + i.totals.totalTVA, 0) - mPur.reduce((s, a) => s + a.totals.totalTVA, 0) };
    });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DeclarationTVA xmlns="urn:dgi:simpl-tva:1.0">
  <Identifiant><ICE>${settings.ice}</ICE><IF>${settings.ifNumber}</IF><RaisonSociale>${settings.name}</RaisonSociale><Exercice>${year}</Exercice></Identifiant>
  <Resume><TotalCAHT>${totalHT.toFixed(2)}</TotalCAHT><TotalTVACollectee>${totalTVA.toFixed(2)}</TotalTVACollectee><TotalTVARecuperable>${purchasesTVA.toFixed(2)}</TotalTVARecuperable><TVANette>${tvaNet.toFixed(2)}</TVANette></Resume>
  <DetailMensuel>${monthlyData.map(m => `<Mois numero="${m.month}"><CAHT>${m.caHT.toFixed(2)}</CAHT><TVACollectee>${m.tvaCollectee.toFixed(2)}</TVACollectee><TVARecuperable>${m.tvaRecuperable.toFixed(2)}</TVARecuperable><TVANette>${m.tvaNet.toFixed(2)}</TVANette></Mois>`).join('')}</DetailMensuel>
  <DetailParTaux>${vatByRate.map(v => `<Taux valeur="${v.rate}"><BaseHT>${v.baseHT.toFixed(2)}</BaseHT><MontantTVA>${v.tva.toFixed(2)}</MontantTVA></Taux>`).join('')}</DetailParTaux>
</DeclarationTVA>`;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `EDI-TVA-SIMPL-${year}.xml`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.reports}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Intelligence financière & conformité fiscale</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleExportEDI} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-semibold hover:bg-secondary/80 transition-colors shadow-sm">
            <FileCode className="w-4 h-4" /> EDI-TVA
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> {t.exportCSV}
          </button>
        </div>
      </div>
      <div className="gold-accent-line w-24" />

      <Tabs defaultValue="pnl" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pnl">Compte de Résultat</TabsTrigger>
          <TabsTrigger value="tva">Rapport TVA</TabsTrigger>
          <TabsTrigger value="detail">Détail Facturation</TabsTrigger>
        </TabsList>

        {/* P&L Tab */}
        <TabsContent value="pnl" className="space-y-6">
          {/* P&L KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card><CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><TrendingUp className="w-5 h-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CA Ventes HT</p><p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(totalHT)}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10"><TrendingDown className="w-5 h-5 text-destructive" /></div>
              <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Achats HT</p><p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(purchasesHT)}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10"><Wallet className="w-5 h-5 text-destructive" /></div>
              <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Charges HT</p><p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(expensesHT)}</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'hsl(var(--gold-light))' }}><Calculator className="w-5 h-5" style={{ color: 'hsl(var(--gold-foreground))' }} /></div>
              <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Marge Brute HT</p><p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(totalHT - purchasesHT)}</p></div>
            </CardContent></Card>
            <Card className={netProfit >= 0 ? 'border-primary/30' : 'border-destructive/30'}>
              <CardContent className="pt-5 pb-4 flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${netProfit >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                  <DollarSign className={`w-5 h-5 ${netProfit >= 0 ? 'text-primary' : 'text-destructive'}`} />
                </div>
                <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Bénéfice Net</p><p className={`text-xl font-bold mt-0.5 ${netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(netProfit)}</p></div>
              </CardContent>
            </Card>
          </div>

          {/* P&L Chart + Expense Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-foreground mb-4">Revenus vs Charges (HT) — {year}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={plChartData} barGap={2}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(145 20% 45%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(145 20% 45%)' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenus HT" radius={[4, 4, 0, 0]} fill="hsl(145 63% 22% / 0.6)" />
                  <Bar dataKey="charges" name="Charges HT" radius={[4, 4, 0, 0]} fill="hsl(0 72% 51% / 0.5)" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(145 63% 22% / 0.6)' }} /> Revenus HT</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(0 72% 51% / 0.5)' }} /> Charges HT</span>
              </div>
            </div>
            <div className="bg-card rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-foreground mb-4">Distribution des Charges</h3>
              {expensePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" stroke="none">
                      {expensePieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Aucune dépense enregistrée</p>}
            </div>
          </div>
        </TabsContent>

        {/* TVA Tab */}
        <TabsContent value="tva" className="space-y-6">
          {/* TVA KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'hsl(var(--gold-light))' }}><Calculator className="w-5 h-5" style={{ color: 'hsl(var(--gold-foreground))' }} /></div>
              <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">TVA Collectée</p><p className="text-xl font-bold mt-0.5">{formatCurrency(totalTVA)}</p><p className="text-xs text-muted-foreground">{taxableInvoices.length} factures</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10"><TrendingDown className="w-5 h-5 text-destructive" /></div>
              <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">TVA Déductible</p><p className="text-xl font-bold mt-0.5">{formatCurrency(totalTVADeductible)}</p><p className="text-xs text-muted-foreground">Achats: {formatCurrency(purchasesTVA)} + Charges: {formatCurrency(expensesTVA)}</p></div>
            </CardContent></Card>
            <Card className={tvaPosition >= 0 ? 'border-primary/30' : 'border-destructive/30'}>
              <CardContent className="pt-5 pb-4 flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10"><ArrowRightLeft className="w-5 h-5 text-primary" /></div>
                <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Position TVA Nette</p><p className={`text-xl font-bold mt-0.5 ${tvaPosition >= 0 ? 'text-foreground' : 'text-primary'}`}>{formatCurrency(Math.abs(tvaPosition))}</p><p className="text-xs text-muted-foreground">{tvaPosition >= 0 ? 'À reverser au Trésor' : 'Crédit TVA reportable'}</p></div>
              </CardContent>
            </Card>
            <Card><CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><Receipt className="w-5 h-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t.totalTTC}</p><p className="text-xl font-bold mt-0.5">{formatCurrency(totalTTC)}</p></div>
            </CardContent></Card>
          </div>

          {/* VAT by Rate table */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{t.vatBreakdown}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ventilation par taux de TVA — Ventes</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.vatRate}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base HT</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TVA</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vatByRate.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">{t.noResults}</td></tr>
                ) : vatByRate.map(({ rate, baseHT, tva }) => (
                  <tr key={rate} className="hover:bg-muted/20">
                    <td className="px-6 py-3.5"><div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: VAT_COLORS[rate] ?? 'hsl(var(--primary))' }} /><span className="font-semibold text-foreground">TVA {rate}%</span></div></td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{formatCurrency(baseHT)}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums font-bold" style={{ color: 'hsl(var(--gold-foreground))' }}>{formatCurrency(tva)}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums text-primary font-semibold">{formatCurrency(baseHT + tva)}</td>
                  </tr>
                ))}
                {vatByRate.length > 0 && (
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-6 py-3">{t.total}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{formatCurrency(totalHT)}</td>
                    <td className="px-6 py-3 text-right tabular-nums font-bold" style={{ color: 'hsl(var(--gold-foreground))' }}>{formatCurrency(totalTVA)}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-primary">{formatCurrency(totalTTC)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TVA Chart */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">TVA Collectée vs TVA Déductible — {year}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Évolution {period === 'monthly' ? 'mensuelle' : 'trimestrielle'}</p>
              </div>
              <div className="flex gap-1.5">
                {(['monthly', 'quarterly'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    {p === 'monthly' ? t.monthly : t.quarterly}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={tvaChartData} barGap={4}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(145 20% 45%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(145 20% 45%)' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name === 'tvaCollectee' ? 'TVA Collectée' : name === 'tvaDeductible' ? 'TVA Déductible' : 'TVA Nette']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="tvaCollectee" name="tvaCollectee" radius={[4, 4, 0, 0]} fill="hsl(43 96% 48% / 0.7)" />
                  <Bar dataKey="tvaDeductible" name="tvaDeductible" radius={[4, 4, 0, 0]} fill="hsl(0 72% 51% / 0.5)" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(43 96% 48% / 0.7)' }} /> TVA Collectée</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(0 72% 51% / 0.5)' }} /> TVA Déductible</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Detail Tab */}
        <TabsContent value="detail" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{t.totalHT}</p><p className="text-xl font-bold mt-1">{formatCurrency(totalHT)}</p><p className="text-xs text-muted-foreground">{taxableInvoices.length} factures</p></CardContent></Card>
            <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">TVA Collectée</p><p className="text-xl font-bold mt-1" style={{ color: 'hsl(var(--gold-foreground))' }}>{formatCurrency(totalTVA)}</p></CardContent></Card>
            <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">TVA Achats</p><p className="text-xl font-bold mt-1">{formatCurrency(purchasesTVA)}</p><p className="text-xs text-muted-foreground">{purchases.length} achats</p></CardContent></Card>
            <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">TVA Charges</p><p className="text-xl font-bold mt-1">{formatCurrency(expensesTVA)}</p><p className="text-xs text-muted-foreground">{yearExpenses.length} dépenses</p></CardContent></Card>
            <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{t.totalTTC}</p><p className="text-xl font-bold text-primary mt-1">{formatCurrency(totalTTC)}</p></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
