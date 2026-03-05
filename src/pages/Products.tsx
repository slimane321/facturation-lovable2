import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import type { Product, StockMovement } from '@/contexts/DataContext';
import { VAT_RATES, type VatRate, formatCurrency } from '@/lib/moroccanUtils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, Plus, Pencil, Trash2, Package, AlertCircle, Check, ChevronDown, History, ArrowDown, ArrowUp, RotateCcw, Wrench, SlidersHorizontal, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────
interface ProductFormData {
  reference: string;
  name: string;
  description: string;
  unitPrice: string;
  vatRate: VatRate;
  unit: string;
  stockInitial: string;
  minStockThreshold: string;
}

type FormErrors = Partial<Record<keyof ProductFormData, string>>;

const EMPTY_FORM: ProductFormData = {
  reference: '',
  name: '',
  description: '',
  unitPrice: '',
  vatRate: 20,
  unit: 'Unité',
  stockInitial: '0',
  minStockThreshold: '5',
};

const UNITS = ['Unité', 'Heure', 'Jour', 'Mois', 'Forfait', 'Kg', 'M²', 'ML', 'Litre'];

// ── Input atoms ────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="w-3 h-3" />{msg}
    </p>
  );
}

function TextInput({
  value, onChange, placeholder, error, className, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  error?: string; className?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground',
        'placeholder:text-muted-foreground/50 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring',
        error ? 'border-destructive/60 bg-destructive/5' : 'border-input',
        className,
      )}
    />
  );
}

// ── Delete confirm ────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" />Supprimer le produit
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          Supprimer <span className="font-semibold text-foreground">"{name}"</span> ? Cette action est irréversible.
        </p>
        <DialogFooter className="gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >Annuler</button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
          >Supprimer</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── VAT badge ─────────────────────────────────
function VatBadge({ rate }: { rate: VatRate }) {
  const configs: Record<VatRate, { bg: string; text: string; label: string }> = {
    0:  { bg: 'bg-muted',         text: 'text-muted-foreground', label: 'Exonéré' },
    7:  { bg: 'bg-gold/15',       text: 'text-gold-foreground',  label: '7%' },
    10: { bg: 'bg-secondary',     text: 'text-secondary-foreground', label: '10%' },
    14: { bg: 'bg-accent/20',     text: 'text-accent-foreground', label: '14%' },
    20: { bg: 'bg-primary/10',    text: 'text-primary',           label: '20%' },
  };
  const { bg, text, label } = configs[rate] ?? configs[20];
  return (
    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full tabular-nums', bg, text)}>
      TVA {label}
    </span>
  );
}

// ── Product form modal ────────────────────────
function ProductModal({
  initial, onSave, onClose,
}: {
  initial?: Product;
  onSave: (data: ProductFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProductFormData>(
    initial
      ? {
          reference: initial.reference,
          name: initial.name,
          description: initial.description || '',
          unitPrice: String(initial.unitPrice),
          vatRate: initial.vatRate,
          unit: initial.unit || 'Unité',
          stockInitial: String(initial.stock ?? 0),
          minStockThreshold: String(initial.minStockThreshold ?? 5),
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const set = (field: keyof ProductFormData) => (val: string | number) => {
    setForm(f => ({ ...f, [field]: val }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = 'Désignation requise';
    const price = parseFloat(form.unitPrice);
    if (!form.unitPrice || isNaN(price) || price < 0)
      errs.unitPrice = 'Prix unitaire invalide (≥ 0)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSave(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {initial
              ? <><Pencil className="w-4 h-4 text-primary" />Modifier le produit</>
              : <><Plus className="w-4 h-4 text-primary" />Nouveau produit / service</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reference + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Référence (SKU)</FieldLabel>
              <TextInput
                value={form.reference}
                onChange={set('reference')}
                placeholder="AUTO si vide (ART-0001)"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Laissez vide pour générer automatiquement</p>
            </div>
            <div>
              <FieldLabel>Unité</FieldLabel>
              <div className="relative">
                <select
                  value={form.unit}
                  onChange={e => set('unit')(e.target.value)}
                  className="w-full px-3 py-2 pr-8 rounded-lg border border-input bg-background text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Designation */}
          <div>
            <FieldLabel required>Désignation</FieldLabel>
            <TextInput
              value={form.name}
              onChange={set('name')}
              placeholder="Nom du produit ou service"
              error={errors.name}
            />
            <FieldError msg={errors.name} />
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={form.description}
              onChange={e => set('description')(e.target.value)}
              placeholder="Description détaillée (optionnel)..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* Price + VAT */}
          <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Prix unitaire HT (MAD)</FieldLabel>
              <div className="relative">
                <TextInput
                  type="number"
                  value={form.unitPrice}
                  onChange={set('unitPrice')}
                  placeholder="0.00"
                  error={errors.unitPrice}
                  className="pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">MAD</span>
              </div>
              <FieldError msg={errors.unitPrice} />
            </div>
            <div>
              <FieldLabel required>Taux TVA</FieldLabel>
              <div className="relative">
                <select
                  value={form.vatRate}
                  onChange={e => set('vatRate')(parseInt(e.target.value) as VatRate)}
                  className="w-full px-3 py-2 pr-8 rounded-lg border border-input bg-background text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  {VAT_RATES.map(r => (
                    <option key={r} value={r}>{r}% {r === 0 ? '(Exonéré)' : r === 7 ? '(Eau, gaz...)' : r === 10 ? '(Restauration...)' : r === 14 ? '(Transport...)' : '(Standard)'}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Stock fields */}
          <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Stock {initial ? 'actuel' : 'initial'}</FieldLabel>
              <TextInput
                type="number"
                value={form.stockInitial}
                onChange={set('stockInitial')}
                placeholder="0"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {initial ? 'Quantité actuelle en stock' : 'Quantité de départ'}
              </p>
            </div>
            <div>
              <FieldLabel>Seuil d'alerte stock</FieldLabel>
              <TextInput
                type="number"
                value={form.minStockThreshold}
                onChange={set('minStockThreshold')}
                placeholder="5"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Alerte si stock ≤ cette valeur</p>
            </div>
          </div>
          {/* Preview */}
          {form.unitPrice && !isNaN(parseFloat(form.unitPrice)) && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">Prix HT</p>
                <p className="font-bold text-foreground tabular-nums">
                  {parseFloat(form.unitPrice).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                </p>
              </div>
              <div className="text-muted-foreground text-lg">+</div>
              <div>
                <p className="text-xs text-muted-foreground">TVA {form.vatRate}%</p>
                <p className="font-bold text-gold-foreground tabular-nums">
                  {(parseFloat(form.unitPrice) * form.vatRate / 100).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                </p>
              </div>
              <div className="text-muted-foreground text-lg">=</div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Prix TTC</p>
                <p className="font-bold text-primary tabular-nums">
                  {(parseFloat(form.unitPrice) * (1 + form.vatRate / 100)).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >Annuler</button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" />
            {initial ? 'Enregistrer' : 'Créer le produit'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Stock movement type labels & icons ────────
const MOVEMENT_TYPE_CONFIG: Record<string, { label: string; icon: React.FC<{className?: string}>; cls: string }> = {
  sale:     { label: 'Vente (BL)',   icon: ArrowDown,    cls: 'text-destructive' },
  purchase: { label: 'Achat',       icon: ArrowUp,      cls: 'text-primary' },
  return:   { label: 'Retour (Avoir)', icon: RotateCcw, cls: 'text-orange-600' },
  manual:   { label: 'Manuel',      icon: Wrench,       cls: 'text-muted-foreground' },
};

function StockMovementDialog({ product, movements, onClose }: {
  product: Product; movements: StockMovement[]; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History className="w-4 h-4 text-primary" />
            Mouvements de stock — {product.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/40 border border-border text-sm">
          <div>
            <span className="text-muted-foreground">Stock actuel :</span>
            <span className={cn('ml-2 font-bold tabular-nums',
              product.stock === 0 ? 'text-destructive' :
              product.stock <= (product.minStockThreshold ?? 5) ? 'text-orange-600' : 'text-primary'
            )}>{product.stock}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-muted-foreground">Seuil :</span>
            <span className="ml-2 font-semibold">{product.minStockThreshold ?? 5}</span>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {movements.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Aucun mouvement enregistré
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs font-semibold uppercase text-muted-foreground">Date</th>
                  <th className="text-left py-2 text-xs font-semibold uppercase text-muted-foreground">Utilisateur</th>
                  <th className="text-left py-2 text-xs font-semibold uppercase text-muted-foreground">Type</th>
                  <th className="text-right py-2 text-xs font-semibold uppercase text-muted-foreground">Qté</th>
                  <th className="text-right py-2 text-xs font-semibold uppercase text-muted-foreground">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map(m => {
                  const cfg = MOVEMENT_TYPE_CONFIG[m.type] || MOVEMENT_TYPE_CONFIG.manual;
                  const Icon = cfg.icon;
                  return (
                    <tr key={m.id} className="hover:bg-muted/20">
                      <td className="py-2 text-muted-foreground text-xs">
                        {new Date(m.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <br />
                        <span className="text-[10px]">{new Date(m.date).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">Admin</td>
                      <td className="py-2">
                        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', cfg.cls)}>
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                        {m.documentRef && <p className="text-[10px] text-muted-foreground mt-0.5">{m.documentRef}</p>}
                      </td>
                      <td className={cn('py-2 text-right font-bold tabular-nums', m.quantity > 0 ? 'text-primary' : 'text-destructive')}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-foreground">{m.newBalance}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────
export default function ProductsPage() {
  const { t } = useLang();
  const { products, addProduct, updateProduct, deleteProduct, getProductMovements, adjustStock } = useData();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [vatFilter, setVatFilter] = useState<VatRate | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();
  const [deleting, setDeleting] = useState<Product | undefined>();
  const [viewingMovements, setViewingMovements] = useState<Product | undefined>();
  const filtered = useMemo(() =>
    products
      .filter(p => vatFilter === 'all' || p.vatRate === vatFilter)
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q))
        );
      }),
    [products, vatFilter, search]
  );

  const [adjustingProduct, setAdjustingProduct] = useState<Product | undefined>();
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustComment, setAdjustComment] = useState('');

  const handleSave = useCallback((data: ProductFormData) => {
    const newStock = parseInt(data.stockInitial) || 0;
    const basePayload = {
      reference: data.reference,
      name: data.name,
      description: data.description,
      unitPrice: parseFloat(data.unitPrice) || 0,
      vatRate: data.vatRate,
      unit: data.unit,
      minStockThreshold: parseInt(data.minStockThreshold) || 5,
    };
    if (editing) {
      const oldStock = editing.stock ?? 0;
      if (newStock !== oldStock) {
        adjustStock(editing.id, newStock - oldStock, 'manual', 'Modification formulaire produit');
      }
      updateProduct(editing.id, basePayload);
    } else {
      addProduct({ ...basePayload, stock: newStock });
    }
    setModalOpen(false);
    setEditing(undefined);
  }, [editing, addProduct, updateProduct, adjustStock]);

  const handleQuickAdjust = () => {
    if (!adjustingProduct || !adjustDelta || !adjustComment.trim()) return;
    const delta = parseInt(adjustDelta);
    if (isNaN(delta) || delta === 0) return;
    adjustStock(adjustingProduct.id, delta, 'manual', adjustComment.trim());
    setAdjustingProduct(undefined);
    setAdjustDelta('');
    setAdjustComment('');
  };

  const openEdit = (p: Product) => { setEditing(p); setModalOpen(true); };
  const openAdd = () => { setEditing(undefined); setModalOpen(true); };

  // Group by VAT rate for stats
  const vatStats = useMemo(() => {
    const map: Record<number, number> = {};
    products.forEach(p => { map[p.vatRate] = (map[p.vatRate] || 0) + 1; });
    return map;
  }, [products]);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.products}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} produit(s) / service(s) dans le catalogue
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau produit
        </button>
      </div>
      <div className="gold-accent-line w-24" />

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
          <button
            onClick={() => setVatFilter('all')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              vatFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
          >
            Tous ({products.length})
          </button>
          {VAT_RATES.map(r => vatStats[r] ? (
            <button key={r}
              onClick={() => setVatFilter(r)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                vatFilter === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
            >
              TVA {r}% ({vatStats[r]})
            </button>
          ) : null)}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-10 h-10 mb-3 opacity-20" />
            <p className="font-medium">Aucun produit trouvé</p>
            <button onClick={openAdd} className="mt-3 text-sm text-primary hover:underline">
              + Ajouter un produit
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Référence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Désignation</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Unité</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prix HT</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">TVA</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Stock</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Prix TTC</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(product => (
                  <tr key={product.id} className={cn(
                    'hover:bg-muted/20 transition-colors group',
                    (product.stock ?? 0) < 0 ? 'bg-destructive/10' :
                    (product.stock ?? 0) === 0 ? 'bg-destructive/5' :
                    (product.stock ?? 0) <= (product.minStockThreshold ?? 5) ? 'bg-orange-50 dark:bg-orange-950/20' : ''
                  )}>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-semibold px-2 py-1 bg-muted rounded-md text-muted-foreground">
                        {product.reference}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-foreground">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{product.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{product.unit || 'Unité'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {product.unitPrice.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">MAD HT</p>
                    </td>
                    <td className="px-4 py-3.5 text-center hidden md:table-cell">
                      <VatBadge rate={product.vatRate} />
                    </td>
                    <td className="px-4 py-3.5 text-center hidden md:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {(() => {
                          const stock = product.stock ?? 0;
                          const threshold = product.minStockThreshold ?? 5;
                          const isNeg = stock < 0;
                          const isOut = stock === 0;
                          const isLow = stock > 0 && stock <= threshold;
                          return (
                            <button
                              onClick={() => setViewingMovements(product)}
                              className={cn(
                                'text-xs font-bold px-2 py-0.5 rounded-full tabular-nums cursor-pointer hover:opacity-80 transition-opacity',
                                isNeg ? 'bg-destructive/15 text-destructive font-extrabold' :
                                isOut ? 'bg-destructive/10 text-destructive' :
                                isLow ? 'bg-orange-100 text-orange-700' :
                                'bg-primary/10 text-primary'
                              )}
                            >
                              {stock}
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => { setAdjustingProduct(product); setAdjustDelta(''); setAdjustComment(''); }}
                          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Ajustement rapide"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                      <p className="text-sm font-bold text-primary tabular-nums">
                        {(product.unitPrice * (1 + product.vatRate / 100)).toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">MAD TTC</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/stock?product=${product.id}`)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Fiche de Stock"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(product)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleting(product)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalOpen && (
        <ProductModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
        />
      )}
      {deleting && (
        <DeleteConfirm
          name={deleting.name}
          onConfirm={() => { deleteProduct(deleting.id); setDeleting(undefined); }}
          onCancel={() => setDeleting(undefined)}
        />
      )}
      {viewingMovements && (
        <StockMovementDialog
          product={viewingMovements}
          movements={getProductMovements(viewingMovements.id)}
          onClose={() => setViewingMovements(undefined)}
        />
      )}
      {adjustingProduct && (
        <Dialog open onOpenChange={() => setAdjustingProduct(undefined)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                Ajustement stock — {adjustingProduct.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border text-sm">
                <span className="text-muted-foreground">Stock actuel :</span>
                <span className="font-bold tabular-nums">{adjustingProduct.stock ?? 0}</span>
              </div>
              <div>
                <FieldLabel required>Quantité (+/-) *</FieldLabel>
                <TextInput
                  type="number"
                  value={adjustDelta}
                  onChange={v => setAdjustDelta(v)}
                  placeholder="Ex: +5 ou -3"
                />
              </div>
              <div>
                <FieldLabel required>Motif (obligatoire) *</FieldLabel>
                <textarea
                  value={adjustComment}
                  onChange={e => setAdjustComment(e.target.value)}
                  placeholder="Raison de l'ajustement..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              {adjustDelta && !isNaN(parseInt(adjustDelta)) && parseInt(adjustDelta) !== 0 && (
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-sm text-center">
                    Nouveau stock : <span className={cn("font-bold tabular-nums", ((adjustingProduct.stock ?? 0) + parseInt(adjustDelta)) < 0 ? 'text-destructive' : 'text-primary')}>
                    {(adjustingProduct.stock ?? 0) + parseInt(adjustDelta)}
                  </span>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <button onClick={() => setAdjustingProduct(undefined)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                Annuler
              </button>
              <button onClick={handleQuickAdjust}
                disabled={!adjustDelta || !adjustComment.trim() || isNaN(parseInt(adjustDelta)) || parseInt(adjustDelta) === 0}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Appliquer
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
