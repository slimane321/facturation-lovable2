import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import type { Product, StockMovement, StockMovementType } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import {
  ArrowDown, ArrowUp, RotateCcw, Wrench, Download, Package,
  Search, ChevronDown, ChevronRight, AlertTriangle, TrendingDown,
  BarChart2, Eye, SlidersHorizontal, FileText, MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ── Movement type config ──────────────────────
const OP_CONFIG: Record<StockMovementType, { label: string; icon: React.FC<{ className?: string }>; cls: string; emoji: string }> = {
  purchase: { label: 'Entrée Achat',      icon: ArrowUp,    cls: 'text-primary',            emoji: '📥' },
  sale:     { label: 'Sortie Vente',      icon: ArrowDown,  cls: 'text-destructive',        emoji: '📤' },
  return:   { label: 'Retour Avoir',      icon: RotateCcw,  cls: 'text-orange-600',         emoji: '🔄' },
  manual:   { label: 'Ajustement Manuel', icon: Wrench,     cls: 'text-muted-foreground',   emoji: '🛠️' },
};

type StockFilter = 'all' | 'negative' | 'outOfStock' | 'lowStock' | 'inStock';

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

// ── Adjustment Modal ──────────────────────────
function AdjustmentModal({
  product, open, onClose, onConfirm,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (delta: number, comment: string) => void;
}) {
  const [delta, setDelta] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    const d = parseInt(delta, 10);
    if (!d || !comment.trim()) return;
    onConfirm(d, comment);
    setDelta('');
    setComment('');
    onClose();
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustement Manuel — {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Stock actuel: <strong className="text-foreground">{product.stock}</strong></p>
          <div>
            <label className="block text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1">Quantité (+/-)</label>
            <input
              type="number" value={delta} onChange={e => setDelta(e.target.value)}
              placeholder="ex: +10 ou -3"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1">Motif (obligatoire)</label>
            <input
              value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Raison de l'ajustement…"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!delta || !parseInt(delta, 10) || !comment.trim()}>
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────
export default function StockHub() {
  const { products, stockMovements, adjustStock, getProductMovements } = useData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productParam = searchParams.get('product');
  const scrollRef = useRef<HTMLTableRowElement | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  // Auto-expand and scroll to product from query param
  useEffect(() => {
    if (productParam && products.some(p => p.id === productParam)) {
      setExpandedRows(new Set([productParam]));
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [productParam, products]);

  // ── Product computations ──────────────────────
  const productStats = useMemo(() => {
    const map = new Map<string, { totalIn: number; totalOut: number }>();
    stockMovements.forEach(m => {
      const cur = map.get(m.productId) || { totalIn: 0, totalOut: 0 };
      if (m.quantity > 0) cur.totalIn += m.quantity;
      else cur.totalOut += Math.abs(m.quantity);
      map.set(m.productId, cur);
    });
    return map;
  }, [stockMovements]);

  const filtered = useMemo(() => {
    let list = [...products];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)
      );
    }

    switch (filter) {
      case 'negative':   list = list.filter(p => (p.stock ?? 0) < 0); break;
      case 'outOfStock': list = list.filter(p => (p.stock ?? 0) <= 0); break;
      case 'lowStock':   list = list.filter(p => { const s = p.stock ?? 0; return s > 0 && s <= (p.minStockThreshold ?? 5); }); break;
      case 'inStock':    list = list.filter(p => (p.stock ?? 0) > 0); break;
    }

    return list.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  }, [products, filter, search]);

  // ── Summary stats ─────────────────────────────
  const stats = useMemo(() => {
    const totalPositiveValue = products.reduce((s, p) => (p.stock ?? 0) > 0 ? s + (p.stock ?? 0) * p.unitPrice : s, 0);
    const negativeCount = products.filter(p => (p.stock ?? 0) < 0).length;
    const outOfStockCount = products.filter(p => (p.stock ?? 0) === 0).length;
    const lowStockCount = products.filter(p => { const s = p.stock ?? 0; return s > 0 && s <= (p.minStockThreshold ?? 5); }).length;
    return { totalPositiveValue, negativeCount, outOfStockCount, lowStockCount };
  }, [products]);

  const FILTERS: { key: StockFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: products.length },
    { key: 'negative', label: 'Stock négatif', count: stats.negativeCount },
    { key: 'outOfStock', label: 'Rupture (≤ 0)', count: stats.outOfStockCount + stats.negativeCount },
    { key: 'lowStock', label: 'Stock faible', count: stats.lowStockCount },
    { key: 'inStock', label: 'En stock', count: products.length - stats.negativeCount - stats.outOfStockCount },
  ];

  // ── Expand/Collapse ───────────────────────────
  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Audit cross-check: computed stock vs actual ─
  const computedStock = useCallback((productId: string) => {
    const movements = getProductMovements(productId);
    return movements.reduce((sum, m) => sum + m.quantity, 0);
  }, [getProductMovements]);

  // ── Find which document caused negative balance ─
  const findNegativeCause = useCallback((productId: string): StockMovement | null => {
    const movements = getProductMovements(productId).sort((a, b) => a.date.localeCompare(b.date));
    for (const m of movements) {
      if (m.newBalance < 0) return m;
    }
    return null;
  }, [getProductMovements]);

  // ── Export CSV ─────────────────────────────────
  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    const headers = ['Référence', 'Désignation', 'Total Entrées', 'Total Sorties', 'Stock Actuel', 'Prix Unit. HT', 'Valeur Stock HT', 'Statut'];
    const rows = filtered.map(p => {
      const stock = p.stock ?? 0;
      const ps = productStats.get(p.id);
      const status = stock < 0 ? 'Négatif' : stock === 0 ? 'Rupture' : stock <= (p.minStockThreshold ?? 5) ? 'Alerte' : 'OK';
      return [
        p.reference, `"${p.name}"`, ps?.totalIn ?? 0, ps?.totalOut ?? 0,
        stock, p.unitPrice.toFixed(2), (stock * p.unitPrice).toFixed(2), status,
      ].join(';');
    });
    rows.push('');
    rows.push(`Valeur Totale Stock (positif);;;;;;;${stats.totalPositiveValue.toFixed(2)}`);

    const csv = BOM + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hub_stock_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportProductHistory = (product: Product) => {
    const movements = getProductMovements(product.id).sort((a, b) => b.date.localeCompare(a.date));
    const BOM = '\uFEFF';
    const headers = ['Date', 'Type', 'Document', 'Quantité', 'Solde'];
    const rows = movements.map(m => {
      const cfg = OP_CONFIG[m.type];
      return [
        new Date(m.date).toLocaleString('fr-MA'),
        cfg.label, m.documentRef || '',
        (m.quantity > 0 ? '+' : '') + m.quantity, m.newBalance,
      ].join(';');
    });
    const csv = BOM + [`Fiche de Stock — ${product.name} (${product.reference})`, '', headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiche_stock_${product.reference}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdjustConfirm = (delta: number, comment: string) => {
    if (!adjustProduct) return;
    adjustStock(adjustProduct.id, delta, 'manual', comment);
    setAdjustProduct(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hub de Stock</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inventaire consolidé & historique des mouvements — {new Date().toLocaleDateString('fr-MA')}
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Exporter l'Inventaire
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
          <p className="text-xs text-muted-foreground mt-1">Produits non approvisionnés</p>
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
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/30 text-orange-600 flex items-center justify-center">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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

      {/* Main inventory table with expandable rows */}
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
                  <th className="w-8 px-2 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produit</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Entrées</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Sorties</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock Actuel</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valorisation</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(product => {
                  const stock = product.stock ?? 0;
                  const isNeg = stock < 0;
                  const isOut = stock === 0;
                  const isLow = stock > 0 && stock <= (product.minStockThreshold ?? 5);
                  const ps = productStats.get(product.id);
                  const isExpanded = expandedRows.has(product.id);
                  const movements = isExpanded ? getProductMovements(product.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
                  const negCause = isNeg ? findNegativeCause(product.id) : null;

                  // Audit cross-check
                  const computed = computedStock(product.id);
                  const integrityOk = computed === stock;

                  return (
                    <React.Fragment key={product.id}>
                      {/* Product summary row */}
                      <tr
                        ref={product.id === productParam ? scrollRef : undefined}
                        className={cn(
                          'hover:bg-muted/20 transition-colors cursor-pointer',
                          isNeg ? 'bg-destructive/5' : isOut ? 'bg-destructive/[0.03]' : isLow ? 'bg-orange-50/50 dark:bg-orange-950/10' : '',
                          product.id === productParam && 'ring-2 ring-primary/30'
                        )}
                        onClick={() => toggleRow(product.id)}
                      >
                        <td className="px-2 py-3 text-center">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground mx-auto" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground mx-auto" />
                          }
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-semibold px-2 py-1 bg-muted rounded-md text-muted-foreground">
                            {product.reference}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-foreground">{product.name}</p>
                          {product.unit && <span className="text-[10px] text-muted-foreground">{product.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold text-primary tabular-nums">+{ps?.totalIn ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold text-destructive tabular-nums">-{ps?.totalOut ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full',
                            isNeg ? 'bg-destructive/15 text-destructive font-extrabold' :
                            isOut ? 'bg-destructive/10 text-destructive' :
                            isLow ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' :
                            'bg-primary/10 text-primary'
                          )}>
                            {stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'text-sm font-bold tabular-nums',
                            isNeg ? 'text-destructive' : 'text-foreground'
                          )}>
                            {formatCurrency(stock * product.unitPrice)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className={cn(
                              'text-xs font-semibold px-2 py-0.5 rounded-full',
                              isNeg ? 'bg-destructive/15 text-destructive' :
                              isOut ? 'bg-destructive/10 text-destructive' :
                              isLow ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' :
                              'bg-primary/10 text-primary'
                            )}>
                              {isNeg ? 'Négatif' : isOut ? 'Rupture' : isLow ? 'Alerte' : 'OK'}
                            </span>
                            {!integrityOk && (
                              <span className="text-[10px] text-destructive" title={`Attendu: ${computed}, Actuel: ${stock}`}>⚠️</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => navigate(`/products`)}>
                                <Eye className="w-4 h-4 mr-2" /> Voir le Produit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportProductHistory(product)}>
                                <FileText className="w-4 h-4 mr-2" /> Exporter la Fiche
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAdjustProduct(product)}>
                                <SlidersHorizontal className="w-4 h-4 mr-2" /> Ajustement Manuel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>

                      {/* Expanded movement history */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <div className="bg-muted/20 border-t border-b border-border">
                              {/* Negative stock warning */}
                              {isNeg && negCause && (
                                <div className="flex items-center gap-2 px-6 py-2.5 bg-destructive/10 border-b border-destructive/20">
                                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                                  <p className="text-xs text-destructive font-medium">
                                    ⚠️ Stock devenu négatif le{' '}
                                    {new Date(negCause.date).toLocaleDateString('fr-MA')}{' '}
                                    via {OP_CONFIG[negCause.type]?.label || negCause.type}
                                    {negCause.documentRef && <> — document: <strong>{negCause.documentRef}</strong></>}
                                    {' '}(solde: {negCause.newBalance})
                                  </p>
                                </div>
                              )}

                              {movements.length === 0 ? (
                                <p className="px-6 py-6 text-sm text-muted-foreground italic text-center">Aucun mouvement enregistré</p>
                              ) : (
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-muted/40">
                                      <th className="text-left px-6 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                                      <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                                      <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Document</th>
                                      <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quantité</th>
                                      <th className="text-right px-6 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Solde</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/50">
                                    {movements.slice(0, 20).map(m => {
                                      const cfg = OP_CONFIG[m.type] || OP_CONFIG.manual;
                                      return (
                                        <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                                          <td className="px-6 py-2">
                                            <span className="text-xs text-foreground">
                                              {new Date(m.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground ml-2">
                                              {new Date(m.date).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2">
                                            <span className={cn('flex items-center gap-1.5 text-xs font-semibold', cfg.cls)}>
                                              <span>{cfg.emoji}</span>
                                              {cfg.label}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2">
                                            {m.documentRef ? docLink(m.documentRef) : <span className="text-xs text-muted-foreground italic">—</span>}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            <span className={cn(
                                              'text-xs font-bold tabular-nums px-2 py-0.5 rounded-full',
                                              m.quantity > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                                            )}>
                                              {m.quantity > 0 ? '+' : ''}{m.quantity}
                                            </span>
                                          </td>
                                          <td className="px-6 py-2 text-right">
                                            <span className={cn(
                                              'text-xs font-bold tabular-nums',
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
                              )}
                              {movements.length > 20 && (
                                <p className="text-center py-2 text-xs text-muted-foreground">
                                  … et {movements.length - 20} mouvements supplémentaires
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
            {formatCurrency(filtered.reduce((s, p) => { const st = p.stock ?? 0; return st > 0 ? s + st * p.unitPrice : s; }, 0))}
          </p>
        </div>
      </div>

      {/* Adjustment modal */}
      <AdjustmentModal
        product={adjustProduct}
        open={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onConfirm={handleAdjustConfirm}
      />
    </div>
  );
}
