import { useMemo, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import {
  Package, Download, AlertTriangle, TrendingDown, BarChart2, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StockFilter = 'all' | 'negative' | 'outOfStock' | 'lowStock' | 'inStock';

export default function InventoryReport() {
  const { t } = useLang();
  const { products } = useData();
  const [filter, setFilter] = useState<StockFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = products;

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q)
      );
    }

    // Filter
    switch (filter) {
      case 'negative':
        list = list.filter(p => (p.stock ?? 0) < 0);
        break;
      case 'outOfStock':
        list = list.filter(p => (p.stock ?? 0) <= 0);
        break;
      case 'lowStock':
        list = list.filter(p => {
          const s = p.stock ?? 0;
          return s > 0 && s <= (p.minStockThreshold ?? 5);
        });
        break;
      case 'inStock':
        list = list.filter(p => (p.stock ?? 0) > 0);
        break;
    }

    return list.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  }, [products, filter, search]);

  // Summary stats
  const stats = useMemo(() => {
    const totalPositiveValue = products.reduce((sum, p) => {
      const stock = p.stock ?? 0;
      return stock > 0 ? sum + stock * p.unitPrice : sum;
    }, 0);
    const totalValue = products.reduce((sum, p) => sum + (p.stock ?? 0) * p.unitPrice, 0);
    const negativeCount = products.filter(p => (p.stock ?? 0) < 0).length;
    const outOfStockCount = products.filter(p => (p.stock ?? 0) === 0).length;
    const lowStockCount = products.filter(p => {
      const s = p.stock ?? 0;
      return s > 0 && s <= (p.minStockThreshold ?? 5);
    }).length;
    return { totalPositiveValue, totalValue, negativeCount, outOfStockCount, lowStockCount };
  }, [products]);

  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    const headers = ['Référence', 'Désignation', 'Stock Actuel', 'Unité', 'Prix Unitaire HT', 'Valeur Stock HT', 'Seuil Alerte', 'Statut'];
    const rows = filtered.map(p => {
      const stock = p.stock ?? 0;
      const value = stock * p.unitPrice;
      const status = stock < 0 ? 'Négatif' : stock === 0 ? 'Rupture' : stock <= (p.minStockThreshold ?? 5) ? 'Alerte' : 'OK';
      return [
        p.reference,
        `"${p.name}"`,
        stock.toString(),
        p.unit || 'Unité',
        p.unitPrice.toFixed(2),
        value.toFixed(2),
        (p.minStockThreshold ?? 5).toString(),
        status,
      ].join(';');
    });

    // Add summary row
    rows.push('');
    rows.push(`Valeur Totale Stock (positif);;;;;;${stats.totalPositiveValue.toFixed(2)};`);
    rows.push(`Valeur Totale Stock (net);;;;;;${stats.totalValue.toFixed(2)};`);

    const csv = BOM + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaire_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const FILTERS: { key: StockFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: products.length },
    { key: 'negative', label: 'Stock négatif', count: stats.negativeCount },
    { key: 'outOfStock', label: 'Rupture (≤ 0)', count: stats.outOfStockCount + stats.negativeCount },
    { key: 'lowStock', label: 'Stock faible', count: stats.lowStockCount },
    { key: 'inStock', label: 'En stock', count: products.length - stats.negativeCount - stats.outOfStockCount },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rapport d'Inventaire</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Valorisation et état des stocks — {new Date().toLocaleDateString('fr-MA')}
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Exporter l'Inventaire (Excel)
        </button>
      </div>
      <div className="gold-accent-line w-24" />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valeur Totale du Stock</p>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(stats.totalPositiveValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Stock positif uniquement</p>
        </div>

        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stock Négatif</p>
          </div>
          <p className="text-2xl font-bold text-destructive tabular-nums">{stats.negativeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Produits vendus non approvisionnés</p>
        </div>

        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ruptures</p>
          </div>
          <p className="text-2xl font-bold text-destructive tabular-nums">{stats.outOfStockCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Stock à zéro</p>
        </div>

        <div className="stat-card animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold-foreground flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alertes Stock</p>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{stats.lowStockCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Sous le seuil minimum</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par désignation, référence…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                filter === f.key
                  ? f.key === 'negative' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mb-3 opacity-20" />
            <p className="font-medium">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Référence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Désignation</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock Actuel</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prix Unitaire HT</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valeur Stock HT</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seuil</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(product => {
                  const stock = product.stock ?? 0;
                  const value = stock * product.unitPrice;
                  const isNeg = stock < 0;
                  const isOut = stock === 0;
                  const isLow = stock > 0 && stock <= (product.minStockThreshold ?? 5);

                  return (
                    <tr
                      key={product.id}
                      className={cn(
                        'hover:bg-muted/20 transition-colors',
                        isNeg ? 'bg-destructive/10' :
                        isOut ? 'bg-destructive/5' :
                        isLow ? 'bg-orange-50 dark:bg-orange-950/20' : ''
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-mono font-semibold px-2 py-1 bg-muted rounded-md text-muted-foreground">
                          {product.reference}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-foreground">{product.name}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn(
                          'text-sm font-bold tabular-nums px-2 py-0.5 rounded-full',
                          isNeg ? 'bg-destructive/15 text-destructive font-extrabold' :
                          isOut ? 'bg-destructive/10 text-destructive' :
                          isLow ? 'bg-orange-100 text-orange-700' :
                          'bg-primary/10 text-primary'
                        )}>
                          {stock}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {product.unitPrice.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p className={cn(
                          'text-sm font-bold tabular-nums',
                          isNeg ? 'text-destructive' : 'text-foreground'
                        )}>
                          {value.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-xs text-muted-foreground">{product.minStockThreshold ?? 5}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn(
                          'text-xs font-semibold px-2.5 py-1 rounded-full',
                          isNeg ? 'bg-destructive/15 text-destructive' :
                          isOut ? 'bg-destructive/10 text-destructive' :
                          isLow ? 'bg-orange-100 text-orange-700' :
                          'bg-primary/10 text-primary'
                        )}>
                          {isNeg ? 'Négatif' : isOut ? 'Rupture' : isLow ? 'Alerte' : 'OK'}
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

      {/* Footer summary */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/30 rounded-xl border">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Total produits affichés</p>
          <p className="text-lg font-bold text-foreground">{filtered.length}</p>
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Valeur stock affiché (HT)</p>
          <p className="text-lg font-bold text-foreground tabular-nums">
            {formatCurrency(filtered.reduce((s, p) => s + (p.stock ?? 0) * p.unitPrice, 0))}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Valeur stock positif (HT)</p>
          <p className="text-lg font-bold text-primary tabular-nums">
            {formatCurrency(filtered.reduce((s, p) => {
              const st = p.stock ?? 0;
              return st > 0 ? s + st * p.unitPrice : s;
            }, 0))}
          </p>
        </div>
      </div>
    </div>
  );
}
