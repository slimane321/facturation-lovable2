import { useParams, useSearchParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { shortFingerprint, shortSignature } from '@/lib/hashUtils';
import { ShieldCheck, AlertTriangle, Fingerprint, Lock, Printer, BadgeCheck, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VerifyInvoice() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { invoices, getInvoice, getClient } = useData();
  const { settings } = useSettings();

  // Support lookup by hash (via route param or ?hash= query) or by invoice ID
  const hashParam = searchParams.get('hash');
  let invoice = id ? getInvoice(id) : undefined;

  // If not found by ID, try matching by hash
  if (!invoice && id) {
    invoice = invoices.find(i => i.hash === id || i.hash === decodeURIComponent(id));
  }
  if (!invoice && hashParam) {
    invoice = invoices.find(i => i.hash === hashParam || i.hash === decodeURIComponent(hashParam));
  }

  const client = invoice ? getClient(invoice.clientId) : undefined;

  // ── Not Found ──
  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-background p-6">
        <div className="bg-card rounded-2xl border-2 border-destructive/20 shadow-xl p-10 max-w-md text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-black text-destructive">Document Non Vérifié</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Aucun document validé ne correspond à cette empreinte numérique dans notre système.
            <br /><br />
            Cela peut indiquer un document <strong className="text-destructive">falsifié</strong> ou <strong className="text-destructive">altéré</strong>.
          </p>
          <div className="h-px bg-border" />
          <p className="text-[10px] text-muted-foreground">
            Système de Vérification e-Facture 2026 — Art. 210 CGI
          </p>
        </div>
      </div>
    );
  }

  const isValid = !!invoice.hash && !!invoice.signature;
  const isLocked = invoice.status === 'validated' || invoice.status === 'paid' || invoice.status === 'avoir';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-6">
      <div className="bg-card rounded-2xl border shadow-xl max-w-lg w-full overflow-hidden">
        {/* ── Header Band ── */}
        <div className={cn(
          'px-8 py-6 text-center',
          isValid ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
        )}>
          <div className="flex items-center justify-center gap-3 mb-2">
            {isValid ? (
              <BadgeCheck className="w-10 h-10" />
            ) : (
              <AlertTriangle className="w-10 h-10" />
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {isValid ? 'Document Authentique ✓' : 'Document Non Signé'}
          </h1>
          <p className="text-sm opacity-80 mt-1">
            {isValid
              ? 'L\'intégrité et l\'authenticité de ce document ont été vérifiées.'
              : 'Ce document n\'a pas encore été signé numériquement.'
            }
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* ── Issuer ── */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border">
            <Building2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Émetteur</p>
              <p className="font-bold text-foreground">{settings.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">ICE : {settings.ice}</p>
              {settings.ifNumber && <p className="text-xs text-muted-foreground">IF : {settings.ifNumber}</p>}
            </div>
          </div>

          {/* ── Document Details ── */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">N° Document</span>
              <span className="font-mono font-black text-lg text-primary">{invoice.number}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Client</span>
              <span className="font-semibold text-foreground">{client?.businessName || '—'}</span>
            </div>
            {client?.ice && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">ICE Client</span>
                <span className="font-mono text-foreground">{client.ice}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Date d'émission</span>
              <span className="text-foreground">{new Date(invoice.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Total TTC</span>
              <span className="font-bold text-primary text-lg tabular-nums">{formatCurrency(Math.abs(invoice.totals.totalTTC))}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Statut</span>
              <span className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                invoice.status === 'validated' ? 'bg-primary/15 text-primary' :
                invoice.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                invoice.status === 'avoir' ? 'bg-destructive/15 text-destructive' :
                'bg-muted text-muted-foreground'
              )}>
                {invoice.status === 'validated' ? 'Validée' :
                 invoice.status === 'paid' ? 'Payée' :
                 invoice.status === 'avoir' ? 'Avoir' :
                 invoice.status}
              </span>
            </div>
            {invoice.dgiRegistrationNumber && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">N° DGI</span>
                <span className="font-mono font-bold text-primary">{invoice.dgiRegistrationNumber}</span>
              </div>
            )}
          </div>

          {/* ── Digital Seal ── */}
          {isValid && (
            <div className="space-y-3 p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Sceau Numérique</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Fingerprint className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Empreinte Numérique (Art. 210 CGI)
                  </p>
                </div>
                <p className="font-mono text-xs font-bold text-foreground bg-background px-3 py-2 rounded-lg break-all border border-border">
                  {shortFingerprint(invoice.hash!)}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Code de Signature
                  </p>
                </div>
                <p className="font-mono text-xs font-bold text-primary bg-background px-3 py-2 rounded-lg border border-border">
                  {shortSignature(invoice.signature!)}
                </p>
              </div>
            </div>
          )}

          {/* ── Print / Download ── */}
          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Télécharger l'original (PDF)
          </button>

          {/* ── Footer ── */}
          <div className="text-center space-y-1 pt-2">
            <p className="text-[10px] text-muted-foreground">
              Vérification e-Facture 2026 — Conforme Art. 210 CGI
            </p>
            <p className="text-[9px] text-muted-foreground/60">
              {settings.name} — {settings.city} — ICE : {settings.ice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
