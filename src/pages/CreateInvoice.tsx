import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { Client } from '@/contexts/DataContext';
import {
  calculateTotals, formatCurrency, amountToFrenchWords,
  VAT_RATES, type InvoiceLine, type VatRate, validateICE
} from '@/lib/moroccanUtils';
import { Plus, Trash2, QrCode, ChevronDown, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
// ── Tiny uid for line IDs ─────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

const EMPTY_LINE = (): InvoiceLine => ({
  id: uid(), description: '', quantity: 1, unitPrice: 0, vatRate: 20,
});

const PAYMENT_METHODS = ['Espèces', 'Virement', 'Chèque', 'Effet'];

interface ClientFormData {
  businessName: string;
  ice: string;
  ifNumber: string;
  address: string;
  city: string;
}

// ── Input component ────────────────────────────
function Field({ label, error, children, required }: {
  label: string; error?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors',
        'placeholder:text-muted-foreground/50 disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors',
        'appearance-none cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

// ── Section wrapper ────────────────────────────
function Section({ title, children, icon: Icon }: {
  title: string; children: React.ReactNode; icon?: React.FC<{ className?: string }>;
}) {
  return (
    <div className="bg-card rounded-xl border shadow-card p-6 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function CreateInvoice() {
  const { t } = useLang();
  const { clients, products, addClient, addInvoice } = useData();
  const { isYearClosed } = useSettings();
  const navigate = useNavigate();

  // Invoice header
  const today = new Date().toISOString().split('T')[0];
  const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(defaultDue);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[1]); // Virement default
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [acompte, setAcompte] = useState(0);

  // Client
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '');
  const [newClient, setNewClient] = useState<ClientFormData>({
    businessName: '', ice: '', ifNumber: '', address: '', city: '',
  });
  const [clientErrors, setClientErrors] = useState<Partial<ClientFormData>>({});

  // Lines
  const [lines, setLines] = useState<InvoiceLine[]>([EMPTY_LINE()]);

  // ── Computed ──────────────────────────────────
  const totals = useMemo(() => calculateTotals(lines, { applyTimbre: true, paymentMethod }), [lines, paymentMethod]);
  const amountWords = useMemo(() => amountToFrenchWords(totals.totalTTC), [totals.totalTTC]);
  const isEspeces = paymentMethod === 'Espèces';

  const currentClient: Client | undefined = useMemo(() => {
    if (clientMode === 'existing') return clients.find(c => c.id === selectedClientId);
    return undefined;
  }, [clientMode, clients, selectedClientId]);

  // ── Line handlers ─────────────────────────────
  const addLine = () => setLines(prev => [...prev, EMPTY_LINE()]);
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = useCallback((id: string, field: keyof InvoiceLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  const loadProduct = (lineId: string, productId: string) => {
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, description: p.name, unitPrice: p.unitPrice, vatRate: p.vatRate } : l
    ));
  };

  // ── Validation ────────────────────────────────
  const validateNewClient = () => {
    const errs: Partial<ClientFormData> = {};
    if (!newClient.businessName.trim()) errs.businessName = 'Champ requis';
    if (!validateICE(newClient.ice)) errs.ice = 'ICE invalide (15 chiffres requis)';
    if (!newClient.address.trim()) errs.address = 'Champ requis';
    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Save ──────────────────────────────────────
  // Always saves as draft ('pending'). Validation happens from InvoiceDetail.
  const handleSave = () => {
    // ── Prevent backdating into a closed fiscal year ──
    const invoiceYear = new Date(invoiceDate).getFullYear();
    if (isYearClosed(invoiceYear)) {
      alert(`L'exercice ${invoiceYear} est clôturé. Impossible de créer une facture avec une date dans cette année.`);
      return;
    }

    let clientId = selectedClientId;

    if (clientMode === 'new') {
      if (!validateNewClient()) return;
      const c = addClient({
        clientType: 'company',
        businessName: newClient.businessName,
        ice: newClient.ice,
        ifNumber: newClient.ifNumber,
        address: newClient.address,
        city: newClient.city,
      });
      clientId = c.id;
    }

    if (!clientId) return;
    const validLines = lines.filter(l => l.description.trim() && l.quantity > 0);
    if (validLines.length === 0) return;

    const invoice = addInvoice({
      date: invoiceDate,
      dueDate,
      clientId,
      lines: validLines,
      status: 'pending',
      notes,
      paymentMethod,
      paymentRef: (paymentMethod === 'Chèque' || paymentMethod === 'Effet') ? paymentRef : undefined,
      totals: calculateTotals(validLines, { applyTimbre: true, paymentMethod }),
    });

    navigate(`/invoices/${invoice.id}`);
  };

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/invoices')}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.createInvoice}</h1>
          <p className="text-sm text-muted-foreground">Nouvelle facture • Conforme 2026</p>
        </div>
      </div>
      <div className="gold-accent-line w-24" />

      {/* Invoice Info */}
      <Section title={t.invoiceInfo}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label={t.date} required>
            <Input type="date" value={invoiceDate} onChange={e => {
              setInvoiceDate(e.target.value);
              // Auto-set due date to +30 days
              const d = new Date(e.target.value);
              if (!isNaN(d.getTime())) {
                d.setDate(d.getDate() + 30);
                setDueDate(d.toISOString().split('T')[0]);
              }
            }} />
          </Field>
          <Field label={t.dueDate} required={paymentMethod === 'Effet'}>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Field>
          <Field label={t.paymentMethod}>
            <Select value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); setPaymentRef(''); }}>
              {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          {(paymentMethod === 'Chèque' || paymentMethod === 'Effet') ? (
            <Field label={`Référence / N° ${paymentMethod}`}>
              <Input
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder={`Numéro de ${paymentMethod}`}
              />
            </Field>
          ) : (
            <div className="flex flex-col justify-end">
              <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <p className="text-xs text-muted-foreground">N° attribué à la validation</p>
                <p className="text-sm font-bold text-primary font-mono">BROUILLON</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Ex: FA-{new Date().getFullYear()}-0001</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Client */}
      <Section title={t.clientInfo}>
        {/* Toggle */}
        <div className="flex gap-2 mb-4">
          {(['existing', 'new'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setClientMode(mode)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                clientMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {mode === 'existing' ? 'Client existant' : 'Nouveau client'}
            </button>
          ))}
        </div>

        {clientMode === 'existing' ? (
          <Field label={t.client} required>
            <Select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
              <option value="">-- Sélectionner un client --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.businessName} – ICE: {c.ice}
                </option>
              ))}
            </Select>
            {currentClient && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p className="font-medium text-foreground">{currentClient.businessName}</p>
                <p className="text-muted-foreground">ICE: {currentClient.ice} | IF: {currentClient.ifNumber}</p>
                <p className="text-muted-foreground">{currentClient.address}, {currentClient.city}</p>
              </div>
            )}
          </Field>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Field label={t.businessName} error={clientErrors.businessName} required>
              <Input value={newClient.businessName} onChange={e => setNewClient(p => ({ ...p, businessName: e.target.value }))} placeholder="SARL / SA / Auto-entrepreneur..." />
            </Field>
            <Field label={t.ice} error={clientErrors.ice} required>
              <Input value={newClient.ice} onChange={e => setNewClient(p => ({ ...p, ice: e.target.value }))} placeholder="000000000000000" maxLength={15} />
            </Field>
            <Field label={t.ifField}>
              <Input value={newClient.ifNumber} onChange={e => setNewClient(p => ({ ...p, ifNumber: e.target.value }))} placeholder="Identifiant Fiscal" />
            </Field>
            <Field label="Ville">
              <Input value={newClient.city} onChange={e => setNewClient(p => ({ ...p, city: e.target.value }))} placeholder="Casablanca" />
            </Field>
            <div className="lg:col-span-2">
              <Field label={t.address} error={clientErrors.address} required>
                <Input value={newClient.address} onChange={e => setNewClient(p => ({ ...p, address: e.target.value }))} placeholder="Adresse complète" />
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* Lines */}
      <Section title={t.invoiceLines}>
        {/* Header row */}
        <div className="hidden lg:grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
          <div className="col-span-4">{t.description}</div>
          <div className="col-span-2 text-right">{t.quantity}</div>
          <div className="col-span-2 text-right">{t.unitPrice}</div>
          <div className="col-span-2">{t.vatRate}</div>
          <div className="col-span-1 text-right">{t.lineTotal}</div>
          <div className="col-span-1" />
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={line.id} className="invoice-line grid grid-cols-12 gap-2 items-start">
              {/* Description + quick product */}
              <div className="col-span-12 lg:col-span-4 space-y-1">
                <Input
                  value={line.description}
                  onChange={e => updateLine(line.id, 'description', e.target.value)}
                  placeholder={`Désignation ${idx + 1}`}
                />
                {products.length > 0 && (
                  <Select className="text-xs py-1" onChange={e => { if (e.target.value) loadProduct(line.id, e.target.value); e.target.value = ''; }}>
                    <option value="">↳ Catalogue...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                )}
              </div>

              <div className="col-span-4 lg:col-span-2">
                <Input
                  type="number" min="0" step="0.01"
                  value={line.quantity}
                  onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                  className="text-right"
                />
              </div>

              <div className="col-span-4 lg:col-span-2">
                <Input
                  type="number" min="0" step="0.01"
                  value={line.unitPrice}
                  onChange={e => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="text-right"
                />
              </div>

              <div className="col-span-3 lg:col-span-2">
                <Select
                  value={line.vatRate}
                  onChange={e => updateLine(line.id, 'vatRate', parseInt(e.target.value) as VatRate)}
                >
                  {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </Select>
              </div>

              <div className="col-span-4 lg:col-span-1 flex items-center justify-end">
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {(line.quantity * line.unitPrice).toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="col-span-1 flex items-start justify-center pt-1">
                <button
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length === 1}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addLine}
          className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors mt-2"
        >
          <Plus className="w-4 h-4" />
          {t.addLine}
        </button>
      </Section>

      {/* Acompte & Notes */}
      <Section title="Acompte & Notes">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Acompte reçu (MAD)">
            <Input
              type="number" min="0" step="0.01"
              value={acompte || ''}
              onChange={e => setAcompte(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="text-right"
            />
          </Field>
          <div className="sm:col-span-1" />
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Conditions de paiement, mentions légales..."
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring placeholder:text-muted-foreground/50"
        />
      </Section>

      {/* Summary */}
      <div className="bg-card rounded-xl border shadow-card p-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Totals */}
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.subtotalHT}</span>
              <span className="font-semibold tabular-nums">{formatCurrency(totals.subtotalHT)}</span>
            </div>

            {totals.vatBreakdown.map(vb => (
              <div key={vb.rate} className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVA {vb.rate}% (base: {formatCurrency(vb.base)})</span>
                <span className="font-semibold tabular-nums text-gold-foreground">{formatCurrency(vb.amount)}</span>
              </div>
            ))}

            {isEspeces && totals.timbreAmount && totals.timbreAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Droit de Timbre (0,25%)</span>
                <span className="font-semibold tabular-nums text-gold-foreground">{formatCurrency(totals.timbreAmount)}</span>
              </div>
            )}

            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-bold text-foreground">{t.totalTTC}</span>
              <span className="text-xl font-bold text-primary tabular-nums">{formatCurrency(totals.totalTTC)}</span>
            </div>

            {/* Acompte & Reste à payer */}
            {acompte > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Acompte reçu</span>
                  <span className="font-semibold tabular-nums text-primary">- {formatCurrency(acompte)}</span>
                </div>
                <div className="border-t border-dashed border-border pt-2 flex justify-between">
                  <span className="font-bold text-foreground">Reste à payer</span>
                  <span className="text-lg font-bold text-destructive tabular-nums">{formatCurrency(Math.max(0, totals.totalTTC - acompte))}</span>
                </div>
              </>
            )}

            {/* Amount in words */}
            <div className="mt-3 p-3 rounded-lg bg-muted/50 border-l-4 border-gold">
              <p className="text-xs text-muted-foreground mb-1">{t.amountWords} :</p>
              <p className="text-sm font-medium text-foreground italic">{amountWords}</p>
            </div>
          </div>

          {/* QR Code placeholder */}
          <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border min-w-[120px]">
            <QrCode className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground text-center">{t.qrCode}</p>
            <p className="text-[10px] text-muted-foreground/50 text-center">Généré à la validation</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          <button
            onClick={() => handleSave()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {t.save} (Brouillon)
          </button>
          <p className="text-xs text-muted-foreground self-center">
            La validation et le verrouillage se font depuis la page de détail de la facture.
          </p>
        </div>
      </div>
    </div>
  );
}
