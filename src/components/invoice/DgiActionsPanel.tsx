import { useState, useRef, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { generateUBLXml, downloadXml } from '@/lib/ublGenerator';
import type { Invoice, Client } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import {
  Send, FileCode, Upload, Download, CheckCircle, XCircle, Clock, PenTool, ShieldCheck,
  FileUp, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  invoice: Invoice;
  client: Client;
}

type DgiStep = 1 | 2 | 3;

function getStep(invoice: Invoice): DgiStep {
  if (invoice.dgiStatus === 'accepted') return 3;
  if (invoice.dgiStatus === 'pending' || invoice.dgiStatus === 'rejected' || invoice.dgiStatus === 'manual') return 2;
  return 1;
}

function getStepLabel(step: DgiStep): string {
  switch (step) {
    case 1: return 'Validation Locale';
    case 2: return 'Transmission DGI';
    case 3: return 'Confirmé par DGI';
  }
}

export default function DgiActionsPanel({ invoice, client }: Props) {
  const { updateInvoice } = useData();
  const { settings } = useSettings();
  const [regNumber, setRegNumber] = useState(invoice.dgiRegistrationNumber || '');
  const [dragOver, setDragOver] = useState(false);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const dgiResponseRef = useRef<HTMLInputElement>(null);

  const isLocked = invoice.status === 'validated' || invoice.status === 'paid' || invoice.status === 'avoir';

  const currentStep = getStep(invoice);
  const isConfirmed = currentStep === 3;
  const progressValue = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;

  const parseDgiResponse = useCallback((text: string): { regNum?: string; status?: 'accepted' | 'rejected' } => {
    const regMatch = text.match(/<(?:dgi:)?RegistrationNumber>(.*?)<\/(?:dgi:)?RegistrationNumber>/i);
    const statusMatch = text.match(/<(?:dgi:)?Status>(accepted|rejected)<\/(?:dgi:)?Status>/i);
    let regNum = regMatch?.[1];
    let status = statusMatch?.[1] as 'accepted' | 'rejected' | undefined;
    if (!regNum || !status) {
      try {
        const json = JSON.parse(text);
        regNum = regNum || json.registrationNumber || json.registration_number || json.regNumber;
        status = status || json.status;
      } catch { /* not JSON */ }
    }
    return { regNum, status };
  }, []);

  const handleDgiResponseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const { regNum, status } = parseDgiResponse(text);
      if (regNum) {
        setRegNumber(regNum);
        updateInvoice(invoice.id, {
          dgiRegistrationNumber: regNum,
          dgiStatus: status || 'accepted',
        } as any);
        toast({ title: 'Fichier DGI importé ✓', description: `N° enregistrement: ${regNum}` });
      } else if (status) {
        updateInvoice(invoice.id, { dgiStatus: status } as any);
        toast({ title: 'Statut DGI mis à jour', description: status === 'accepted' ? 'Accepté' : 'Rejeté' });
      } else {
        toast({
          title: 'Extraction automatique échouée',
          description: 'Veuillez saisir le N° d\'enregistrement manuellement ci-dessous.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  }, [invoice.id, parseDgiResponse, updateInvoice]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleDgiResponseFile(file);
  }, [handleDgiResponseFile]);

  if (!isLocked) {
    return (
      <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in no-print p-5">
        <div className="flex items-center gap-3 text-muted-foreground">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Transmission DGI indisponible</p>
            <p className="text-xs mt-0.5">Seules les factures validées avec un numéro officiel et Hash peuvent être transmises à la DGI.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────
  const handleTransmit = () => {
    const success = Math.random() > 0.3;
    if (success) {
      updateInvoice(invoice.id, { dgiStatus: 'accepted' } as any);
      toast({ title: 'Transmission DGI réussie ✓', description: `${invoice.number} acceptée.` });
    } else {
      updateInvoice(invoice.id, { dgiStatus: 'rejected' } as any);
      toast({ title: 'Échec transmission DGI', description: 'Téléchargez le XML pour upload manuel.', variant: 'destructive' });
    }
  };

  const handleExportXml = () => {
    const xml = generateUBLXml(invoice, client, settings);
    downloadXml(xml, `${invoice.number.replace(/\//g, '-')}.xml`);
    // Update status to show XML was downloaded, don't hide options
    if (!invoice.dgiStatus || invoice.dgiStatus === 'pending') {
      updateInvoice(invoice.id, { dgiStatus: 'manual' } as any);
    }
    toast({ title: 'XML UBL 2.1 téléchargé ✓', description: 'En attente de réponse DGI.' });
  };

  const handleSaveRegNumber = () => {
    if (!regNumber.trim()) return;
    updateInvoice(invoice.id, { dgiRegistrationNumber: regNumber.trim(), dgiStatus: 'accepted' } as any);
    toast({ title: 'Validé par DGI ✓', description: `N° ${regNumber.trim()} enregistré.` });
  };

  const handleDgiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleDgiResponseFile(file);
    e.target.value = '';
  };

  const handleDownloadForSignature = () => {
    window.print();
    toast({ title: 'Imprimez en PDF pour signature externe', description: 'Utilisez Barid eSign ou Adobe Sign.' });
  };

  const handleUploadSignedPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) {
      toast({ title: 'Fichier PDF requis', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux (max 10 Mo)', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateInvoice(invoice.id, { signedPdfUrl: reader.result as string } as any);
      toast({ title: 'PDF signé téléversé ✓' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const statusBadge = (() => {
    if (invoice.dgiStatus === 'accepted') return { icon: <CheckCircle className="w-4 h-4" />, text: 'Validé par DGI', cls: 'text-primary bg-primary/10' };
    if (invoice.dgiStatus === 'rejected') return { icon: <XCircle className="w-4 h-4" />, text: 'Rejeté par DGI', cls: 'text-destructive bg-destructive/10' };
    if (invoice.dgiStatus === 'manual') return { icon: <Clock className="w-4 h-4" />, text: 'XML Téléchargé / En attente', cls: 'text-gold-foreground bg-gold/10' };
    if (invoice.dgiStatus === 'pending') return { icon: <Clock className="w-4 h-4" />, text: 'En attente', cls: 'text-muted-foreground bg-muted' };
    return null;
  })();

  return (
    <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in no-print">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
        <Send className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Statut de Transmission DGI</h3>
        {statusBadge && (
          <span className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge.cls}`}>
            {statusBadge.icon} {statusBadge.text}
          </span>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* ── Stepper ──────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            {([1, 2, 3] as DgiStep[]).map(step => (
              <div key={step} className={cn(
                'flex items-center gap-1.5',
                step <= currentStep ? 'text-primary' : 'text-muted-foreground'
              )}>
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2',
                  step < currentStep ? 'bg-primary text-primary-foreground border-primary' :
                  step === currentStep ? 'border-primary text-primary' :
                  'border-muted-foreground/30 text-muted-foreground/50'
                )}>
                  {step < currentStep ? '✓' : step}
                </div>
                <span className="hidden sm:inline">{getStepLabel(step)}</span>
              </div>
            ))}
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        {/* ── Confirmed state ─────────────────────── */}
        {isConfirmed && invoice.dgiRegistrationNumber && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border-2 border-primary/30">
            <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-primary">Validé par la DGI</p>
              <p className="text-base font-mono font-bold text-foreground mt-0.5">{invoice.dgiRegistrationNumber}</p>
            </div>
          </div>
        )}

        {/* ── Transmission options (always visible until confirmed) ── */}
        {!isConfirmed && (
          <>
            {/* Option 1: Automatic */}
            <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Option 1 — Transmission Automatique
              </p>
              <Button size="sm" variant="outline" onClick={handleTransmit}>
                <Send className="w-3.5 h-3.5 mr-1.5" /> Transmettre à la DGI (Simulation)
              </Button>
            </div>

            {/* Option 2: Manual */}
            <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" /> Option 2 — Upload Manuel (Simpl)
              </p>
              <Button size="sm" variant="outline" onClick={handleExportXml}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Télécharger XML (UBL 2.1)
              </Button>
            </div>

            {/* ── DGI Response Dropzone ─────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Importer le fichier de réponse DGI (XML/JSON)
              </p>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => dgiResponseRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                )}
              >
                <FileUp className={cn('w-8 h-8', dragOver ? 'text-primary' : 'text-muted-foreground/50')} />
                <p className="text-sm text-muted-foreground">
                  Glisser-déposer ou <span className="text-primary font-semibold underline">parcourir</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60">Formats acceptés : XML, JSON</p>
              </div>
              <input
                ref={dgiResponseRef}
                type="file"
                accept=".xml,.json"
                className="hidden"
                onChange={handleDgiFileChange}
              />
            </div>

            {/* ── Manual registration fallback ─────── */}
            <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">
                  Saisie manuelle du N° d'enregistrement DGI
                </p>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">N° d'enregistrement DGI</Label>
                  <Input
                    value={regNumber}
                    onChange={e => setRegNumber(e.target.value)}
                    placeholder="Ex: DGI-2026-XXXXX"
                    className="font-mono text-sm"
                  />
                </div>
                <Button size="sm" onClick={handleSaveRegNumber} disabled={!regNumber.trim()}>
                  Valider
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── External Signature (always visible) ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signature Externe (Barid eSign / Adobe)</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadForSignature}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Télécharger pour signature
            </Button>
            <Button size="sm" variant="outline" onClick={() => pdfInputRef.current?.click()}>
              <PenTool className="w-3.5 h-3.5 mr-1.5" /> Téléverser PDF signé
            </Button>
            <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUploadSignedPdf} />
          </div>
          {invoice.signedPdfUrl && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-primary">PDF signé archivé</span>
              <a
                href={invoice.signedPdfUrl}
                download={`${invoice.number}-signe.pdf`}
                className="ml-auto text-xs text-primary underline hover:no-underline"
              >
                Télécharger
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
