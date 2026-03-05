import type { InvoiceTotals } from '@/lib/moroccanUtils';
import { cn } from '@/lib/utils';

interface Props {
  totals: InvoiceTotals;
  isAvoir: boolean;
}

export default function InvoiceVatTable({ totals, isAvoir }: Props) {
  return (
    <div className="w-full lg:w-auto space-y-0">
      {/* VAT breakdown table */}
      {totals.vatBreakdown.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Détail de la TVA
          </p>
          <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-muted/60">
                <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Taux</th>
                <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground">Base HT</th>
                <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground">Montant TVA</th>
              </tr>
            </thead>
            <tbody>
              {totals.vatBreakdown.map(vb => (
                <tr key={vb.rate} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium">{vb.rate}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {vb.base.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color: 'hsl(var(--gold-foreground))' }}>
                    {vb.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals summary */}
      <div className="space-y-1.5 min-w-[260px]">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total HT</span>
          <span className="font-semibold tabular-nums">
            {totals.subtotalHT.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total TVA</span>
          <span className="tabular-nums font-semibold" style={{ color: 'hsl(var(--gold-foreground))' }}>
            {totals.totalTVA.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
          </span>
        </div>
        {totals.timbreAmount && totals.timbreAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Droit de Timbre (0,25%)</span>
            <span className="tabular-nums font-semibold" style={{ color: 'hsl(var(--gold-foreground))' }}>
              {totals.timbreAmount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
            </span>
          </div>
        )}
        <div className="border-t-2 border-primary pt-2 mt-2 flex justify-between items-baseline">
          <span className="font-bold text-foreground text-base">Total TTC</span>
          <span className={cn(
            'text-xl font-black tabular-nums',
            isAvoir ? 'text-destructive' : 'text-primary'
          )}>
            {isAvoir ? '-' : ''}
            {Math.abs(totals.totalTTC).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
          </span>
        </div>
      </div>
    </div>
  );
}
