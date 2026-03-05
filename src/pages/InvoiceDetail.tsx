import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useLang } from '@/contexts/LanguageContext';
import { useRole } from '@/contexts/RoleContext';
import { useData, DRAFT_NUMBER } from '@/contexts/DataContext';
import type { Payment } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useDocuments } from '@/contexts/DocumentContext';
import { amountToFrenchWords, buildQRData, formatCurrency, calculateTotals } from '@/lib/moroccanUtils';
import { generateUBLXml, downloadXml, validateXml, canGenerateXml } from '@/lib/ublGenerator';
import { cn } from '@/lib/utils';
import InvoiceToolbar from '@/components/invoice/InvoiceToolbar';
import InvoiceVatTable from '@/components/invoice/InvoiceVatTable';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, AlertTriangle, CreditCard, Banknote, History, Fingerprint, BadgeCheck, ExternalLink } from 'lucide-react';
import DocumentTimeline from '@/components/documents/DocumentTimeline';
import DgiActionsPanel from '@/components/invoice/DgiActionsPanel';
import { shortFingerprint, shortSignature } from '@/lib/hashUtils';

type ConfirmType = 'validate' | 'avoir' | 'paid' | null;

const PAYMENT_METHODS = ['Espèces', 'Virement', 'Chèque', 'Effet'];

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const { can } = useRole();
  const { getInvoice, getClient, validateInvoice, markAsPaid, createAvoir, addPayment, updateInvoice, invoices } = useData();
  const { addBL, blList } = useDocuments();
  
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState<ConfirmType>(null);
  const [restockOnAvoir, setRestockOnAvoir] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('Espèces');
  const [payRef, setPayRef] = useState('');

  const invoice = getInvoice(id!);
  const client = invoice ? getClient(invoice.clientId) : undefined;

  if (!invoice || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>Facture introuvable.</p>
        <Link to="/invoices" className="text-primary mt-2 hover:underline">← Retour</Link>
      </div>
    );
  }

  const isAvoir = invoice.status === 'avoir';
  const isLocked = invoice.status === 'validated' || invoice.status === 'avoir' || invoice.status === 'paid';
  const isDraft = invoice.number === DRAFT_NUMBER;
  const totalPaid = invoice.totalPaid || 0;
  const resteAPayer = invoice.totals.totalTTC - totalPaid;
  const isPartial = totalPaid > 0 && totalPaid < invoice.totals.totalTTC;

  const amountWords = amountToFrenchWords(Math.abs(invoice.totals.totalTTC));

  // Use hash-based verification URL for validated invoices, fallback to ID
  const verificationUrl = invoice.hash
    ? `${window.location.origin}/verify/${encodeURIComponent(invoice.hash)}`
    : `${window.location.origin}/verify/${invoice.id}`;

  const qrData = buildQRData({
    sellerICE: settings.ice,
    clientICE: client.ice,
    invoiceNumber: invoice.number,
    date: invoice.date,
    totalTTC: invoice.totals.totalTTC,
    totalTVA: invoice.totals.totalTVA,
    signature: invoice.signature,
    verificationUrl: isLocked ? verificationUrl : undefined,
  });

  // ── Confirmation handlers ────────────────────
  const handleConfirm = () => {
    if (confirmOpen === 'validate') {
      validateInvoice(invoice.id);
      setTimeout(() => {
        const updated = getInvoice(invoice.id);
        toast({
          title: t.validateSuccess,
          description: updated ? `${t.validateNumber} : ${updated.number}` : undefined,
        });
      }, 50);
    } else if (confirmOpen === 'avoir') {
      try {
        const avoir = createAvoir(invoice.id, restockOnAvoir);
        navigate(`/invoices/${avoir.id}`);
      } catch (err: any) {
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      }
    } else if (confirmOpen === 'paid') {
      markAsPaid(invoice.id);
      toast({ title: t.paidSuccess });
    }
    setConfirmOpen(null);
  };

  const handlePaymentSubmit = () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }
    if (amount > resteAPayer + 0.01) {
      toast({ title: 'Le montant dépasse le reste à payer', variant: 'destructive' });
      return;
    }
    addPayment(invoice.id, {
      amount,
      date: payDate,
      method: payMethod,
      reference: (payMethod === 'Chèque' || payMethod === 'Effet') ? payRef : undefined,
    });
    toast({ title: 'Paiement enregistré' });
    setPaymentOpen(false);
    setPayAmount('');
    setPayRef('');
  };

  const handleGenerateBL = () => {
    if (invoice.blId) {
      toast({ title: 'BL déjà lié', variant: 'destructive' });
      return;
    }
    const freshTotals = calculateTotals(invoice.lines);
    const bl = addBL({
      date: new Date().toISOString().split('T')[0],
      clientId: invoice.clientId,
      lines: invoice.lines.map(l => ({ ...l, quantity: Math.abs(l.quantity) })),
      status: 'prepared',
      notes: `BL généré depuis facture ${invoice.number}`,
      totals: freshTotals,
      paymentMethod: invoice.paymentMethod as any,
      paymentRef: invoice.paymentRef,
      sourceInvoiceId: invoice.id,
    });
    // Link the BL to this invoice
    updateInvoice(invoice.id, { blId: bl.id } as any);
    toast({ title: '✅ Bon de Livraison créé', description: `${bl.number} lié à ${invoice.number}` });
  };

  // Find linked BL
  const linkedBL = invoice.blId ? blList.find(b => b.id === invoice.blId) : undefined;

  const confirmConfig: Record<NonNullable<ConfirmType>, {
    icon: React.ReactNode; title: string; desc: string; cta: string; variant?: 'default' | 'destructive';
  }> = {
    validate: {
      icon: <ShieldCheck className="w-5 h-5 text-primary" />,
      title: t.confirmValidateTitle, desc: t.confirmValidateDesc, cta: t.confirmCta,
    },
    avoir: {
      icon: <AlertTriangle className="w-5 h-5 text-destructive" />,
      title: t.confirmAvoirTitle, desc: t.confirmAvoirDesc, cta: t.confirmCta, variant: 'destructive',
    },
    paid: {
      icon: <CreditCard className="w-5 h-5" style={{ color: 'hsl(var(--status-paid))' }} />,
      title: t.confirmPaidTitle, desc: t.confirmPaidDesc, cta: t.confirmCta,
    },
  };

  const cfg = confirmOpen ? confirmConfig[confirmOpen] : null;

  // XML generation
  const xmlCheck = canGenerateXml(invoice);
  const handleDownloadXml = () => {
    if (!xmlCheck.allowed) return;
    const xml = generateUBLXml(invoice, client, settings);
    const validation = validateXml(xml);
    if (!validation.valid) {
      toast({ title: 'Erreur XML', description: validation.error || 'Le fichier XML généré contient des erreurs.', variant: 'destructive' });
      return;
    }
    downloadXml(xml, `${invoice.number.replace(/\//g, '-')}.xml`);
    toast({ title: 'XML UBL 2.1 téléchargé ✓', description: `Flux XML conforme DGI pour ${invoice.number}` });
  };

  return (
    <div className="p-6 max-w-5xl space-y-4">
      {/* Toolbar */}
      <InvoiceToolbar
        invoice={invoice}
        onBack={() => navigate('/invoices')}
        onValidate={() => setConfirmOpen('validate')}
        onAvoir={() => setConfirmOpen('avoir')}
        onMarkPaid={() => setConfirmOpen('paid')}
        onAddPayment={() => setPaymentOpen(true)}
        onGenerateBL={handleGenerateBL}
        onDownloadXml={handleDownloadXml}
        xmlAllowed={xmlCheck.allowed}
        xmlBlockedReason={xmlCheck.reason}
        canValidate={can('validate_invoice')}
        canCreateAvoir={can('create_avoir')}
      />

      {/* Linked document references */}
      {(linkedBL || invoice.originalInvoiceId) && (
        <div className="flex flex-wrap items-center gap-3 no-print">
          {linkedBL && (
            <Link
              to="/bl"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              BL lié : {linkedBL.number}
            </Link>
          )}
          {invoice.originalInvoiceId && (
            <Link
              to={`/invoices/${invoice.originalInvoiceId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Avoir de : {invoices?.find(i => i.id === invoice.originalInvoiceId)?.number || invoice.originalInvoiceId}
            </Link>
          )}
        </div>
      )}

      {/* Payment summary bar for validated invoices */}
      {isLocked && !isAvoir && (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Total TTC :</span>
            <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(invoice.totals.totalTTC)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Payé :</span>
            <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(totalPaid)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Reste :</span>
            <span className={cn('text-sm font-bold tabular-nums', resteAPayer > 0 ? 'text-destructive' : 'text-primary')}>
              {formatCurrency(resteAPayer)}
            </span>
          </div>
          {isPartial && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gold/15 text-gold-foreground">
              Partiellement payée
            </span>
          )}
        </div>
      )}

      {/* Invoice Document */}
      <div className="invoice-surface shadow-invoice overflow-hidden print:shadow-none print:border print:border-border">

        {/* ── Header band ──────────────────────────────── */}
        <div className="invoice-header-band px-8 py-6 flex justify-between items-start print:flex">
          {/* Left: Logo / Company */}
          <div>
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-14 mb-2 object-contain" />
            ) : (
              <p className="text-2xl font-black text-primary-foreground">{settings.name}</p>
            )}
            <p className="text-primary-foreground/80 text-sm mt-1">{settings.address}</p>
            <p className="text-primary-foreground/80 text-sm">{settings.city}</p>
            <p className="text-primary-foreground/70 text-xs mt-2">
              Tél : {settings.tel} &nbsp;|&nbsp; {settings.email}
            </p>
          </div>
          {/* Right: Doc type + number */}
          <div className="text-right">
            <p className={cn('text-3xl font-black text-primary-foreground tracking-tight', isAvoir && 'opacity-70')}>
              {isAvoir ? 'AVOIR' : 'FACTURE'}
            </p>
            <p className="text-xl font-mono font-bold mt-1 text-accent">
              {isDraft ? 'N° à confirmer' : invoice.number}
            </p>
            {isDraft && (
              <p className="text-xs text-primary-foreground/60 mt-1 italic">
                Le numéro définitif sera attribué à la validation
              </p>
            )}
            <p className="text-primary-foreground/70 text-sm mt-2">
              Date : {new Date(invoice.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            {invoice.dueDate && (
              <p className="text-primary-foreground/70 text-sm">
                Échéance : {new Date(invoice.dueDate).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
            {invoice.dgiRegistrationNumber && (
              <p className="text-sm font-mono font-bold mt-1.5 px-2 py-0.5 rounded bg-accent/20 text-accent inline-block">
                DGI : {invoice.dgiRegistrationNumber}
              </p>
            )}
          </div>
        </div>

        {/* ── Gold separator ────────────────────────────── */}
        <div className="gold-accent-line" />

        {/* ── Client block ──── */}
        <div className="px-8 py-5 flex justify-end">
          <div className="bg-muted/40 rounded-xl p-5 min-w-[300px] border border-border">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Facturé à</p>
            <p className="font-bold text-foreground text-base">{client.businessName}</p>
            {(client as any).clientNumber && <p className="text-sm text-muted-foreground mt-1">N° Client : {(client as any).clientNumber}</p>}
            {client.ice     && <p className="text-sm text-muted-foreground mt-1">ICE : {client.ice}</p>}
            {client.ifNumber && <p className="text-sm text-muted-foreground">IF : {client.ifNumber}</p>}
            {client.rc       && <p className="text-sm text-muted-foreground">RC : {client.rc}</p>}
            <p className="text-sm text-muted-foreground mt-1">{client.address}</p>
            <p className="text-sm text-muted-foreground">{client.city}</p>
          </div>
        </div>

        {/* ── Lines table ── */}
        <div className="px-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="text-left px-4 py-2.5 rounded-l-lg font-semibold w-28">Réf.</th>
                <th className="text-left px-3 py-2.5 font-semibold">{t.description}</th>
                <th className="text-right px-3 py-2.5 font-semibold w-16">{t.quantity}</th>
                <th className="text-right px-3 py-2.5 font-semibold w-28">{t.unitPrice} HT</th>
                <th className="text-center px-3 py-2.5 font-semibold w-16">{t.vatRate}</th>
                <th className="text-right px-4 py-2.5 rounded-r-lg font-semibold w-32">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, idx) => {
                const lineHT = Math.abs(line.quantity) * line.unitPrice;
                const lineVAT = lineHT * (line.vatRate / 100);
                const lineTTC = lineHT + lineVAT;
                return (
                  <tr key={line.id} className={cn(idx % 2 === 0 ? 'bg-muted/20' : '')}>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {(line as any).reference || '—'}
                    </td>
                    <td className="px-3 py-3 text-foreground">{line.description}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{Math.abs(line.quantity)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{line.unitPrice.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">{line.vatRate}%</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">{lineTTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Totals + QR ──────────────────────────────── */}
        <div className="px-8 py-6 flex flex-col lg:flex-row gap-8 justify-between items-start">
          {/* Left: payment info */}
          <div className="text-sm space-y-1.5 min-w-[220px]">
            <p className="font-semibold text-foreground mb-2">Mode de règlement</p>
            <p className="text-muted-foreground">{invoice.paymentMethod || 'Virement'}</p>
            {(invoice as any).paymentRef && (
              <p className="text-muted-foreground text-xs">Réf. N° {(invoice as any).paymentRef}</p>
            )}
            {(invoice.paymentMethod === 'Virement' || !invoice.paymentMethod) && settings.bank && (
              <p className="text-muted-foreground text-xs">Banque : {settings.bank}</p>
            )}
            {(invoice.paymentMethod === 'Virement' || !invoice.paymentMethod) && (
              <p className="text-muted-foreground text-xs">RIB : {settings.rib}</p>
            )}
            {invoice.originalInvoiceId && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                Avoir sur facture : {invoice.originalInvoiceId}
              </p>
            )}
          </div>

          {/* Center: VAT breakdown + totals */}
          <InvoiceVatTable totals={invoice.totals} isAvoir={isAvoir} />

          {/* Right: QR code */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {isLocked && !isDraft ? (
              <>
                <div className="p-2 border-2 border-border rounded-xl bg-white">
                  <QRCodeSVG value={qrData} size={100} level="M" includeMargin={false} fgColor="hsl(145, 63%, 22%)" />
                </div>
                <p className="text-[9px] text-muted-foreground text-center leading-tight">e-Facture 2026</p>
                <p className="text-[8px] text-muted-foreground/60 text-center">Scan pour vérifier</p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-border rounded-xl w-28 h-28">
                <div className="w-10 h-10 border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground/40 font-mono">QR</span>
                </div>
                <p className="text-[9px] text-muted-foreground text-center leading-tight">Généré à la validation</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Payment summary on PDF (partially paid) ── */}
        {isPartial && (
          <div className="px-8 pb-4 print:break-inside-avoid">
            <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1.5 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Situation de paiement</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total TTC</span>
                <span className="font-semibold tabular-nums">{formatCurrency(invoice.totals.totalTTC)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Déjà payé</span>
                <span className="font-semibold tabular-nums text-primary">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-border">
                <span className="font-bold text-foreground">Reste à payer</span>
                <span className="font-bold tabular-nums text-destructive">{formatCurrency(resteAPayer)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Amount in words ──────────────────────────── */}
        <div className="px-8 pb-5 print:break-inside-avoid">
          <div className="p-4 rounded-xl border-l-4 bg-muted/30" style={{ borderColor: 'hsl(var(--gold))' }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Arrêté la présente {isAvoir ? 'note de crédit' : 'facture'} à la somme de :
            </p>
            <p className="text-sm font-bold text-foreground italic leading-relaxed tracking-wide">
              {amountWords}
            </p>
          </div>
        </div>

        {/* ── Notes ────────────────────────────────────── */}
        {invoice.notes && (
          <div className="px-8 pb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </div>
        )}

        {/* ── Digital Seal & Signature (Art. 210 CGI) ──────── */}
        {invoice.hash && (
          <div className="px-8 pb-4 print:break-inside-avoid">
            {/* Seal of Authenticity */}
            <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg border-2 border-primary/30 bg-primary/5 w-fit">
              <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Document Signé Numériquement — Conforme CGI 2026
              </span>
            </div>
            {/* Hash & Signature details */}
            <div className="flex items-start gap-6 p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Empreinte Numérique (Art. 210 CGI)
                  </p>
                  <p className="text-xs font-mono font-bold text-foreground tracking-widest mt-0.5">
                    {shortFingerprint(invoice.hash)}
                  </p>
                </div>
              </div>
              {invoice.signature && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Code de Signature
                  </p>
                  <p className="text-xs font-mono font-bold text-primary tracking-widest mt-0.5">
                    {shortSignature(invoice.signature)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Full legal footer ────────── */}
        <div className="invoice-header-band px-8 py-4 print:break-inside-avoid">
          <div className="text-xs text-primary-foreground/80">
            <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
              <div className="space-y-0.5">
                <p className="font-bold text-primary-foreground">{settings.name}</p>
                <p>{settings.address} — {settings.city}</p>
                <p>{settings.tel} &nbsp;•&nbsp; {settings.email}{settings.website ? ` • ${settings.website}` : ''}</p>
              </div>
              {settings.rib && (
                <div className="text-right space-y-0.5">
                  <p>{settings.bank} — RIB : {settings.rib}</p>
                </div>
              )}
            </div>
            <div className="border-t border-primary-foreground/20 pt-2 flex flex-wrap gap-x-5 gap-y-0.5 justify-center text-[10px] text-primary-foreground/70">
              {settings.rc       && <span>RC : {settings.rc}</span>}
              {settings.ifNumber && <span>IF : {settings.ifNumber}</span>}
              {settings.ice      && <span>ICE : {settings.ice}</span>}
              {settings.patente  && <span>TP : {settings.patente}</span>}
              {settings.cnss     && <span>CNSS : {settings.cnss}</span>}
              {settings.capitalSocial && <span>Capital : {settings.capitalSocial}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment history ────────────────────────── */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in no-print">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
            <History className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Historique des paiements</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2 text-xs font-semibold uppercase text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Méthode</th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Référence</th>
                <th className="text-right px-5 py-2 text-xs font-semibold uppercase text-muted-foreground">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.payments.map(p => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-5 py-2.5 text-foreground">{new Date(p.date).toLocaleDateString('fr-MA')}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.method}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.reference || '—'}</td>
                  <td className="px-5 py-2.5 text-right font-bold tabular-nums text-primary">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td colSpan={3} className="px-5 py-2 text-xs font-bold uppercase text-muted-foreground">Total payé</td>
                <td className="px-5 py-2 text-right font-bold tabular-nums text-primary">{formatCurrency(totalPaid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Payment modal ────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              Enregistrer un paiement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total TTC</span>
                <span className="font-bold tabular-nums">{formatCurrency(invoice.totals.totalTTC)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Déjà payé</span>
                <span className="font-bold tabular-nums text-primary">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between mt-1 pt-1 border-t border-border">
                <span className="font-semibold text-foreground">Reste à payer</span>
                <span className="font-bold tabular-nums text-destructive">{formatCurrency(resteAPayer)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Montant</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={resteAPayer}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder={`Max: ${resteAPayer.toFixed(2)}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Méthode</Label>
              <select
                value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {(payMethod === 'Chèque' || payMethod === 'Effet') && (
              <div className="space-y-1.5">
                <Label>Référence / N°</Label>
                <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="N° chèque ou effet" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Annuler</Button>
            <Button onClick={handlePaymentSubmit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DGI Actions Panel ────────────────────────── */}
      <DgiActionsPanel invoice={invoice} client={client} />

      {/* ── Document Timeline ────────────────────────── */}
      <DocumentTimeline documentId={invoice.id} />

      {/* ── Confirmation modal ────────────────────────── */}
      <AlertDialog open={confirmOpen !== null} onOpenChange={open => !open && setConfirmOpen(null)}>
        <AlertDialogContent>
          {cfg && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  {cfg.icon}
                  {cfg.title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed">
                  {cfg.desc}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {confirmOpen === 'validate' && (
                <div className="mx-0 mb-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary font-medium">
                  📋 {formatCurrency(invoice.totals.totalTTC)} TTC &nbsp;•&nbsp; {invoice.lines.length} ligne(s)
                </div>
              )}
              {confirmOpen === 'avoir' && (
                <div className="mx-0 mb-2 p-3 rounded-lg bg-muted/40 border border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restockOnAvoir}
                      onChange={e => setRestockOnAvoir(e.target.checked)}
                      className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-foreground">
                      Réintégrer les articles au stock ?
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    Si coché, les quantités seront remises en stock automatiquement.
                  </p>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirm}
                  className={cfg.variant === 'destructive'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : ''}
                >
                  {cfg.cta}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
