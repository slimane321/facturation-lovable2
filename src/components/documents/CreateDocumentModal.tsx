/**
 * Shared modal for creating Devis, BC, and BL documents.
 * Includes product picker that auto-fills Reference, P.U HT, and TVA.
 */
import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { calculateTotals, VAT_RATES, type InvoiceLine, type VatRate } from '@/lib/moroccanUtils';
import { X, Plus, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/contexts/DocumentContext';
import { PAYMENT_METHODS_DOC } from '@/contexts/DocumentContext';

type DocType = 'devis' | 'bc' | 'bl';

const TYPE_LABELS: Record<DocType, string> = {
  devis: 'Nouveau Devis',
  bc: 'Nouveau Bon de Commande',
  bl: 'Nouveau Bon de Livraison',
};

function uid() { return Math.random().toString(36).slice(2, 9); }

interface LineWithRef extends InvoiceLine {
  reference?: string;
}

const emptyLine = (): LineWithRef => ({
  id: uid(),
  description: '',
  quantity: 1,
  unitPrice: 0,
  vatRate: 20,
  reference: '',
});

interface Props {
  type: DocType;
  onClose: () => void;
  onCreate: (data: object) => void;
}

export default function CreateDocumentModal({ type, onClose, onCreate }: Props) {
  const { clients, products } = useData();
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [date, setDate] = useState(today);
  const [validUntil, setValidUntil] = useState(nextWeek);
  const [dueDate, setDueDate] = useState(defaultDue);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Virement');
  const [paymentRef, setPaymentRef] = useState('');
  const [lines, setLines] = useState<LineWithRef[]>([emptyLine()]);

  const addLine = () => setLines(p => [...p, emptyLine()]);
  const removeLine = (id: string) => setLines(p => p.filter(l => l.id !== id));

  const updateLine = (id: string, field: keyof LineWithRef, val: string | number) =>
    setLines(p => p.map(l => l.id === id ? { ...l, [field]: val } : l));

  /** When a product is selected from the dropdown, auto-fill all fields */
  const applyProduct = (lineId: string, productId: string) => {
    if (!productId) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setLines(prev => prev.map(l =>
      l.id === lineId
        ? {
            ...l,
            reference: product.reference,
            description: product.name,
            unitPrice: product.unitPrice,
            vatRate: product.vatRate,
          }
        : l
    ));
  };

  const totals = calculateTotals(lines);

  const handleCreate = () => {
    if (!clientId) return;
    const validLines = lines.filter(l => l.description.trim() && l.quantity > 0);
    if (!validLines.length) return;

    // Always recalculate totals from the actual valid lines
    const recalculated = calculateTotals(validLines);
    const base = { clientId, date, dueDate, lines: validLines, notes, totals: recalculated, paymentMethod, paymentRef: (paymentMethod === 'Chèque' || paymentMethod === 'Effet') ? paymentRef : undefined };

    if (type === 'devis') onCreate({ ...base, validUntil, status: 'draft' });
    else if (type === 'bc') onCreate({ ...base, status: 'pending' });
    else onCreate({ ...base, status: 'prepared' });
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="invoice-header-band px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-primary-foreground">{TYPE_LABELS[type]}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-primary-foreground/70 hover:text-primary-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Date</label>
              <input type="date" value={date} onChange={e => {
                setDate(e.target.value);
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) {
                  d.setDate(d.getDate() + 30);
                  setDueDate(d.toISOString().split('T')[0]);
                }
              }} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                Date d'échéance{paymentMethod === 'Effet' && <span className="text-destructive ml-0.5">*</span>}
              </label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          {type === 'devis' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Valide jusqu'au</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {/* Client */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Client *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
              <option value="">-- Sélectionner --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Mode de règlement *</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className={inputCls}>
                {PAYMENT_METHODS_DOC.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {(paymentMethod === 'Chèque' || paymentMethod === 'Effet') && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                  Référence / N° {paymentMethod}
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder={`N° ${paymentMethod}`}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Lignes</p>
              <p className="text-[10px] text-muted-foreground">Réf. / Désignation / Qté / P.U. HT / TVA</p>
            </div>

            {lines.map((line, idx) => (
              <div key={line.id} className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
                {/* Product picker */}
                {products.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <select
                      onChange={e => applyProduct(line.id, e.target.value)}
                      defaultValue=""
                      className="flex-1 px-2 py-1 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring/30 text-muted-foreground"
                    >
                      <option value="">— Choisir un produit (auto-remplissage) —</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          [{p.reference}] {p.name} — {p.unitPrice.toLocaleString('fr-MA')} MAD HT ({p.vatRate}%)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Fields row */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  {/* Reference */}
                  <input
                    value={line.reference || ''}
                    onChange={e => updateLine(line.id, 'reference', e.target.value)}
                    placeholder="Réf."
                    className="col-span-2 px-2 py-1.5 rounded border border-input bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring/30"
                  />
                  {/* Description */}
                  <input
                    value={line.description}
                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                    placeholder={`Désignation ${idx + 1}`}
                    className="col-span-4 px-2 py-1.5 rounded border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring/30"
                  />
                  {/* Qty */}
                  <input
                    type="number"
                    min="0"
                    value={line.quantity}
                    onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="col-span-2 px-2 py-1.5 rounded border border-input bg-background text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring/30"
                  />
                  {/* Unit Price HT */}
                  <input
                    type="number"
                    min="0"
                    value={line.unitPrice}
                    onChange={e => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="col-span-2 px-2 py-1.5 rounded border border-input bg-background text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring/30"
                  />
                  {/* VAT */}
                  <select
                    value={line.vatRate}
                    onChange={e => updateLine(line.id, 'vatRate', parseInt(e.target.value) as VatRate)}
                    className="col-span-1 px-1 py-1.5 rounded border border-input bg-background text-xs focus:outline-none"
                  >
                    {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                  {/* Remove */}
                  <button
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length === 1}
                    className="col-span-1 p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30 flex justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line total preview */}
                <div className="text-right text-xs text-muted-foreground">
                  Total TTC :{' '}
                  <span className="font-semibold text-foreground tabular-nums">
                    {((line.quantity * line.unitPrice) * (1 + line.vatRate / 100)).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                  </span>
                </div>
              </div>
            ))}

            <button
              onClick={addLine}
              className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80"
            >
              <Plus className="w-3.5 h-3.5" />Ajouter une ligne
            </button>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* Totals summary */}
          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total HT</span>
              <span className="tabular-nums">{totals.subtotalHT.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD</span>
            </div>
            {totals.vatBreakdown.filter(v => v.amount > 0).map(v => (
              <div key={v.rate} className="flex justify-between text-muted-foreground">
                <span>TVA {v.rate}%</span>
                <span className="tabular-nums">{v.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-base border-t border-border pt-2">
              <span>Total TTC</span>
              <span className="text-primary tabular-nums">
                {totals.totalTTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}
