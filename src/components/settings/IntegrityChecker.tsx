import { useState, useEffect, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { verifyChain, shortFingerprint, shortSignature } from '@/lib/hashUtils';
import { ShieldCheck, Loader2, CheckCircle2, XCircle, AlertTriangle, Bell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function IntegrityChecker() {
  const { invoices, clients } = useData();
  const [result, setResult] = useState<{ valid: boolean; brokenAt?: string; details?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [autoCheck, setAutoCheck] = useState(true);

  const getHashedInvoices = useCallback(() => {
    return invoices
      .filter(i => i.hash && (i.status === 'validated' || i.status === 'paid' || i.status === 'avoir'))
      .sort((a, b) => a.number.localeCompare(b.number))
      .map(i => ({
        number: i.number,
        date: i.date,
        clientICE: clients.find(c => c.id === i.clientId)?.ice || '',
        totalTTC: i.totals.totalTTC,
        hash: i.hash,
        previousHash: i.previousHash,
        signature: i.signature,
      }));
  }, [invoices, clients]);

  const runCheck = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const hashed = getHashedInvoices();

    if (hashed.length === 0) {
      const res = { valid: true };
      setResult(res);
      setLastCheck(new Date());
      if (!silent) setLoading(false);
      return res;
    }

    const res = await verifyChain(hashed);
    setResult(res);
    setLastCheck(new Date());
    if (!silent) setLoading(false);

    // Alert admin on tampering
    if (!res.valid) {
      toast({
        title: '⚠️ Alerte d\'intégrité',
        description: `Altération détectée sur ${res.brokenAt}: ${res.details}`,
        variant: 'destructive',
      });
    }

    return res;
  }, [getHashedInvoices]);

  // Periodic background verification
  useEffect(() => {
    if (!autoCheck) return;
    const chainLength = invoices.filter(i => i.hash).length;
    if (chainLength === 0) return;

    // Run initial check
    runCheck(true);

    const interval = setInterval(() => {
      runCheck(true);
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [autoCheck, runCheck, invoices]);

  const chainLength = invoices.filter(i => i.hash).length;
  const signedCount = invoices.filter(i => i.signature).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vérifiez l'intégrité de la chaîne de hachage SHA-256 et des signatures HMAC de toutes les factures validées.
        Chaque document est lié au précédent et signé numériquement, garantissant qu'aucun enregistrement n'a été altéré.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => runCheck(false)}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Vérifier l'intégrité
        </button>
        <div className="flex flex-col text-xs text-muted-foreground">
          <span>{chainLength} document(s) dans la chaîne • {signedCount} signé(s)</span>
          {lastCheck && (
            <span className="flex items-center gap-1">
              <Bell className="w-3 h-3" />
              Dernière vérification : {lastCheck.toLocaleTimeString('fr-MA')}
            </span>
          )}
        </div>
      </div>

      {/* Auto-check toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={autoCheck}
          onChange={e => setAutoCheck(e.target.checked)}
          className="rounded border-input accent-primary"
        />
        <span className="text-muted-foreground">Vérification automatique en arrière-plan (toutes les 5 min)</span>
      </label>

      {result && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          result.valid
            ? 'border-primary/30 bg-primary/5'
            : 'border-destructive/30 bg-destructive/5'
        }`}>
          {result.valid ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Chaîne intègre & signatures valides ✓</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wide">
                    Système Intègre
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tous les documents validés ont été vérifiés (hash + signature HMAC). Aucune altération détectée.
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Intégrité compromise ✗
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Problème détecté sur le document <span className="font-mono font-bold">{result.brokenAt}</span>
                </p>
                {result.details && (
                  <p className="text-xs text-destructive/80 mt-1">{result.details}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
