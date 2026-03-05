import { useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useRole } from '@/contexts/RoleContext';
import type { InvoiceStatus } from '@/contexts/DataContext';
import { formatCurrency, calculateTotals } from '@/lib/moroccanUtils';
import { generateUBLXml, downloadXml } from '@/lib/ublGenerator';
import { parseUBLXml } from '@/lib/ublImporter';
import { Plus, FileText, Eye, Undo2, Search, CalendarIcon, X, Download, CheckSquare, Printer, Send, FileCode, CheckCircle, XCircle, Clock, Upload, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

function StatusBadge({ status, isOverdue, isPartial }: { status: InvoiceStatus; isOverdue?: boolean; isPartial?: boolean }) {
  if (isPartial) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gold/15 text-gold-foreground">Partiellement payée</span>;
  }
  if (isOverdue) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/15 text-destructive">En retard</span>;
  }
  const map: Record<InvoiceStatus, { cls: string; label: string }> = {
    validated: { cls: 'badge-validated', label: 'Validée' },
    paid:      { cls: 'badge-paid',      label: 'Payée' },
    pending:   { cls: 'badge-pending',   label: 'En attente' },
    avoir:     { cls: 'badge-avoir',     label: 'Avoir' },
    draft:     { cls: 'text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground', label: 'Brouillon' },
    cancelled: { cls: 'text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive', label: 'Annulée' },
  };
  const { cls, label } = map[status] || map.draft;
  return <span className={cls}>{label}</span>;
}

const STATUS_FILTERS: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'Toutes' },
  { value: 'pending',   label: 'En attente' },
  { value: 'validated', label: 'Validées' },
  { value: 'paid',      label: 'Payées' },
  { value: 'avoir',     label: 'Avoirs' },
];

export default function Invoices() {
  const { t } = useLang();
  const { invoices, clients, createAvoir, updateInvoice, addClient, addInvoice } = useData();
  const { settings, closedYears, isYearClosed } = useSettings();
  const { can } = useRole();
  const navigate = useNavigate();
  const [avoirLoading, setAvoirLoading] = useState<string | null>(null);
  const xmlImportRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter]     = useState<InvoiceStatus | 'all'>('all');
  const [search, setSearch]     = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const hasDateFilter = dateFrom || dateTo;

  const filtered = useMemo(() => {
    return invoices
      .filter(i => filter === 'all' || i.status === filter)
      .filter(i => clientFilter === 'all' || i.clientId === clientFilter)
      .filter(i => {
        if (!search) return true;
        const client = clients.find(c => c.id === i.clientId);
        return (
          i.number.toLowerCase().includes(search.toLowerCase()) ||
          client?.businessName.toLowerCase().includes(search.toLowerCase())
        );
      })
      .filter(i => {
        if (dateFrom && i.date < dateFrom) return false;
        if (dateTo   && i.date > dateTo)   return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices, clients, filter, search, clientFilter, dateFrom, dateTo]);

  const totalTTC = useMemo(
    () => filtered.reduce((s, i) => s + (i.status !== 'avoir' ? i.totals.totalTTC : 0), 0),
    [filtered]
  );

  const handleAvoir = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (avoirLoading === id) return;

    const invoice = invoices.find(i => i.id === id);
    // ── Duplicate avoir guard ─────────────────────────────────────────────
    if (invoice?.hasAvoir) {
      const avoirNum = invoices.find(i => i.id === invoice.avoirId)?.number;
      alert(`Un avoir existe déjà pour cette facture${avoirNum ? ` (${avoirNum})` : ''}.`);
      return;
    }

    if (confirm('Créer un avoir pour cette facture ?')) {
      setAvoirLoading(id);
      try {
        const avoir = createAvoir(id);
        navigate(`/invoices/${avoir.id}`);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setAvoirLoading(null);
      }
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilter('all');
    setClientFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
  };

  const handleExportCSV = () => {
    const headers = ['N° Facture', 'Client', 'ICE', 'Date', 'HT', 'TVA', 'TTC', 'Statut', 'N° DGI', 'Signature Numérique'];
    const rows = filtered.map(inv => {
      const client = clients.find(c => c.id === inv.clientId);
      return [
        inv.number,
        client?.businessName || '',
        client?.ice ? `="${client.ice}"` : '',
        inv.date,
        inv.totals.subtotalHT.toFixed(2),
        inv.totals.totalTVA.toFixed(2),
        inv.totals.totalTTC.toFixed(2),
        inv.status,
        inv.dgiRegistrationNumber || '',
        inv.signature ? inv.signature.substring(0, 12).toUpperCase() : '',
      ].join(';');
    });
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factures-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkExportCSV = () => {
    if (selected.size === 0) return;
    const selectedInvoices = filtered.filter(i => selected.has(i.id));
    const headers = ['N° Facture', 'Client', 'ICE', 'Date', 'HT', 'TVA', 'TTC', 'Statut', 'N° DGI', 'Signature Numérique'];
    const rows = selectedInvoices.map(inv => {
      const client = clients.find(c => c.id === inv.clientId);
      return [
        inv.number,
        client?.businessName || '',
        client?.ice ? `="${client.ice}"` : '',
        inv.date,
        inv.totals.subtotalHT.toFixed(2),
        inv.totals.totalTVA.toFixed(2),
        inv.totals.totalTTC.toFixed(2),
        inv.status,
        inv.dgiRegistrationNumber || '',
        inv.signature ? inv.signature.substring(0, 12).toUpperCase() : '',
      ].join(';');
    });
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factures-selection-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTransmitDGI = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    // Simulate DGI API call (random success/fail)
    const success = Math.random() > 0.3;
    if (success) {
      updateInvoice(invoiceId, { dgiStatus: 'accepted' } as any);
      toast({ title: 'Transmission DGI réussie ✓', description: `${inv.number} acceptée par la DGI.` });
    } else {
      updateInvoice(invoiceId, { dgiStatus: 'rejected' } as any);
      toast({ title: 'Échec transmission DGI', description: 'Téléchargez le XML pour upload manuel sur Simpl.', variant: 'destructive' });
    }
  };

  const handleDownloadXml = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const client = clients.find(c => c.id === inv.clientId);
    if (!client) return;
    const xml = generateUBLXml(inv, client, settings);
    downloadXml(xml, `${inv.number.replace(/\//g, '-')}.xml`);
    if (!inv.dgiStatus || inv.dgiStatus === 'rejected') {
      updateInvoice(invoiceId, { dgiStatus: 'manual' } as any);
    }
    toast({ title: 'XML téléchargé ✓', description: `Fichier UBL 2.1 pour ${inv.number}` });
  };

  const handleImportXml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseUBLXml(reader.result as string);
        // Find or create client
        let clientId = clients.find(c => c.ice === parsed.clientICE && parsed.clientICE)?.id
          || clients.find(c => c.businessName === parsed.clientName)?.id;
        if (!clientId && parsed.clientName) {
          const newClient = addClient({
            clientType: 'company',
            businessName: parsed.clientName,
            ice: parsed.clientICE,
            ifNumber: parsed.clientIF,
            address: parsed.clientAddress,
            city: parsed.clientCity,
          });
          clientId = newClient.id;
        }
        if (!clientId) {
          toast({ title: 'Client introuvable dans le XML', variant: 'destructive' });
          return;
        }
        const totals = calculateTotals(parsed.lines);
        const inv = addInvoice({
          date: parsed.date,
          dueDate: parsed.dueDate,
          clientId,
          lines: parsed.lines,
          status: 'draft',
          totals,
        });
        toast({ title: 'Facture importée ✓', description: `${parsed.lines.length} ligne(s) importée(s).` });
        navigate(`/invoices/${inv.id}`);
      } catch {
        toast({ title: 'Erreur de lecture du fichier XML', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeFilterCount = [
    filter !== 'all',
    clientFilter !== 'all',
    !!dateFrom,
    !!dateTo,
    !!search,
  ].filter(Boolean).length;

  // Detect if the current date filter points to a closed year
  const viewingClosedYear = useMemo(() => {
    if (dateFrom && dateTo) {
      const fromYear = new Date(dateFrom).getFullYear();
      const toYear = new Date(dateTo).getFullYear();
      if (fromYear === toYear && isYearClosed(fromYear)) return fromYear;
    }
    // If all filtered invoices belong to a single closed year
    if (filtered.length > 0) {
      const years = new Set(filtered.map(i => new Date(i.date).getFullYear()));
      if (years.size === 1) {
        const yr = [...years][0];
        if (isYearClosed(yr)) return yr;
      }
    }
    return null;
  }, [filtered, dateFrom, dateTo, isYearClosed]);

  // Check if any closed year exists (to show a general warning if creating)
  const currentYearClosed = isYearClosed(new Date().getFullYear());

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.invoices}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} {t.invoicesOf} •{' '}
            <span className="font-semibold text-primary">{formatCurrency(totalTTC)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button
                onClick={handleBulkExportCSV}
                className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-semibold hover:bg-primary/20 transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                Exporter sélection ({selected.size})
              </button>
              <button
                onClick={() => {
                  const ids = Array.from(selected);
                  const params = new URLSearchParams();
                  ids.forEach(id => params.append('id', id));
                  const printWindow = window.open(`/print-batch?${params.toString()}`, '_blank');
                  if (printWindow) {
                    printWindow.addEventListener('afterprint', () => printWindow.close());
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimer sélection ({selected.size})
              </button>
            </>
          )}
          <button
            onClick={() => xmlImportRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importer XML
          </button>
          <input ref={xmlImportRef} type="file" accept=".xml" className="hidden" onChange={handleImportXml} />
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            {t.exportCSV}
          </button>
          {!currentYearClosed && can('create_invoice') && (
            <Link
              to="/invoices/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {t.createInvoice}
            </Link>
          )}
        </div>
      </div>
      <div className="gold-accent-line w-24" />

      {/* ── Filters bar ── */}
      <div className="space-y-3">
        {/* Row 1: search + status pills */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  filter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: client filter + date range */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Client dropdown */}
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 min-w-[160px]"
          >
            <option value="all">{t.allClients}</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.businessName}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <span className="text-muted-foreground text-sm">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {hasDateFilter && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
                title="Effacer les dates"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-2 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Réinitialiser ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">{t.noInvoices}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.invoiceNumber}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.client}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">{t.date}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.totalTTC}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.status}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Transmission DGI</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(inv => {
                const client = clients.find(c => c.id === inv.clientId);
                return (
                  <tr key={inv.id} className={cn('hover:bg-muted/20 transition-colors', selected.has(inv.id) && 'bg-primary/5')}>
                    <td className="px-3 py-3.5">
                      <Checkbox
                        checked={selected.has(inv.id)}
                        onCheckedChange={() => toggleSelect(inv.id)}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      {inv.number === 'BROUILLON' ? (
                        <p className="text-sm font-bold font-mono text-muted-foreground">BROUILLON</p>
                      ) : (
                        <p className="text-sm font-bold font-mono text-primary">{inv.number}</p>
                      )}
                      {inv.originalInvoiceId && (
                        <p className="text-[10px] text-muted-foreground">
                          Avoir de {invoices.find(i => i.id === inv.originalInvoiceId)?.number}
                        </p>
                      )}
                      {inv.blId && (
                        <p className="text-[10px] text-primary">→ BL lié</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-foreground">{client?.businessName || '—'}</p>
                      <p className="text-xs text-muted-foreground">{client?.city}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <p className="text-sm text-foreground">{new Date(inv.date).toLocaleDateString('fr-MA')}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className={cn(
                        'text-sm font-bold tabular-nums',
                        inv.status === 'avoir' ? 'text-destructive' : 'text-primary'
                      )}>
                        {inv.status === 'avoir' ? '-' : ''}{formatCurrency(Math.abs(inv.totals.totalTTC))}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge
                        status={inv.status}
                        isOverdue={inv.status === 'validated' && !(inv.totalPaid && inv.totalPaid > 0) && !!inv.dueDate && inv.dueDate < new Date().toISOString().split('T')[0]}
                        isPartial={inv.status === 'validated' && (inv.totalPaid || 0) > 0 && (inv.totalPaid || 0) < inv.totals.totalTTC}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                      {(inv.status === 'validated' || inv.status === 'paid' || inv.status === 'avoir') ? (
                        <div className="flex items-center justify-center gap-1">
                          {inv.dgiStatus === 'accepted' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary whitespace-nowrap flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Acceptée
                              </span>
                              {inv.dgiRegistrationNumber && (
                                <span className="text-[8px] font-mono text-muted-foreground">{inv.dgiRegistrationNumber}</span>
                              )}
                            </div>
                          ) : inv.dgiStatus === 'rejected' ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive whitespace-nowrap flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Rejetée
                              </span>
                              <button
                                onClick={(e) => { e.preventDefault(); handleDownloadXml(inv.id); }}
                                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Télécharger XML pour Simpl"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : inv.dgiStatus === 'manual' ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/15 text-gold-foreground whitespace-nowrap flex items-center gap-1">
                              <FileCode className="w-3 h-3" /> Manuel
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.preventDefault(); handleTransmitDGI(inv.id); }}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap flex items-center gap-1"
                                title="Transmettre à la DGI"
                              >
                                <Send className="w-3 h-3" /> Transmettre
                              </button>
                              <button
                                onClick={(e) => { e.preventDefault(); handleDownloadXml(inv.id); }}
                                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Télécharger XML UBL 2.1"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : inv.status === 'draft' || inv.status === 'pending' ? (
                        <span
                          className="text-[10px] text-muted-foreground cursor-default"
                          title="Seules les factures validées avec un numéro officiel et Hash peuvent être transmises à la DGI"
                        >
                          🔒 Non validée
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Voir"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        {inv.status === 'validated' && !isYearClosed(new Date(inv.date).getFullYear()) && (
                          inv.hasAvoir ? (
                            <span
                              title={`Avoir déjà créé${invoices.find(i => i.id === inv.avoirId)?.number ? ` — ${invoices.find(i => i.id === inv.avoirId)?.number}` : ''}`}
                              className="p-1.5 rounded-md text-muted-foreground opacity-40 cursor-not-allowed"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              onClick={e => handleAvoir(inv.id, e)}
                              disabled={avoirLoading === inv.id}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-gold-foreground hover:bg-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={t.createAvoir}
                            >
                              <Undo2 className={cn('w-3.5 h-3.5', avoirLoading === inv.id && 'animate-spin')} />
                            </button>
                          )
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
    </div>
  );
}
