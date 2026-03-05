/**
 * DocumentTimeline — Reusable vertical timeline showing audit history for any document.
 * Fetches entries from AuditLogs filtered by documentId.
 * Latest entries appear at the top. Hidden from print views.
 */
import { useAudit, type AuditEntry } from '@/contexts/AuditContext';
import {
  Clock,
  User,
  CheckCircle,
  Banknote,
  Undo2,
  FileText,
  GitMerge,
  Wallet,
  Circle,
} from 'lucide-react';

function timelineIcon(action: string) {
  if (action.includes('Validation') || action.includes('validé'))
    return <CheckCircle className="w-4 h-4 text-primary" />;
  if (action.includes('Paiement') || action.includes('payée'))
    return <Wallet className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />;
  if (action.includes('avoir') || action.includes('Avoir'))
    return <Undo2 className="w-4 h-4 text-destructive" />;
  if (action.includes('Conversion') || action.includes('Converti'))
    return <GitMerge className="w-4 h-4 text-primary" />;
  if (action.includes('Création'))
    return <Circle className="w-4 h-4 text-muted-foreground" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

interface DocumentTimelineProps {
  documentId: string;
  /** Optional: pass logs directly instead of using context */
  logs?: AuditEntry[];
}

export default function DocumentTimeline({ documentId, logs: externalLogs }: DocumentTimelineProps) {
  const { logs: contextLogs } = useAudit();
  const allLogs = externalLogs ?? contextLogs;

  const entries = allLogs
    .filter(l => l.documentId === documentId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (entries.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in no-print">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Historique du document</h3>
        <span className="ml-auto text-xs text-muted-foreground">{entries.length} événement{entries.length > 1 ? 's' : ''}</span>
      </div>
      <div className="p-5">
        <div className="relative pl-6 space-y-4">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-border" />
          {entries.map((entry) => (
            <div key={entry.id} className="relative flex items-start gap-3">
              <div className="absolute -left-6 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-card border-2 border-border z-10">
                {timelineIcon(entry.action)}
              </div>
              <div className="ml-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{entry.action}</span>
                  {entry.documentNumber && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{entry.documentNumber}</span>
                  )}
                </div>
                {entry.details && (
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>{entry.user}</span>
                  <span>•</span>
                  <span>
                    {new Date(entry.timestamp).toLocaleString('fr-MA', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
