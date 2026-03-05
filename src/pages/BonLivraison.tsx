import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocuments } from '@/contexts/DocumentContext';
import { useData } from '@/contexts/DataContext';
import { useLang } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { Plus, Truck, ArrowRight, Trash2, FileText, Printer, ExternalLink, Clock, Lock } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import type { BLStatus, BonLivraison as BonLivraisonType } from '@/contexts/DocumentContext';
import { cn } from '@/lib/utils';
import CreateDocumentModal from '@/components/documents/CreateDocumentModal';
import DocumentPrint from '@/components/documents/DocumentPrint';
import DocumentTimeline from '@/components/documents/DocumentTimeline';
import { toast } from '@/hooks/use-toast';

const STATUS_MAP: Record<BLStatus, { label: string; cls: string }> = {
  prepared:  { label: 'Préparé', cls: 'bg-yellow-50 text-yellow-700' },
  delivered: { label: 'Livré', cls: 'bg-blue-50 text-blue-700' },
  signed:    { label: 'Signé', cls: 'bg-green-50 text-green-700' },
  invoiced:  { label: 'Facturé', cls: 'bg-primary/10 text-primary' },
};

export default function BonLivraison() {
  const { blList, addBL, updateBL, deleteBL, convertBLToInvoiceData } = useDocuments();
  const { clients, addInvoice, invoices } = useData();
  const { t } = useLang();
  const { isYearClosed } = useSettings();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BLStatus | 'all'>('all');
  const [printDoc, setPrintDoc] = useState<BonLivraisonType | null>(null);
  const [timelineDocId, setTimelineDocId] = useState<string | null>(null);
  /** Per-document loading lock — prevents double-click during async conversion */
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    blList
      .filter(d => statusFilter === 'all' || d.status === statusFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [blList, statusFilter]
  );

  const handleGenerateInvoice = (blId: string, blNumber: string) => {
    // Lock: already converting
    if (convertingId === blId) return;

    const bl = blList.find(b => b.id === blId);
    if (bl?.isConverted) {
      toast({ title: '⚠️ Déjà facturé', description: 'Ce BL a déjà été converti en facture.', variant: 'destructive' });
      return;
    }
    // Guard: BL was generated from an invoice — cannot create a second invoice
    if (bl?.sourceInvoiceId) {
      toast({ title: '⚠️ Facture source existante', description: 'Ce BL a été généré depuis une facture. Impossible de créer une autre facture.', variant: 'destructive' });
      return;
    }

    setConvertingId(blId);
    try {
      const data = convertBLToInvoiceData(blId);
      if (!data) {
        toast({ title: '⚠️ Déjà facturé', description: 'Ce BL a déjà été converti en facture.', variant: 'destructive' });
        return;
      }

      // ── Zero-total guard ──────────────────────────────────────────────────
      if (data.totals.totalTTC <= 0) {
        toast({
          title: '❌ Erreur de calcul',
          description: 'Le montant total ne peut pas être zéro. Vérifiez les lignes du BL.',
          variant: 'destructive',
        });
        return;
      }

      // ── Unique-number check: ensure no existing invoice has a duplicate base number ─
      const todayDate = new Date().toISOString().split('T')[0];
      const inv = addInvoice({
        clientId: data.clientId,
        lines: data.lines,
        date: todayDate,
        dueDate: data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'pending',
        notes: data.notes || `Facture sur BL ${data.blNumber}`,
        totals: data.totals,
        paymentMethod: data.paymentMethod as any,
        paymentRef: data.paymentRef,
        blId: blId,
      });

      // Update BL with the generated invoice id for audit trail
      data.setInvoiceId(inv.id);
      toast({
        title: '✅ Facture créée',
        description: `Facture pré-remplie depuis ${blNumber} — Total TTC : ${data.totals.totalTTC.toLocaleString('fr-MA')} MAD`,
      });
      navigate(`/invoices/${inv.id}`);
    } catch (err: any) {
      toast({ title: '❌ Erreur', description: err.message ?? 'Génération échouée', variant: 'destructive' });
    } finally {
      setConvertingId(null);
    }
  };

  const currentYearClosed = isYearClosed(new Date().getFullYear());

  // Detect if viewing a single closed year
  const viewingClosedYear = useMemo(() => {
    if (filtered.length > 0) {
      const years = new Set(filtered.map(b => new Date(b.date).getFullYear()));
      if (years.size === 1) {
        const yr = [...years][0];
        if (isYearClosed(yr)) return yr;
      }
    }
    return null;
  }, [filtered, isYearClosed]);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Closed Year Banner */}
      {viewingClosedYear && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
          <Lock className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm font-semibold text-destructive">
            Exercice {viewingClosedYear} Clôturé — Consultation Uniquement
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bons de Livraison</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} bons de livraison</p>
        </div>
        {!currentYearClosed && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau BL
          </button>
        )}
      </div>
      <div className="gold-accent-line w-24" />

      {/* Workflow */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-primary font-medium overflow-x-auto">
        <Link to="/devis" className="px-2.5 py-1 rounded-full bg-primary/20 text-xs font-bold hover:bg-primary/30 transition-colors whitespace-nowrap">Devis</Link>
        <ArrowRight className="w-4 h-4 flex-shrink-0" />
        <Link to="/bc" className="px-2.5 py-1 rounded-full bg-primary/20 text-xs font-bold hover:bg-primary/30 transition-colors whitespace-nowrap">Bon de Commande</Link>
        <ArrowRight className="w-4 h-4 flex-shrink-0" />
        <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold whitespace-nowrap">Bon de Livraison</span>
        <ArrowRight className="w-4 h-4 flex-shrink-0" />
        <Link to="/invoices" className="px-2.5 py-1 rounded-full bg-primary/20 text-xs font-bold hover:bg-primary/30 transition-colors whitespace-nowrap">Facture</Link>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'prepared', 'delivered', 'signed', 'invoiced'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {s === 'all' ? 'Tous' : STATUS_MAP[s].label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Truck className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">Aucun bon de livraison</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">N° BL</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.client}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total HT</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(bl => {
                const client = clients.find(c => c.id === bl.clientId);
                const { cls } = STATUS_MAP[bl.status];
                // Determine linking state
                const hasSourceInvoice = !!bl.sourceInvoiceId;
                const blYearClosed = isYearClosed(new Date(bl.date).getFullYear());
                const canInvoice = !bl.isConverted && bl.status !== 'invoiced' && !hasSourceInvoice && !blYearClosed;
                return (
                  <tr key={bl.id} className="hover:bg-muted/20 transition-colors">
                     <td className="px-5 py-3.5">
                       <p className="text-sm font-bold text-foreground font-mono">{bl.number}</p>
                       {bl.bcId && <p className="text-[10px] text-muted-foreground mt-0.5">BC: {bl.bcId}</p>}
                       {bl.sourceInvoiceId && (
                         <Link
                           to={`/invoices/${bl.sourceInvoiceId}`}
                           className="text-[10px] text-primary mt-0.5 hover:underline flex items-center gap-0.5"
                         >
                           <ExternalLink className="w-2.5 h-2.5" />
                           Facture source : {invoices.find(i => i.id === bl.sourceInvoiceId)?.number || bl.sourceInvoiceId}
                         </Link>
                       )}
                       {bl.isConverted && bl.convertedToId && !bl.sourceInvoiceId && (
                         <Link
                           to={`/invoices/${bl.convertedToId}`}
                           className="text-[10px] text-primary mt-0.5 hover:underline flex items-center gap-0.5"
                         >
                           <ExternalLink className="w-2.5 h-2.5" />
                           Lien vers Facture : {invoices.find(i => i.id === bl.convertedToId)?.number || bl.convertedToId}
                         </Link>
                       )}
                     </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-foreground">{client?.businessName || '—'}</p>
                      <p className="text-xs text-muted-foreground">{client?.city}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <p className="text-sm text-foreground">{new Date(bl.date).toLocaleDateString('fr-MA')}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(bl.totals.subtotalHT)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <select
                        value={bl.status}
                        onChange={e => updateBL(bl.id, { status: e.target.value as BLStatus })}
                        className={cn('text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none', cls)}
                      >
                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                         {hasSourceInvoice ? (
                          <Link
                            to={`/invoices/${bl.sourceInvoiceId}`}
                            title="Voir la Facture Source"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <ExternalLink className="w-3 h-3" />Voir Facture Source
                          </Link>
                         ) : bl.isConverted ? (
                          <Link
                            to={bl.convertedToId ? `/invoices/${bl.convertedToId}` : '/invoices'}
                            title="Voir la Facture liée"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <ExternalLink className="w-3 h-3" />Voir Facture
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleGenerateInvoice(bl.id, bl.number)}
                            disabled={convertingId === bl.id}
                            title="Générer une Facture"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <FileText className={cn('w-3 h-3', convertingId === bl.id && 'animate-spin')} />
                            {convertingId === bl.id ? 'Génération...' : 'Générer Facture'}
                          </button>
                        )}
                        <button
                          onClick={() => setPrintDoc(bl)}
                          title="Aperçu / Imprimer"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTimelineDocId(bl.id)}
                          title="Historique"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        {!blYearClosed && (
                          <button
                            onClick={() => deleteBL(bl.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateDocumentModal
          type="bl"
          onClose={() => setShowCreate(false)}
          onCreate={(data) => { addBL(data as any); setShowCreate(false); }}
        />
      )}

      {/* Print preview modal */}
      {printDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="no-print flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Aperçu — {printDoc.number}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
                >
                  <Printer className="w-4 h-4" />Imprimer
                </button>
                <button
                  onClick={() => setPrintDoc(null)}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20"
                >
                  Fermer
                </button>
              </div>
            </div>
            <DocumentPrint
              kind="bl"
              number={printDoc.number}
              date={printDoc.date}
              clientId={printDoc.clientId}
              lines={printDoc.lines}
              totals={printDoc.totals}
              notes={printDoc.notes}
              sourceRef={printDoc.bcId ? `Réf. BC : ${printDoc.bcId}` : undefined}
              paymentMethod={printDoc.paymentMethod}
              paymentRef={printDoc.paymentRef}
            />
          </div>
        </div>
      )}

      {/* Timeline modal */}
      {timelineDocId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-auto p-6" onClick={() => setTimelineDocId(null)}>
          <div className="max-w-2xl mx-auto mt-20" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Historique du document</h2>
              <button onClick={() => setTimelineDocId(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20">Fermer</button>
            </div>
            <DocumentTimeline documentId={timelineDocId} />
          </div>
        </div>
      )}
    </div>
  );
}

