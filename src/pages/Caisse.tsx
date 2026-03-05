import { useMemo, useState, useEffect } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { useExpenses, type Expense } from '@/pages/Depenses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Banknote, TrendingUp, TrendingDown, Search, Receipt, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface CashEntry {
  id: string;
  date: string;
  type: 'in' | 'out';
  amount: number;
  label: string;
  reference?: string;
  linkedId?: string;
  linkedType?: 'invoice' | 'expense';
}

export default function Caisse() {
  const { t } = useLang();
  const { invoices, clients } = useData();
  const allExpenses = useExpenses();
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all');

  // Cash IN: payments in "Espèces" from invoices
  const cashInEntries = useMemo<CashEntry[]>(() => {
    const entries: CashEntry[] = [];
    invoices.forEach(inv => {
      const client = clients.find(c => c.id === inv.clientId);
      (inv.payments || []).forEach(p => {
        const m = p.method?.toLowerCase() || '';
        if (m.includes('espèce') || m.includes('cash') || m === 'especes') {
          entries.push({
            id: p.id,
            date: p.date,
            type: 'in',
            amount: p.amount,
            label: `${client?.businessName || 'Client'} — ${inv.number}`,
            reference: p.reference,
            linkedId: inv.id,
            linkedType: 'invoice',
          });
        }
      });
    });
    return entries;
  }, [invoices, clients]);

  // Cash OUT: expenses paid in "Espèces"
  const cashOutEntries = useMemo<CashEntry[]>(() => {
    return allExpenses
      .filter(e => {
        const m = e.paymentMethod?.toLowerCase() || '';
        return m.includes('espèce') || m.includes('cash') || m === 'especes';
      })
      .map(e => ({
        id: e.id,
        date: e.date,
        type: 'out' as const,
        amount: e.amount,
        label: `${e.category} — ${e.description}`,
        reference: e.reference,
        linkedId: e.id,
        linkedType: 'expense' as const,
      }));
  }, [allExpenses]);

  // All entries merged and filtered
  const allEntries = useMemo(() => {
    const merged = [...cashInEntries, ...cashOutEntries];
    return merged
      .filter(e => {
        const d = new Date(e.date);
        if (d.getFullYear() !== filterYear) return false;
        if (filterMonth !== 'all' && d.getMonth() !== filterMonth) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!e.label.toLowerCase().includes(q) && !(e.reference || '').toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [cashInEntries, cashOutEntries, filterYear, filterMonth, search]);

  const totalCashIn = useMemo(() => allEntries.filter(e => e.type === 'in').reduce((s, e) => s + e.amount, 0), [allEntries]);
  const totalCashOut = useMemo(() => allEntries.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0), [allEntries]);
  const solde = totalCashIn - totalCashOut;

  // Timbre entries from validated cash invoices
  const timbreInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if ((inv.totals.timbreAmount || 0) <= 0) return false;
      if (inv.status !== 'validated' && inv.status !== 'paid') return false;
      const d = new Date(inv.date);
      if (d.getFullYear() !== filterYear) return false;
      if (filterMonth !== 'all' && d.getMonth() !== filterMonth) return false;
      return true;
    });
  }, [invoices, filterYear, filterMonth]);

  const totalTimbre = useMemo(() => timbreInvoices.reduce((s, inv) => s + (inv.totals.timbreAmount || 0), 0), [timbreInvoices]);

  // Running balance for ledger
  const ledgerWithBalance = useMemo(() => {
    const sorted = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));
    let balance = 0;
    const result = sorted.map(e => {
      balance += e.type === 'in' ? e.amount : -e.amount;
      return { ...e, runningBalance: balance };
    });
    return result.reverse();
  }, [allEntries]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Caisse & Trésorerie</h1>
        <p className="text-sm text-muted-foreground">Suivi en temps réel des flux espèces et droits de timbre</p>
      </div>
      <div className="gold-accent-line w-24" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <ArrowDownLeft className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Entrées Espèces</p>
                <p className="text-xl font-bold text-primary mt-0.5 tabular-nums">{formatCurrency(totalCashIn)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10">
                <ArrowUpRight className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sorties Espèces</p>
                <p className="text-xl font-bold text-destructive mt-0.5 tabular-nums">{formatCurrency(totalCashOut)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: solde >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-muted">
                <Wallet className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Solde Caisse</p>
                <p className={`text-xl font-bold mt-0.5 tabular-nums ${solde >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(solde)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--gold))' }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gold/15">
                <Receipt className="w-5 h-5" style={{ color: 'hsl(var(--gold-foreground))' }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Droits de Timbre</p>
                <p className="text-xl font-bold mt-0.5 tabular-nums" style={{ color: 'hsl(var(--gold-foreground))' }}>
                  {formatCurrency(totalTimbre)}
                </p>
                <p className="text-[10px] text-muted-foreground">Passif DGI (0.25%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth === 'all' ? '' : filterMonth} onChange={e => setFilterMonth(e.target.value === '' ? 'all' : Number(e.target.value))} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          <option value="">Tous les mois</option>
          {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'].map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ledger">Journal de Caisse</TabsTrigger>
          <TabsTrigger value="timbre">Registre Droits de Timbre</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Livre de Caisse — {allEntries.length} opérations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead className="text-right">Entrée</TableHead>
                    <TableHead className="text-right">Sortie</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerWithBalance.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Aucun mouvement espèces pour cette période</TableCell></TableRow>
                  ) : ledgerWithBalance.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="tabular-nums text-muted-foreground">{new Date(e.date).toLocaleDateString('fr-MA')}</TableCell>
                      <TableCell>
                        {e.type === 'in' ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                            <ArrowDownLeft className="w-3 h-3 mr-1" /> Entrée
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15">
                            <ArrowUpRight className="w-3 h-3 mr-1" /> Sortie
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground max-w-[200px] truncate">
                        {e.linkedType === 'invoice' && e.linkedId ? (
                          <Link to={`/invoices/${e.linkedId}`} className="text-primary hover:underline">{e.label}</Link>
                        ) : e.label}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{e.reference || '—'}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-primary">
                        {e.type === 'in' ? formatCurrency(e.amount) : ''}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-destructive">
                        {e.type === 'out' ? formatCurrency(e.amount) : ''}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${e.runningBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                        {formatCurrency(e.runningBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timbre">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Registre Droits de Timbre — Passif DGI</CardTitle>
                <Badge variant="outline" className="text-xs" style={{ borderColor: 'hsl(var(--gold))', color: 'hsl(var(--gold-foreground))' }}>
                  Total: {formatCurrency(totalTimbre)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-right">Timbre (0.25%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timbreInvoices.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Aucun droit de timbre pour cette période</TableCell></TableRow>
                  ) : timbreInvoices.map(inv => {
                    const client = clients.find(c => c.id === inv.clientId);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <Link to={`/invoices/${inv.id}`} className="text-primary hover:underline font-medium">{inv.number}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{client?.businessName || '—'}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{new Date(inv.date).toLocaleDateString('fr-MA')}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(inv.totals.totalTTC)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums" style={{ color: 'hsl(var(--gold-foreground))' }}>
                          {formatCurrency(inv.totals.timbreAmount || 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
