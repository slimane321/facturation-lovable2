import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocuments } from '@/contexts/DocumentContext';
import { useData } from '@/contexts/DataContext';
import { useLang } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { Plus, ShoppingCart, ArrowRight, Trash2, GitMerge, Printer, ExternalLink, Clock } from 'lucide-react';
import type { BCStatus, BonCommande as BonCommandeType } from '@/contexts/DocumentContext';
import { cn } from '@/lib/utils';
import CreateDocumentModal from '@/components/documents/CreateDocumentModal';
import DocumentPrint from '@/components/documents/DocumentPrint';
import DocumentTimeline from '@/components/documents/DocumentTimeline';
import { toast } from '@/hooks/use-toast';

const STATUS_MAP: Record<BCStatus, { label: string; cls: string }> = {
  pending:   { label: 'En attente', cls: 'bg-yellow-50 text-yellow-700' },
  confirmed: { label: 'Confirmé', cls: 'bg-blue-50 text-blue-700' },
  received:  { label: 'Reçu', cls: 'bg-green-50 text-green-700' },
  converted: { label: 'Livré/Facturé', cls: 'bg-primary/10 text-primary' },
};

export default function BonCommande() {
  const { bcList, addBC, updateBC, deleteBC, convertBCToBL } = useDocuments();
  const { clients } = useData();
  const { t } = useLang();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BCStatus | 'all'>('all');
  const [printDoc, setPrintDoc] = useState<BonCommandeType | null>(null);
  const [timelineDocId, setTimelineDocId] = useState<string | null>(null);
  /** Per-document loading lock — prevents double-click during async conversion */
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    bcList
      .filter(d => statusFilter === 'all' || d.status === statusFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [bcList, statusFilter]
  );

  const handleConvertToBL = (bcId: string, bcNumber: string) => {
    // Lock: already converting or already converted
    if (convertingId === bcId) return;
    const bc = bcList.find(b => b.id === bcId);
    if (bc?.isConverted) {
      toast({ title: '⚠️ Déjà converti', description: 'Ce document a déjà été converti.', variant: 'destructive' });
      return;
    }
    setConvertingId(bcId);
    try {
      const bl = convertBCToBL(bcId);
      toast({ title: '✅ Bon de Livraison créé', description: `${bl.number} créé depuis ${bcNumber}` });
      navigate('/bl');
    } catch (err: any) {
      toast({ title: '❌ Erreur', description: err.message ?? 'Conversion échouée', variant: 'destructive' });
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bons de Commande</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} bons de commande</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau BC
        </button>
      </div>
      <div className="gold-accent-line w-24" />

      {/* Workflow */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-primary font-medium overflow-x-auto">
        <Link to="/devis" className="px-2.5 py-1 rounded-full bg-primary/20 text-xs font-bold hover:bg-primary/30 transition-colors whitespace-nowrap">Devis</Link>
        <ArrowRight className="w-4 h-4 flex-shrink-0" />
        <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold whitespace-nowrap">Bon de Commande</span>
        <ArrowRight className="w-4 h-4 flex-shrink-0" />
        <Link to="/bl" className="px-2.5 py-1 rounded-full bg-primary/20 text-xs font-bold hover:bg-primary/30 transition-colors whitespace-nowrap">Bon de Livraison</Link>
        <ArrowRight className="w-4 h-4 flex-shrink-0" />
        <Link to="/invoices" className="px-2.5 py-1 rounded-full bg-primary/20 text-xs font-bold hover:bg-primary/30 transition-colors whitespace-nowrap">Facture</Link>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'pending', 'confirmed', 'received', 'converted'] as const).map(s => (
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
            <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">Aucun bon de commande</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">N° BC</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.client}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.totalTTC}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(bc => {
                const client = clients.find(c => c.id === bc.clientId);
                const { cls } = STATUS_MAP[bc.status];
                // Block conversion if already converted to a BL
                const canConvert = !bc.isConverted && bc.status !== 'converted';
                return (
                  <tr key={bc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-bold text-foreground font-mono">{bc.number}</p>
                      {bc.devisId && <p className="text-[10px] text-muted-foreground mt-0.5">DV: {bc.devisId}</p>}
                      {bc.convertedToBLId && <p className="text-[10px] text-primary mt-0.5">→ BL créé</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-foreground">{client?.businessName || '—'}</p>
                      <p className="text-xs text-muted-foreground">{client?.city}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <p className="text-sm text-foreground">{new Date(bc.date).toLocaleDateString('fr-MA')}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(bc.totals.totalTTC)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <select
                        value={bc.status}
                        onChange={e => updateBC(bc.id, { status: e.target.value as BCStatus })}
                        className={cn('text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none', cls)}
                      >
                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                         {bc.isConverted ? (
                          <Link
                            to="/bl"
                            title="Voir le Bon de Livraison lié"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <ExternalLink className="w-3 h-3" />Voir BL
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleConvertToBL(bc.id, bc.number)}
                            disabled={convertingId === bc.id}
                            title="Convertir en Bon de Livraison"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <GitMerge className={cn('w-3 h-3', convertingId === bc.id && 'animate-spin')} />
                            {convertingId === bc.id ? 'Conversion...' : '→ BL'}
                          </button>
                        )}
                        <button
                          onClick={() => setPrintDoc(bc)}
                          title="Aperçu / Imprimer"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTimelineDocId(bc.id)}
                          title="Historique"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteBC(bc.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          type="bc"
          onClose={() => setShowCreate(false)}
          onCreate={(data) => { addBC(data as any); setShowCreate(false); }}
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
              kind="bc"
              number={printDoc.number}
              date={printDoc.date}
              clientId={printDoc.clientId}
              lines={printDoc.lines}
              totals={printDoc.totals}
              notes={printDoc.notes}
              sourceRef={printDoc.devisId ? `Réf. Devis : ${printDoc.devisId}` : undefined}
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

