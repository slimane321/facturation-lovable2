import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { useAudit } from '@/contexts/AuditContext';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Download, Receipt } from 'lucide-react';
import { api } from '@/integrations/api/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  tvaAmount: number;
  paymentMethod: string;
  reference?: string;
}

const CATEGORIES = ['Loyer', 'Salaires', 'Électricité', 'Eau', 'Internet / Télécom', 'Fournitures', 'Transport', 'Assurance', 'Impôts & Taxes', 'Maintenance', 'Marketing', 'Achat de Stock', 'Autre'];
const PIE_COLORS = ['hsl(145,63%,22%)', 'hsl(43,96%,48%)', 'hsl(200,80%,45%)', 'hsl(270,60%,50%)', 'hsl(0,72%,51%)', 'hsl(145,55%,50%)', 'hsl(30,80%,50%)', 'hsl(180,60%,40%)', 'hsl(320,60%,50%)', 'hsl(60,70%,45%)', 'hsl(100,50%,40%)', 'hsl(210,70%,55%)', 'hsl(0,0%,50%)'];

function dbToApp(row: any): Expense {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    description: row.description || '',
    amount: Number(row.amount),
    tvaAmount: Number(row.tvaAmount || 0),
    paymentMethod: row.paymentMethod || 'Virement',
    reference: row.reference || undefined,
  };
}

export function useExpenses(): Expense[] {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  useEffect(() => {
    api.get<any[]>('/expenses')
  .then(data => setExpenses((data || []).map(dbToApp)))
  .catch(() => setExpenses([]));
  }, []);
  return expenses;
}

export default function Depenses() {
  const { t } = useLang();
  const { log: auditLog } = useAudit();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState('');

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: CATEGORIES[0],
    description: '',
    amountTTC: '',
    tvaRate: '20',
    paymentMethod: 'Virement',
    reference: '',
  });

  const fetchExpenses = useCallback(async () => {
    try {
  const data = await api.get<any[]>('/expenses');
  setExpenses((data || []).map(dbToApp));
} catch {
  setExpenses([]);
}
    setLoading(false);
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleAdd = async () => {
    if (!form.description.trim() || !form.amountTTC) return;
    const amountTTC = parseFloat(form.amountTTC) || 0;
    const tvaRate = parseFloat(form.tvaRate) || 0;
    const tvaAmount = amountTTC - (amountTTC / (1 + tvaRate / 100));
    const newRow = {
  date: form.date,
  category: form.category,
  description: form.description,
  amount: amountTTC,
  tvaAmount: Math.round(tvaAmount * 100) / 100,
  paymentMethod: form.paymentMethod,
  reference: form.reference || null,
};
    const tempId = `temp_${Date.now()}`;
    const optimistic: Expense = {
      id: tempId, date: form.date, category: form.category, description: form.description,
      amount: amountTTC, tvaAmount: Math.round(tvaAmount * 100) / 100,
      paymentMethod: form.paymentMethod, reference: form.reference || undefined,
    };
    setExpenses(prev => [optimistic, ...prev]);
    setForm({ date: new Date().toISOString().split('T')[0], category: CATEGORIES[0], description: '', amountTTC: '', tvaRate: '20', paymentMethod: 'Virement', reference: '' });
    setShowForm(false);
    toast({ title: 'Dépense ajoutée ✓' });

    auditLog({ action: 'Création dépense', documentType: 'Dépense', documentId: tempId, details: `${form.category}: ${form.description} — ${amountTTC} MAD` });

    try {
  const created = await api.post<any>('/expenses', newRow);
  setExpenses(prev => prev.map(e => e.id === tempId ? dbToApp(created) : e));
} catch (err: any) {
  setExpenses(prev => prev.filter(e => e.id !== tempId));
  toast({ title: 'Erreur', description: err?.message || "Impossible d'ajouter la dépense", variant: 'destructive' });
}
  };

  const handleDelete = async (id: string) => {
    const prev = expenses;
    const deleted = expenses.find(e => e.id === id);
    setExpenses(expenses.filter(e => e.id !== id));
    toast({ title: 'Dépense supprimée' });
    auditLog({ action: 'Suppression dépense', documentType: 'Dépense', documentId: id, details: deleted ? `${deleted.category}: ${deleted.description}` : '' });
    try {
  await api.del(`/expenses/${id}`);
} catch (err: any) {
  setExpenses(prev);
  toast({ title: 'Erreur', description: err?.message || 'Impossible de supprimer', variant: 'destructive' });
}
  };

  const filtered = useMemo(() => expenses.filter(e => {
    const d = new Date(e.date);
    if (d.getFullYear() !== filterYear) return false;
    if (filterMonth !== 'all' && d.getMonth() !== filterMonth) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date)), [expenses, filterYear, filterMonth, filterCategory]);

  const totalFiltered = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);
  const totalTVA = useMemo(() => filtered.reduce((s, e) => s + e.tvaAmount, 0), [filtered]);
  const totalHT = totalFiltered - totalTVA;

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const pieData = useMemo(() => byCategory.map(([name, value]) => ({ name, value })), [byCategory]);

  const handleExport = () => {
    const rows = [['Date', 'Catégorie', 'Description', 'Montant TTC', 'TVA', 'HT', 'Méthode', 'Référence'].join(';')];
    filtered.forEach(e => rows.push([e.date, e.category, `"${e.description}"`, e.amount.toFixed(2), e.tvaAmount.toFixed(2), (e.amount - e.tvaAmount).toFixed(2), e.paymentMethod, e.reference || ''].join(';')));
    rows.push(['', '', 'TOTAL', totalFiltered.toFixed(2), totalTVA.toFixed(2), totalHT.toFixed(2), '', ''].join(';'));
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `depenses_${filterYear}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export CSV terminé ✓' });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dépenses & Charges</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Suivi des charges d'exploitation avec TVA déductible</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nouvelle dépense
          </button>
        </div>
      </div>
      <div className="gold-accent-line w-24" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth === 'all' ? '' : filterMonth} onChange={e => setFilterMonth(e.target.value === '' ? 'all' : Number(e.target.value))} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          <option value="">Tous les mois</option>
          {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'].map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
          <option value="">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border shadow-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total TTC</p>
          <p className="text-2xl font-bold text-destructive mt-1 tabular-nums">{formatCurrency(totalFiltered)}</p>
        </div>
        <div className="bg-card rounded-xl border shadow-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TVA Déductible</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{formatCurrency(totalTVA)}</p>
        </div>
        <div className="bg-card rounded-xl border shadow-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total HT</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{formatCurrency(totalHT)}</p>
        </div>
        <div className="bg-card rounded-xl border shadow-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nb. Opérations</p>
          <p className="text-2xl font-bold text-foreground mt-1">{filtered.length}</p>
        </div>
      </div>

      {/* Category breakdown: bar + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {byCategory.length > 0 && (
          <div className="bg-card rounded-xl border shadow-card p-5 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Répartition par catégorie</h3>
            {byCategory.map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-36 truncate">{cat}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-destructive/60" style={{ width: `${(amount / totalFiltered) * 100}%` }} />
                </div>
                <span className="text-sm font-semibold tabular-nums w-28 text-right">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        )}
        {pieData.length > 0 && (
          <div className="bg-card rounded-xl border shadow-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-2">Distribution des charges</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" stroke="none">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
              <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Catégorie</th>
              <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Description</th>
              <th className="text-right px-3 py-3 font-semibold text-muted-foreground">TVA</th>
              <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Montant TTC</th>
              <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Méthode</th>
              <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Aucune dépense enregistrée pour cette période</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{new Date(e.date).toLocaleDateString('fr-MA')}</td>
                <td className="px-3 py-3"><span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">{e.category}</span></td>
                <td className="px-3 py-3 text-foreground">{e.description}</td>
                <td className="px-3 py-3 text-right tabular-nums text-primary font-medium">{formatCurrency(e.tvaAmount)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-destructive">{formatCurrency(e.amount)}</td>
                <td className="px-3 py-3 text-center text-xs text-muted-foreground">{e.paymentMethod}</td>
                <td className="px-3 py-3 text-center">
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl border shadow-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Receipt className="w-5 h-5 text-primary" /> Nouvelle dépense</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Catégorie</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Description *</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Loyer bureau janvier" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Montant TTC *</label>
                <input type="number" min="0" step="0.01" value={form.amountTTC} onChange={e => setForm(p => ({ ...p, amountTTC: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-right" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Taux TVA %</label>
                <select value={form.tvaRate} onChange={e => setForm(p => ({ ...p, tvaRate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  {['0', '7', '10', '14', '20'].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Méthode</label>
                <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  {['Espèces', 'Virement', 'Chèque', 'Effet'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {form.amountTTC && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 flex justify-between">
                <span>HT: {formatCurrency((parseFloat(form.amountTTC) || 0) / (1 + (parseFloat(form.tvaRate) || 0) / 100))}</span>
                <span>TVA: {formatCurrency((parseFloat(form.amountTTC) || 0) - (parseFloat(form.amountTTC) || 0) / (1 + (parseFloat(form.tvaRate) || 0) / 100))}</span>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Référence (optionnel)</label>
              <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="N° facture fournisseur..." className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleAdd} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
