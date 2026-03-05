import { useState, useMemo } from 'react';
import { useDocuments } from '@/contexts/DocumentContext';
import { formatCurrency } from '@/lib/moroccanUtils';
import { Plus, ShoppingBag, Download, Trash2 } from 'lucide-react';
import type { AchatStatus } from '@/contexts/DocumentContext';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useData } from '@/contexts/DataContext';
import CreateAchatModal from '@/components/documents/CreateAchatModal';

const STATUS_MAP: Record<AchatStatus, { label: string; cls: string }> = {
  pending:  { label: 'En attente', cls: 'bg-yellow-50 text-yellow-700' },
  received: { label: 'Reçu', cls: 'bg-blue-50 text-blue-700' },
  paid:     { label: 'Payé', cls: 'bg-green-50 text-green-700' },
};

export default function Achats() {
  const { achatsList, deleteAchat, updateAchat } = useDocuments();
  const { invoices } = useData();
  const [showCreate, setShowCreate] = useState(false);

  // "Sent to DGI" = validated/paid invoices (factures émises)
  const sentInvoices = useMemo(
    () => invoices.filter(i => i.status === 'validated' || i.status === 'paid'),
    [invoices]
  );

  const handleExportAchats = () => {
    const headers = ['N° Fournisseur', 'Fournisseur', 'ICE', 'Date', 'HT', 'TVA', 'TTC', 'Statut'];
    const rows = achatsList.map(a => [
      a.supplierInvoiceNumber, a.supplierName, a.supplierICE || '',
      a.date, a.totals.subtotalHT.toFixed(2), a.totals.totalTVA.toFixed(2), a.totals.totalTTC.toFixed(2), a.status,
    ].join(';'));
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `achats-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">E-Facture & Achats</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tableau de bord e-Facture DGI 2026</p>
        </div>
      </div>
      <div className="gold-accent-line w-24" />

      {/* DGI Status Banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
        <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Plateforme DGI — Intégration en attente</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            L'API e-Facture de la DGI est en cours de déploiement. Les factures validées sont prêtes pour la transmission automatique.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">Bientôt disponible</span>
      </div>

      <Tabs defaultValue="sent">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="sent" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            📤 Envoyées à la DGI ({sentInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="received" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            📥 Reçues des fournisseurs ({achatsList.length})
          </TabsTrigger>
        </TabsList>

        {/* Sent tab */}
        <TabsContent value="sent">
          <div className="bg-card rounded-xl border shadow-card overflow-hidden mt-4">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Factures émises — Prêtes DGI</p>
                <p className="text-xs text-muted-foreground mt-0.5">Factures validées et payées, conformes à la réglementation 2026</p>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">N° Facture</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TTC</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TVA</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut DGI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sentInvoices.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground text-sm">Aucune facture validée</td></tr>
                ) : sentInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3.5 font-mono text-sm font-bold text-foreground">{inv.number}</td>
                    <td className="px-4 py-3.5 text-sm text-foreground">{new Date(inv.date).toLocaleDateString('fr-MA')}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-bold text-primary tabular-nums">{formatCurrency(inv.totals.totalTTC)}</td>
                    <td className="px-4 py-3.5 text-right text-sm tabular-nums text-muted-foreground">{formatCurrency(inv.totals.totalTVA)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                        En attente API
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Received tab */}
        <TabsContent value="received">
          <div className="bg-card rounded-xl border shadow-card overflow-hidden mt-4">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Factures reçues des fournisseurs</p>
                <p className="text-xs text-muted-foreground mt-0.5">TVA déductible — Achats et charges</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportAchats}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">N° Fournisseur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fournisseur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TTC</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TVA</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {achatsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-20 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Aucun achat enregistré</p>
                    </td>
                  </tr>
                ) : achatsList.map(a => {
                  const { cls, label } = STATUS_MAP[a.status];
                  return (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3.5 font-mono text-sm font-bold text-foreground">{a.supplierInvoiceNumber}</td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-foreground">{a.supplierName}</p>
                        {a.supplierICE && <p className="text-xs text-muted-foreground">ICE : {a.supplierICE}</p>}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-sm text-foreground">{new Date(a.date).toLocaleDateString('fr-MA')}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-primary tabular-nums">{formatCurrency(a.totals.totalTTC)}</td>
                      <td className="px-4 py-3.5 text-right text-sm tabular-nums text-muted-foreground">{formatCurrency(a.totals.totalTVA)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <select
                          value={a.status}
                          onChange={e => updateAchat(a.id, { status: e.target.value as AchatStatus })}
                          className={cn('text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none', cls)}
                        >
                          {Object.entries(STATUS_MAP).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => deleteAchat(a.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {showCreate && <CreateAchatModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
