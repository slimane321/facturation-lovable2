import { useState } from 'react';
import { useDocuments } from '@/contexts/DocumentContext';
import { useData } from '@/contexts/DataContext';
import { calculateTotals, VAT_RATES, type InvoiceLine, type VatRate } from '@/lib/moroccanUtils';
import { X, Plus, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

function uid() { return Math.random().toString(36).slice(2, 9); }
const emptyLine = (): InvoiceLine & { productId?: string } => ({ id: uid(), description: '', quantity: 1, unitPrice: 0, vatRate: 20 });

export default function CreateAchatModal({ onClose }: { onClose: () => void }) {
  const { addAchat } = useDocuments();
  const { products } = useData();
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierICE, setSupplierICE] = useState('');
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState(nextMonth);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<(InvoiceLine & { productId?: string })[]>([emptyLine()]);

  const addLine = () => setLines(p => [...p, emptyLine()]);
  const removeLine = (id: string) => setLines(p => p.filter(l => l.id !== id));
  const updateLine = (id: string, field: keyof InvoiceLine | 'productId', val: string | number) =>
    setLines(p => p.map(l => l.id === id ? { ...l, [field]: val } : l));

  const applyProduct = (lineId: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setLines(p => p.map(l => l.id === lineId ? {
      ...l, productId, description: product.name, unitPrice: product.unitPrice, vatRate: product.vatRate,
    } : l));
  };

  const totals = calculateTotals(lines);

  const handleCreate = () => {
    if (!supplierName.trim() || !supplierInvoiceNumber.trim()) return;
    const validLines = lines.filter(l => l.description.trim() && l.quantity > 0);
    if (!validLines.length) return;
    addAchat({
      supplierInvoiceNumber, supplierName, supplierICE, date, dueDate,
      lines: validLines, status: 'pending', notes, totals: calculateTotals(validLines),
    });
    onClose();
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden animate-fade-in">
        <div className="invoice-header-band px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-primary-foreground">Ajouter une facture fournisseur</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-primary-foreground/70 hover:text-primary-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">N° Facture fournisseur *</label>
              <input value={supplierInvoiceNumber} onChange={e => setSupplierInvoiceNumber(e.target.value)}
                placeholder="FRS-2026-00123" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Fournisseur *</label>
              <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
                placeholder="Nom du fournisseur" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">ICE Fournisseur</label>
              <input value={supplierICE} onChange={e => setSupplierICE(e.target.value)}
                placeholder="000000000000000" maxLength={15} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Date facture</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Date d'échéance</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Lignes</p>
            {lines.map((line, idx) => (
              <div key={line.id} className="space-y-2 p-3 rounded-lg bg-muted/40 border border-border/50">
                {/* Product picker */}
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <select
                    value={line.productId || ''}
                    onChange={e => e.target.value ? applyProduct(line.id, e.target.value) : updateLine(line.id, 'productId', '')}
                    className="flex-1 px-2 py-1.5 rounded border border-input bg-background text-sm focus:outline-none"
                  >
                    <option value="">— Sélectionner un produit (optionnel) —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.reference} — {p.name} (Stock: {p.stock})</option>
                    ))}
                  </select>
                  <button onClick={() => removeLine(line.id)} disabled={lines.length === 1}
                    className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Line fields */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input value={line.description} onChange={e => updateLine(line.id, 'description', e.target.value)}
                    placeholder={`Désignation ${idx + 1}`}
                    className="col-span-5 px-2 py-1.5 rounded border border-input bg-background text-sm focus:outline-none" />
                  <input type="number" value={line.quantity} onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="col-span-2 px-2 py-1.5 rounded border border-input bg-background text-sm text-right focus:outline-none" />
                  <input type="number" value={line.unitPrice} onChange={e => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="col-span-3 px-2 py-1.5 rounded border border-input bg-background text-sm text-right focus:outline-none" />
                  <select value={line.vatRate} onChange={e => updateLine(line.id, 'vatRate', parseInt(e.target.value) as VatRate)}
                    className="col-span-2 px-2 py-1.5 rounded border border-input bg-background text-sm focus:outline-none">
                    {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                {line.productId && (
                  <p className="text-[10px] text-primary flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    Stock sera augmenté de {line.quantity} unité(s) à la sauvegarde
                  </p>
                )}
              </div>
            ))}
            <button onClick={addLine}
              className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80">
              <Plus className="w-3.5 h-3.5" />Ajouter une ligne
            </button>
          </div>

          <div className="text-right border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Total TTC : </span>
            <span className="text-lg font-bold text-primary tabular-nums">
              {totals.totalTTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
            Annuler
          </button>
          <button onClick={handleCreate}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
