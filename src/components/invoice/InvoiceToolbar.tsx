import { ArrowLeft, Printer, CheckCircle, Undo2, Lock, AlertTriangle, CreditCard, ExternalLink, ShieldOff, Banknote, Truck, FileCode } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import type { Invoice } from '@/contexts/DataContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props {
  invoice: Invoice;
  onBack: () => void;
  onValidate: () => void;
  onAvoir: () => void;
  onMarkPaid: () => void;
  onAddPayment?: () => void;
  onGenerateBL?: () => void;
  onDownloadXml?: () => void;
  xmlAllowed?: boolean;
  xmlBlockedReason?: string;
  canValidate?: boolean;
  canCreateAvoir?: boolean;
}

export default function InvoiceToolbar({ invoice, onBack, onValidate, onAvoir, onMarkPaid, onAddPayment, onGenerateBL, onDownloadXml, xmlAllowed, xmlBlockedReason, canValidate = true, canCreateAvoir = true }: Props) {
  const { t } = useLang();
  const isLocked = invoice.status === 'validated' || invoice.status === 'avoir' || invoice.status === 'paid';
  const isAvoir = invoice.status === 'avoir';
  const isPaid = invoice.status === 'paid';
  /** Prevent duplicate avoir — button disabled if hasAvoir is true */
  const hasAvoir = !!(invoice as any).hasAvoir;

  return (
    <div className="flex items-center gap-3 no-print flex-wrap">
      <button
        onClick={onBack}
        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      {isLocked && !isAvoir && !isPaid && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Lock className="w-3 h-3" />
          {t.lockedInvoice}
        </div>
      )}
      {isPaid && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-paid-bg text-status-paid text-xs font-semibold">
          <CreditCard className="w-3 h-3" />
          {t.paid}
        </div>
      )}
      {isAvoir && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
            <AlertTriangle className="w-3 h-3" />
            Document de crédit (Avoir)
          </div>
          {/* Legal immutability notice for validated Avoirs */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium"
            title="Art. 210 CGI — Un avoir validé est immuable et ne peut être ni modifié ni supprimé."
          >
            <ShieldOff className="w-3 h-3" />
            Immuable — Art. 210 CGI
          </div>
        </>
      )}

      <div className="flex-1" />

      {!isLocked && canValidate && (
        <button
          onClick={onValidate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          {t.validate}
        </button>
      )}
      {invoice.status === 'validated' && (
        <>
          {onGenerateBL && !invoice.blId && (
            <button
              onClick={onGenerateBL}
              className="flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/10 transition-colors"
            >
              <Truck className="w-4 h-4" />
              Générer Bon de Livraison
            </button>
          )}
          {onAddPayment && (invoice.totalPaid || 0) < invoice.totals.totalTTC && (
            <button
              onClick={onAddPayment}
              className="flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/10 transition-colors"
            >
              <Banknote className="w-4 h-4" />
              Enregistrer un paiement
            </button>
          )}
          <button
            onClick={onMarkPaid}
            className="flex items-center gap-2 px-4 py-2 bg-status-paid text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <CreditCard className="w-4 h-4" />
            {t.markAsPaid}
          </button>
          {hasAvoir ? (
            <span
              title={`Avoir déjà créé${(invoice as any).avoirId ? ` (${(invoice as any).avoirId})` : ''}`}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-semibold cursor-not-allowed opacity-60"
            >
              <ExternalLink className="w-4 h-4" />
              Avoir créé ✓
            </span>
          ) : canCreateAvoir ? (
            <button
              onClick={onAvoir}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Undo2 className="w-4 h-4" />
              {t.createAvoir}
            </button>
          ) : null}
        </>
      )}
      {/* XML Download Button */}
      {onDownloadXml && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <button
                  onClick={xmlAllowed ? onDownloadXml : undefined}
                  disabled={!xmlAllowed}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold transition-colors',
                    xmlAllowed
                      ? 'border-primary text-primary hover:bg-primary/10'
                      : 'border-border text-muted-foreground opacity-50 cursor-not-allowed'
                  )}
                >
                  <FileCode className="w-4 h-4" />
                  XML (UBL)
                </button>
              </span>
            </TooltipTrigger>
            {!xmlAllowed && xmlBlockedReason && (
              <TooltipContent>
                <p className="text-xs max-w-[250px]">{xmlBlockedReason}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-muted transition-colors"
      >
        <Printer className="w-4 h-4" />
        {t.print}
      </button>
    </div>
  );
}


