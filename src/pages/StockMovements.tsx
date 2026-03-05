import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import type { StockMovementType } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import {
  ArrowDown, ArrowUp, RotateCcw, Wrench, Download, Filter,
  Package, Calendar, Search, FileText, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const OP_CONFIG: Record<StockMovementType, { label: string; icon: React.FC<{ className?: string }>; cls: string }> = {
  sale:     { label: 'Sortie Vente',     icon: ArrowDown,  cls: 'text-destructive' },
  purchase: { label: 'Entrée Achat',     icon: ArrowUp,    cls: 'text-primary' },
  return:   { label: 'Retour Avoir',     icon: RotateCcw,  cls: 'text-orange-600' },
  manual:   { label: 'Ajustement Manuel', icon: Wrench,    cls: 'text-muted-foreground' },
};

const OP_FILTERS: { key: StockMovementType | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'purchase', label: 'Entrées Achat' },
  { key: 'sale', label: 'Sorties Vente' },
  { key: 'return', label: 'Retours Avoir' },
  { key: 'manual', label: 'Ajustements' },
];

function docLink(ref?: string) {
  if (!ref) return null;
  if (ref.startsWith('FA-') || ref.startsWith('AV-'))
    return <Link to="/invoices" className="text-primary hover:underline text-xs font-semibold">{ref}</Link>;
  if (ref.startsWith('BL-'))
    return <Link to="/bl" className="text-primary hover:underline text-xs font-semibold">{ref}</Link>;
  if (ref.startsWith('ACH-'))
    return <Link to="/achats" className="text-primary hover:underline text-xs font-semibold">{ref}</Link>;
  return <span className="text-xs text-muted-foreground">{ref}</span>;
}

export default function StockMovements() {
  const { stockMovements, products } = useData();
  const [searchParams] = useSearchParams();
  const preFilterProduct = searchParams.get('product') || '';

  const [productFilter, setProductFilter] = useState(preFilterProduct);
  const [opFilter, setOpFilter] = useState<StockMovementType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const productMap = useMemo(() => {
    const map = new Map<string, { name: string; reference: string }>();
    products.forEach(p => map.set(p.id, { name: p.name, reference: p.reference }));
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...stockMovements].sort((a, b) => b.date.localeCompare(a.date));

    if (productFilter) {
      list = list.filter(m => m.productId === productFilter);
    }

    if (opFilter !== 'all') {
      list = list.filter(m => m.type === opFilter);
    }

    if (dateFrom) {
      list = list.filter(m => m.date >= dateFrom);
    }
    if (dateTo) {
      const end = dateTo + 'T23:59:59';
      list = list.filter(m => m.date <= end);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m => {
        const p = productMap.get(m.productId);
        return (
          p?.name.toLowerCase().includes(q) ||
          p?.reference.toLowerCase().includes(q) ||
          m.documentRef?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [stockMovements, productFilter, opFilter, dateFrom, dateTo, search, productMap]);

  // Stats
  const stats = useMemo(() => {
    const totalIn = filtered.filter(m => m.quantity > 0).reduce((s, m) => s + m.quantity, 0);
    const totalOut = filtered.filter(m => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0);
    return { totalIn, totalOut, count: filtered.length };
  }, [filtered]);

  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    const headers = ['Date & Heure', 'Produit', 'Référence', 'Type Opération', 'Document Source', 'Quantité', 'Solde Progressif'];
    const rows = filtered.map(m => {
      const p = productMap.get(m.productId);
      const cfg = OP_CONFIG[m.type];
      return [
        new Date(m.date).toLocaleString('fr-MA'),
        `"${p?.name || 'Inconnu'}"`,
        p?.reference || '',
        cfg.label,
        m.documentRef || '',
        (m.quantity > 0 ? '+' : '') + m.quantity,
        m.newBalance.toString(),
      ].join(';');
    });

    const csv = BOM + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mouvements_stock_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedProductName = productFilter ? productMap.get(productFilter)?.name : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {selectedProductName ? `Fiche de Stock — ${selectedProductName}` : 'Mouvements de Stock Détaillés'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Historique complet des entrées, sorties et ajustements
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Exporter (Excel)
        </button>
      </div>
      <div className="gold-accent-line w-24" />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ArrowUp className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Entrées</p>
          </div>
          <p className="text-2xl font-bold text-primary tabular-nums">+{stats.totalIn}</p>
        </div>
        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <ArrowDown className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Sorties</p>
          </div>
          <p className="text-2xl font-bold text-destructive tabular-nums">-{stats.totalOut}</p>
        </div>
        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mouvements</p>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{stats.count}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher produit, référence, document…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* Product filter */}
          <div className="relative max-w-xs">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Tous les produits</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.reference} — {p.name}</option>
              ))}
            </select>
            {productFilter && (
              <button onClick={() => setProductFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <span className="text-muted-foreground text-xs">→</span>
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        {/* Operation type filter */}
        <div className="flex gap-1.5 flex-wrap">
          {OP_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setOpFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                opFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mb-3 opacity-20" />
            <p className="font-medium">Aucun mouvement trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date & Heure</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type d'Opération</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document Source</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantité</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solde Progressif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(m => {
                  const p = productMap.get(m.productId);
                  const cfg = OP_CONFIG[m.type] || OP_CONFIG.manual;
                  const Icon = cfg.icon;

                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-foreground">
                          {new Date(m.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(m.date).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-foreground">{p?.name || 'Inconnu'}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">{p?.reference}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', cfg.cls)}>
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {m.documentRef ? docLink(m.documentRef) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={cn(
                          'text-sm font-bold tabular-nums px-2 py-0.5 rounded-full',
                          m.quantity > 0
                            ? 'bg-primary/10 text-primary'
                            : 'bg-destructive/10 text-destructive'
                        )}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn(
                          'text-sm font-bold tabular-nums',
                          m.newBalance < 0 ? 'text-destructive' : 'text-foreground'
                        )}>
                          {m.newBalance}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
