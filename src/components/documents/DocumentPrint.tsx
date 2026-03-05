/**
 * Shared professional print layout for Devis, BC, and BL documents.
 * Mirrors the InvoiceDetail layout: logo top-left, doc type/number top-right,
 * client block, items table (Réf / Désignation / Qté / P.U. HT / TVA / Total TTC),
 * totals summary, and legal footer.
 */
import { useSettings } from '@/contexts/SettingsContext';
import { useData } from '@/contexts/DataContext';
import { useLang } from '@/contexts/LanguageContext';
import { formatCurrency, calculateTotals } from '@/lib/moroccanUtils';
import type { InvoiceLine } from '@/lib/moroccanUtils';
import { cn } from '@/lib/utils';
import { Printer } from 'lucide-react';

type DocKind = 'devis' | 'bc' | 'bl';

const DOC_LABELS: Record<string, Record<DocKind, string>> = {
  fr: { devis: 'DEVIS', bc: 'BON DE COMMANDE', bl: 'BON DE LIVRAISON' },
  ar: { devis: 'عرض سعر', bc: 'أمر شراء', bl: 'وثيقة تسليم' },
};

const CLIENT_LABELS: Record<string, Record<DocKind, string>> = {
  fr: { devis: 'Destinataire', bc: 'Commandé par', bl: 'Livré à' },
  ar: { devis: 'المرسل إليه', bc: 'الطالب', bl: 'المسلّم إليه' },
};

const PRINT_LABELS = {
  fr: { ref: 'Réf.', designation: 'Désignation', qty: 'Qté', puHT: 'P. Unitaire HT', tva: 'TVA', totalTTC: 'Total TTC', subtotalHT: 'Sous-total HT', totalLabel: 'Total TTC', date: 'Date', dueDate: 'Échéance', validUntil: 'Valide jusqu\'au', paymentMode: 'Mode de règlement', rib: 'RIB', notes: 'Notes' },
  ar: { ref: 'المرجع', designation: 'البيان', qty: 'الكمية', puHT: 'سعر الوحدة', tva: 'ض.ق.م', totalTTC: 'المجموع شامل', subtotalHT: 'المجموع قبل الضريبة', totalLabel: 'المجموع شامل الضريبة', date: 'التاريخ', dueDate: 'تاريخ الاستحقاق', validUntil: 'صالح حتى', paymentMode: 'طريقة الدفع', rib: 'الحساب البنكي', notes: 'ملاحظات' },
};

interface DocumentPrintProps {
  kind: DocKind;
  number: string;
  date: string;
  validUntil?: string; // devis only
  dueDate?: string;
  clientId: string;
  lines: InvoiceLine[];
  totals: ReturnType<typeof calculateTotals>;
  notes?: string;
  sourceRef?: string; // e.g. "Réf. Devis: DV-2026-0001"
  paymentMethod?: string;
  paymentRef?: string;
}

export default function DocumentPrint({
  kind, number, date, validUntil, dueDate, clientId, lines, totals, notes, sourceRef, paymentMethod, paymentRef,
}: DocumentPrintProps) {
  const { settings } = useSettings();
  const { getClient } = useData();
  const { lang } = useLang();
  const client = getClient(clientId);
  const L = PRINT_LABELS[lang] || PRINT_LABELS.fr;

  return (
    <div className="invoice-surface shadow-invoice overflow-hidden print:shadow-none print:border print:border-border">

      {/* ── Header band ──────────────────────────────── */}
      <div className="invoice-header-band px-8 py-6 flex justify-between items-start print:flex">
        <div>
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-14 mb-2 object-contain" />
          ) : (
            <p className="text-2xl font-black text-primary-foreground">{settings.name}</p>
          )}
          <p className="text-primary-foreground/80 text-sm mt-1">{settings.address}</p>
          <p className="text-primary-foreground/80 text-sm">{settings.city}</p>
          <p className="text-primary-foreground/70 text-xs mt-2">
            ICE : {settings.ice} &nbsp;|&nbsp; IF : {settings.ifNumber} &nbsp;|&nbsp; {settings.rc}
          </p>
          <p className="text-primary-foreground/70 text-xs mt-0.5">
            Tél : {settings.tel} &nbsp;|&nbsp; {settings.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-primary-foreground tracking-tight">
            {(DOC_LABELS[lang] || DOC_LABELS.fr)[kind]}
          </p>
          <p className="text-xl font-mono font-bold mt-1 text-accent">{number}</p>
          <p className="text-primary-foreground/70 text-sm mt-2">
            {L.date} : {new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          {dueDate && (
            <p className="text-primary-foreground/70 text-sm">
              {L.dueDate} : {new Date(dueDate).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
          {validUntil && (
            <p className="text-primary-foreground/70 text-sm">
              {L.validUntil} : {new Date(validUntil).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
          {sourceRef && (
            <p className="text-primary-foreground/60 text-xs mt-1 italic">{sourceRef}</p>
          )}
        </div>
      </div>

      {/* ── Gold separator ────────────────────────────── */}
      <div className="gold-accent-line" />

      {/* ── Client block ────────────────────────────── */}
      <div className="px-8 py-5 flex justify-end">
        <div className="bg-muted/40 rounded-xl p-5 min-w-[300px] border border-border">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {(CLIENT_LABELS[lang] || CLIENT_LABELS.fr)[kind]}
          </p>
          <p className="font-bold text-foreground text-base">{client?.businessName || '—'}</p>
          {client?.ice     && <p className="text-sm text-muted-foreground mt-1">ICE : {client.ice}</p>}
          {client?.ifNumber && <p className="text-sm text-muted-foreground">IF : {client.ifNumber}</p>}
          {client?.rc       && <p className="text-sm text-muted-foreground">RC : {client.rc}</p>}
          <p className="text-sm text-muted-foreground mt-1">{client?.address}</p>
          <p className="text-sm text-muted-foreground">{client?.city}</p>
        </div>
      </div>

      {/* ── Lines table ── Réf / Désignation / Qté / P.U. HT / TVA / Total TTC ── */}
      <div className="px-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="text-left px-4 py-2.5 rounded-l-lg font-semibold w-24">{L.ref}</th>
              <th className="text-left px-3 py-2.5 font-semibold">{L.designation}</th>
              <th className="text-right px-3 py-2.5 font-semibold w-16">{L.qty}</th>
              <th className="text-right px-3 py-2.5 font-semibold w-28">{L.puHT}</th>
              <th className="text-center px-3 py-2.5 font-semibold w-16">{L.tva}</th>
              <th className="text-right px-4 py-2.5 rounded-r-lg font-semibold w-32">{L.totalTTC}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const lineHT = line.quantity * line.unitPrice;
              const lineVAT = lineHT * (line.vatRate / 100);
              const lineTTC = lineHT + lineVAT;
              return (
                <tr key={line.id} className={cn(idx % 2 === 0 ? 'bg-muted/20' : '')}>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                    {(line as any).reference || '—'}
                  </td>
                  <td className="px-3 py-3 text-foreground">{line.description}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{line.quantity}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {line.unitPrice.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-center text-muted-foreground">{line.vatRate}%</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">
                    {lineTTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Totals ──────────────────────────────── */}
      <div className="px-8 py-6 flex justify-end">
        <div className="min-w-[280px] space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{L.subtotalHT}</span>
            <span className="font-semibold tabular-nums">{formatCurrency(totals.subtotalHT)}</span>
          </div>
          {totals.vatBreakdown.filter(v => v.amount > 0).map(v => (
            <div key={v.rate} className="flex justify-between">
              <span className="text-muted-foreground">TVA {v.rate}%</span>
              <span className="font-semibold tabular-nums">{formatCurrency(v.amount)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
            <span className="text-foreground">{L.totalLabel}</span>
            <span className="text-primary tabular-nums">{formatCurrency(totals.totalTTC)}</span>
          </div>
        </div>
      </div>

      {/* ── Payment method ───────────────────────────── */}
      {paymentMethod && (
        <div className="px-8 pb-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm border-t border-border pt-3">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{L.paymentMode} :</span>{' '}
              {paymentMethod}
              {paymentRef && ` — Réf. N° ${paymentRef}`}
            </span>
            {paymentMethod === 'Virement' && settings.rib && (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{L.rib} :</span>{' '}
                {settings.rib} ({settings.bank})
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Notes ────────────────────────────────────── */}
      {notes && (
        <div className="px-8 pb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{L.notes}</p>
          <p className="text-sm text-muted-foreground">{notes}</p>
        </div>
      )}

      {/* ── Legal footer ────────────────────────────── */}
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
  );
}

/** Print button reusable */
export function PrintButton({ label = 'Imprimer' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  );
}
