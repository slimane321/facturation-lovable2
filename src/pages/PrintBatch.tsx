import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency, amountToFrenchWords } from '@/lib/moroccanUtils';
import { shortFingerprint, shortSignature } from '@/lib/hashUtils';
import { QRCodeSVG } from 'qrcode.react';
import { buildQRData } from '@/lib/moroccanUtils';

export default function PrintBatch() {
  const [searchParams] = useSearchParams();
  const { invoices, clients } = useData();
  const { settings } = useSettings();

  const ids = searchParams.getAll('id');

  const selectedInvoices = useMemo(
    () => ids.map(id => invoices.find(i => i.id === id)).filter(Boolean),
    [ids, invoices]
  );

  useEffect(() => {
    if (selectedInvoices.length > 0) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [selectedInvoices]);

  if (selectedInvoices.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Aucune facture sélectionnée.</div>;
  }

  return (
    <div className="print-batch">
      {selectedInvoices.map((inv, idx) => {
        if (!inv) return null;
        const client = clients.find(c => c.id === inv.clientId);
        const qrData = buildQRData({
          invoiceNumber: inv.number,
          date: inv.date,
          sellerICE: settings.ice,
          clientICE: client?.ice || '',
          totalTTC: inv.totals.totalTTC,
          totalTVA: inv.totals.totalTVA,
        });

        return (
          <div key={inv.id} className="invoice-surface shadow-none border border-border" style={{ pageBreakAfter: idx < selectedInvoices.length - 1 ? 'always' : 'auto', marginBottom: '2rem' }}>
            {/* Header band */}
            <div className="invoice-header-band px-8 py-6 flex justify-between items-start">
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
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-primary-foreground tracking-tight">
                  {inv.status === 'avoir' ? 'AVOIR' : 'FACTURE'}
                </p>
                <p className="text-xl font-mono font-bold mt-1 text-accent">{inv.number}</p>
                <p className="text-primary-foreground/70 text-sm mt-2">
                  Date : {new Date(inv.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="gold-accent-line" />

            {/* Client */}
            <div className="px-8 py-5 flex justify-end">
              <div className="bg-muted/40 rounded-xl p-5 min-w-[300px] border border-border">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Client</p>
                <p className="font-bold text-foreground text-base">{client?.businessName || '—'}</p>
                {client?.ice && <p className="text-sm text-muted-foreground mt-1">ICE : {client.ice}</p>}
                {client?.ifNumber && <p className="text-sm text-muted-foreground">IF : {client.ifNumber}</p>}
                <p className="text-sm text-muted-foreground mt-1">{client?.address}</p>
                <p className="text-sm text-muted-foreground">{client?.city}</p>
              </div>
            </div>

            {/* Lines */}
            <div className="px-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="text-left px-4 py-2.5 rounded-l-lg font-semibold">Désignation</th>
                    <th className="text-right px-3 py-2.5 font-semibold w-16">Qté</th>
                    <th className="text-right px-3 py-2.5 font-semibold w-28">P.U. HT</th>
                    <th className="text-center px-3 py-2.5 font-semibold w-16">TVA</th>
                    <th className="text-right px-4 py-2.5 rounded-r-lg font-semibold w-32">Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((line, li) => {
                    const lineHT = line.quantity * line.unitPrice;
                    const lineVAT = lineHT * (line.vatRate / 100);
                    return (
                      <tr key={line.id} className={li % 2 === 0 ? 'bg-muted/20' : ''}>
                        <td className="px-4 py-3 text-foreground">{line.description}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{line.quantity}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{line.vatRate}%</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">{formatCurrency(lineHT + lineVAT)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-8 py-6 flex justify-end">
              <div className="min-w-[280px] space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total HT</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(inv.totals.subtotalHT)}</span>
                </div>
                {inv.totals.vatBreakdown.filter(v => v.amount > 0).map(v => (
                  <div key={v.rate} className="flex justify-between">
                    <span className="text-muted-foreground">TVA {v.rate}%</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(v.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
                  <span className="text-foreground">Total TTC</span>
                  <span className="text-primary tabular-nums">{formatCurrency(inv.totals.totalTTC)}</span>
                </div>
                <p className="text-xs text-muted-foreground italic mt-1">
                  Arrêtée la présente facture à la somme de : {amountToFrenchWords(inv.totals.totalTTC)}
                </p>
              </div>
            </div>

            {/* Hash & QR */}
            <div className="px-8 pb-4 flex items-end justify-between gap-4">
              <div className="space-y-1">
                {inv.hash && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Empreinte : {shortFingerprint(inv.hash)}
                  </p>
                )}
                {inv.signature && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Signature : {shortSignature(inv.signature)}
                  </p>
                )}
              </div>
              <QRCodeSVG value={qrData} size={64} level="M" />
            </div>

            {/* Footer */}
            <div className="invoice-header-band px-8 py-4">
              <div className="text-xs text-primary-foreground/80">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                  <div className="space-y-0.5">
                    <p className="font-bold text-primary-foreground">{settings.name}</p>
                    <p>{settings.address} — {settings.city}</p>
                  </div>
                  {settings.rib && (
                    <div className="text-right space-y-0.5">
                      <p>{settings.bank} — RIB : {settings.rib}</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-primary-foreground/20 pt-2 flex flex-wrap gap-x-5 justify-center text-[10px] text-primary-foreground/70">
                  {settings.rc && <span>RC : {settings.rc}</span>}
                  {settings.ifNumber && <span>IF : {settings.ifNumber}</span>}
                  {settings.ice && <span>ICE : {settings.ice}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
