import { useState, useMemo } from 'react';
import { api } from '@/integrations/api/client';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/SettingsContext';
import { useData } from '@/contexts/DataContext';
import { useDocuments } from '@/contexts/DocumentContext';
import { useAudit } from '@/contexts/AuditContext';
import { useLang } from '@/contexts/LanguageContext';
import { useRole, type UserRole } from '@/contexts/RoleContext';
import { toast } from '@/hooks/use-toast';
import {
  Save, Building2, CreditCard, Phone, Shield, Download, Clock, User, CheckCircle, FileText,
  Banknote, Undo2, Printer, Filter, ShieldCheck, Lock, Unlock, AlertTriangle, Award,
  AlertCircle, Upload, HeartPulse, Plus, Trash2, UserCheck, Users, Globe, Settings2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import IntegrityChecker from '@/components/settings/IntegrityChecker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { detectInvoiceGaps } from '@/lib/moroccanUtils';

// ── Helpers ──────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FieldInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors placeholder:text-muted-foreground/50"
      {...props}
    />
  );
}

// ── Role labels for Team tab ─────────────────

const ROLE_LABELS: Record<UserRole, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  admin: { label: 'Administrateur', icon: ShieldCheck, color: 'text-primary' },
  agent: { label: 'Agent Commercial', icon: FileText, color: 'text-amber-600' },
  comptable: { label: 'Comptable', icon: UserCheck, color: 'text-blue-600' },
};

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin', label: 'Administrateur', desc: 'Accès complet à toutes les fonctionnalités' },
  { value: 'agent', label: 'Agent Commercial', desc: 'Créer devis, BL, brouillons. Pas de validation ni suppression.' },
  { value: 'comptable', label: 'Comptable', desc: 'Lecture seule. Export CSV/Excel et XML uniquement.' },
];

// ══════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════

export default function Settings() {
  const { settings, updateSettings, closedYears, closeYear, reopenYear, masterHashes, setMasterHash } = useSettings();
  const { clients, invoices, products, addProduct } = useData();
  const { devisList, bcList, blList, achatsList } = useDocuments();
  const { logs: auditLogs } = useAudit();
  const { lang, setLang, t } = useLang();
  const { can, users, currentUser, refreshUsers } = useRole();
  const [form, setForm] = useState({ ...settings });
  const [closingYear, setClosingYear] = useState<number | null>(null);
  const [reopeningYear, setReopeningYear] = useState<number | null>(null);

  if (!can('access_settings')) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 p-6 rounded-xl border border-destructive/30 bg-destructive/5">
          <Shield className="w-6 h-6 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Accès Refusé</p>
            <p className="text-sm text-muted-foreground">Seuls les administrateurs peuvent accéder aux paramètres.</p>
          </div>
        </div>
      </div>
    );
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = () => {
    updateSettings(form);
    toast({ title: 'Paramètres enregistrés ✓', description: 'Les informations de votre société ont été mises à jour.' });
  };

  const computeMasterHash = async (year: number) => {
    const yearInvoices = invoices
      .filter(i => new Date(i.date).getFullYear() === year && i.hash)
      .sort((a, b) => a.number.localeCompare(b.number));
    const concatenated = yearInvoices.map(i => i.hash).join('|');
    const msgBuffer = new TextEncoder().encode(concatenated);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleExport = () => {
    const data = {
      exportDate: new Date().toISOString(),
      settings, clients, invoices, products,
      devis: devisList, bonCommande: bcList, bonLivraison: blList, achats: achatsList, auditLogs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export terminé ✓', description: 'Fichier JSON téléchargé avec succès.' });
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.settings}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configuration complète de votre espace de facturation</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" />
          Enregistrer
        </button>
      </div>
      <div className="gold-accent-line w-24" />

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 gap-1">
          <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs sm:text-sm py-2.5">
            <Building2 className="w-4 h-4" />
            <span className="hidden xs:inline">Infos</span> Entreprise
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-1.5 text-xs sm:text-sm py-2.5">
            <Users className="w-4 h-4" />
            Équipe
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-1.5 text-xs sm:text-sm py-2.5">
            <ShieldCheck className="w-4 h-4" />
            Conformité
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1.5 text-xs sm:text-sm py-2.5">
            <Settings2 className="w-4 h-4" />
            Système
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: Infos Entreprise ═══ */}
        <TabsContent value="general" className="space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="w-4 h-4 text-primary" /> Identité de la société</CardTitle>
              <CardDescription>Raison sociale et identifiants légaux</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <Field label="Raison sociale *">
                    <FieldInput value={form.name} onChange={set('name')} placeholder="SARL Ma Société" />
                  </Field>
                </div>
                <Field label="ICE (15 chiffres) *" hint="Identifiant Commun de l'Entreprise">
                  <FieldInput value={form.ice} onChange={set('ice')} placeholder="000000000000000" maxLength={15} />
                </Field>
                <Field label="Identifiant Fiscal (IF) *">
                  <FieldInput value={form.ifNumber} onChange={set('ifNumber')} placeholder="12345678" />
                </Field>
                <Field label="Numéro RC" hint="Registre du Commerce">
                  <FieldInput value={form.rc} onChange={set('rc')} placeholder="RC 12345" />
                </Field>
                <Field label="Patente (TP)" hint="Taxe Professionnelle">
                  <FieldInput value={form.patente} onChange={set('patente')} placeholder="12345678" />
                </Field>
                <Field label="CNSS" hint="Caisse Nationale de Sécurité Sociale">
                  <FieldInput value={form.cnss} onChange={set('cnss')} placeholder="1234567" />
                </Field>
                <Field label="Capital Social" hint="Ex: 100 000,00 MAD">
                  <FieldInput value={form.capitalSocial || ''} onChange={set('capitalSocial')} placeholder="100 000,00 MAD" />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="w-4 h-4 text-primary" /> Logo de la société</CardTitle>
              <CardDescription>Apparaît sur tous vos documents (factures, devis, BL, BC)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {form.logoUrl && (
                  <img src={form.logoUrl} alt="Logo" className="h-16 object-contain rounded-lg border border-border p-1" />
                )}
                <label className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-semibold hover:bg-secondary/80 transition-colors cursor-pointer">
                  <Building2 className="w-4 h-4" />
                  {form.logoUrl ? 'Changer le logo' : 'Choisir un logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { toast({ title: 'Fichier trop volumineux', description: 'Le logo ne doit pas dépasser 2 Mo.', variant: 'destructive' }); return; }
                    const reader = new FileReader();
                    reader.onload = () => setForm(prev => ({ ...prev, logoUrl: reader.result as string }));
                    reader.readAsDataURL(file);
                  }} />
                </label>
                {form.logoUrl && (
                  <button onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))} className="text-xs text-destructive hover:underline">Supprimer</button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Phone className="w-4 h-4 text-primary" /> Coordonnées</CardTitle>
              <CardDescription>Adresse et informations de contact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <Field label="Adresse complète *">
                    <FieldInput value={form.address} onChange={set('address')} placeholder="1 Avenue Hassan II" />
                  </Field>
                </div>
                <Field label="Ville"><FieldInput value={form.city} onChange={set('city')} placeholder="Casablanca 20000" /></Field>
                <Field label="Téléphone"><FieldInput value={form.tel} onChange={set('tel')} placeholder="+212 5 22 00 00 00" /></Field>
                <Field label="Email"><FieldInput type="email" value={form.email} onChange={set('email')} placeholder="contact@societe.ma" /></Field>
                <Field label="Site web"><FieldInput value={form.website || ''} onChange={set('website')} placeholder="www.societe.ma" /></Field>
              </div>
            </CardContent>
          </Card>

          {/* Banking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="w-4 h-4 text-primary" /> Informations bancaires</CardTitle>
              <CardDescription>Coordonnées bancaires affichées sur les factures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field label="Banque"><FieldInput value={form.bank} onChange={set('bank')} placeholder="Bank of Africa" /></Field>
                <Field label="RIB / IBAN" hint="Affiché sur les factures pour le virement">
                  <FieldInput value={form.rib} onChange={set('rib')} placeholder="BMCE 011 810 0000123456789012 47" />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Footer preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-4 h-4 text-primary" /> Aperçu pied de page</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-primary text-primary-foreground text-xs leading-relaxed font-mono">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span>{form.name}</span>
                  {form.rc && <span>RC : {form.rc}</span>}
                  {form.ifNumber && <span>IF : {form.ifNumber}</span>}
                  {form.ice && <span>ICE : {form.ice}</span>}
                  {form.patente && <span>TP : {form.patente}</span>}
                  {form.cnss && <span>CNSS : {form.cnss}</span>}
                </div>
                {form.rib && <div className="mt-1 opacity-80">Banque : {form.bank} — RIB : {form.rib}</div>}
                <div className="mt-1 opacity-70">{form.tel} &nbsp;•&nbsp; {form.email}{form.website ? ` • ${form.website}` : ''}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab 2: Équipe ═══ */}
        <TabsContent value="team" className="space-y-6">
          <TeamTab
            users={users}
            currentUser={currentUser}
            can={can}
            refreshUsers={refreshUsers}
          />
        </TabsContent>

        {/* ═══ Tab 3: Sécurité & Conformité ═══ */}
        <TabsContent value="compliance" className="space-y-6">
          {/* System integrity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="w-4 h-4 text-primary" /> État du Système</CardTitle>
              <CardDescription>Conformité Article 210 du CGI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    Conformité Article 210 — Activée
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wide">Actif</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Chaînage SHA-256, signatures HMAC, journal d'audit immuable — tous les contrôles d'intégrité sont en place.
                  </p>
                </div>
              </div>
              <IntegrityChecker />
            </CardContent>
          </Card>

          {/* Fiscal year closing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Lock className="w-4 h-4 text-primary" /> Clôture de l'exercice</CardTitle>
              <CardDescription>Verrouillez définitivement les documents d'un exercice fiscal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[2024, 2025, 2026, 2027].map(year => {
                const isClosed = closedYears.includes(year);
                const yearInvoices = invoices.filter(i => new Date(i.date).getFullYear() === year && (i.status === 'validated' || i.status === 'paid' || i.status === 'avoir'));
                return (
                  <div key={year} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-3">
                      {isClosed ? <Lock className="w-4 h-4 text-destructive" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-semibold text-foreground">{year}</p>
                        <p className="text-xs text-muted-foreground">{yearInvoices.length} facture(s) validée(s)</p>
                        {isClosed && masterHashes[year] && (
                          <p className="text-[10px] font-mono text-primary mt-0.5">Master Hash: {masterHashes[year].substring(0, 16).toUpperCase()}</p>
                        )}
                      </div>
                    </div>
                    {isClosed ? (
                      <button onClick={() => setReopeningYear(year)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                        <Unlock className="w-3 h-3" /> Rouvrir
                      </button>
                    ) : (
                      <button onClick={() => setClosingYear(year)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                        <Lock className="w-3 h-3" /> Clôturer
                      </button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Compliance certificate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Award className="w-4 h-4 text-primary" /> Attestation de Conformité</CardTitle>
              <CardDescription>Générez une attestation officielle de conformité Article 210 du CGI</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => generateComplianceCertificate(settings, invoices, closedYears)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Award className="w-4 h-4" /> Générer Attestation de Conformité
              </button>
            </CardContent>
          </Card>

          {/* Sequencing guard */}
          <SequencingGuard invoices={invoices} />

          {/* Audit log */}
          <AuditLogSection auditLogs={auditLogs} />
        </TabsContent>

        {/* ═══ Tab 4: Système & Sauvegarde ═══ */}
        <TabsContent value="system" className="space-y-6">
          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Globe className="w-4 h-4 text-primary" /> Langue de l'application</CardTitle>
              <CardDescription>Choisissez la langue d'affichage et des documents PDF</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <button
                  onClick={() => setLang('fr')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors',
                    lang === 'fr' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-muted'
                  )}
                >
                  🇫🇷 Français
                </button>
                <button
                  onClick={() => setLang('ar')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors',
                    lang === 'ar' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-muted'
                  )}
                >
                  🇲🇦 العربية
                </button>
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <SystemHealthCheck invoices={invoices} />

          {/* Import products */}
          <ImportProducts addProduct={addProduct} />

          {/* Backup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Download className="w-4 h-4 text-primary" /> Sauvegarde des données</CardTitle>
              <CardDescription>Exportez toutes vos données au format JSON — conservation légale de 10 ans</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" /> Exporter toutes les données (JSON)
              </button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialogs (shared) ── */}
      {closingYear && (
        <Dialog open onOpenChange={() => setClosingYear(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" /> Clôturer l'exercice {closingYear} ?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              Tous les documents de l'année {closingYear} seront super-verrouillés. Aucun avoir ni modification ne sera autorisé pour cette période.
            </p>
            <DialogFooter className="gap-2">
              <button onClick={() => setClosingYear(null)} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
              <button
                onClick={async () => {
                  const hash = await computeMasterHash(closingYear);
                  setMasterHash(closingYear, hash);
                  closeYear(closingYear);
                  toast({ title: `Exercice ${closingYear} clôturé ✓`, description: `Master Hash: ${hash.substring(0, 16).toUpperCase()}` });
                  setClosingYear(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >Clôturer</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {reopeningYear && (
        <Dialog open onOpenChange={() => setReopeningYear(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <Unlock className="w-5 h-5" /> Rouvrir l'exercice {reopeningYear} ?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              Les documents de l'année {reopeningYear} pourront à nouveau être modifiés (avoirs, etc.).
            </p>
            <DialogFooter className="gap-2">
              <button onClick={() => setReopeningYear(null)} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
              <button
                onClick={() => {
                  reopenYear(reopeningYear);
                  toast({ title: `Exercice ${reopeningYear} rouvert ✓`, description: 'Les documents sont de nouveau modifiables.' });
                  setReopeningYear(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >Rouvrir</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Tab 2: Team Management
// ══════════════════════════════════════════════

function TeamTab({ users, currentUser, can, refreshUsers }: {
  users: import('@/contexts/RoleContext').AppUser[];
  currentUser: import('@/contexts/RoleContext').AppUser;
  can: (action: import('@/contexts/RoleContext').Permission) => boolean;
  refreshUsers: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' as UserRole });
  const [creating, setCreating] = useState(false);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast({ title: 'Champs requis', description: 'Nom, email et mot de passe sont obligatoires.', variant: 'destructive' });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: 'Mot de passe trop court', description: 'Minimum 6 caractères.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await api.post('/admin/users', {
  email: form.email.trim(),
  password: form.password,
  name: form.name.trim(),
  role: form.role,
});
      toast({ title: 'Utilisateur créé', description: `${form.name} (${ROLE_LABELS[form.role].label})` });
      setForm({ name: '', email: '', password: '', role: 'agent' });
      setShowAdd(false);
      await refreshUsers();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Impossible de créer l\'utilisateur', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Current user */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Connecté en tant que : {currentUser.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role]?.label} — {currentUser.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Users className="w-4 h-4 text-primary" /> Utilisateurs</CardTitle>
            <CardDescription>{users.length} utilisateur(s) enregistré(s)</CardDescription>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const role = ROLE_LABELS[user.role] || ROLE_LABELS.agent;
                  const RoleIcon = role.icon;
                  const isCurrent = user.id === currentUser.id;
                  return (
                    <TableRow key={user.id} className={isCurrent ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {user.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">{user.name}</span>
                          {isCurrent && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">Vous</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <RoleIcon className={`w-3.5 h-3.5 ${role.color}`} />
                          <span className={`text-xs font-semibold ${role.color}`}>{role.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString('fr-MA')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Permission matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-4 h-4 text-primary" /> Matrice des Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Permission</th>
                  <th className="text-center py-2 px-3 font-medium text-primary">Admin</th>
                  <th className="text-center py-2 px-3 font-medium text-amber-600">Agent</th>
                  <th className="text-center py-2 px-3 font-medium text-blue-600">Comptable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {([
                  ['Voir le CA / Dashboard complet', true, false, true],
                  ['Créer factures (brouillon)', true, true, false],
                  ['Valider & verrouiller factures', true, false, false],
                  ['Créer devis / BL', true, true, false],
                  ['Supprimer documents', true, false, false],
                  ['Créer des avoirs', true, false, false],
                  ['Exporter CSV / XML', true, true, true],
                  ['Accéder aux paramètres', true, false, false],
                  ['Clôturer exercice fiscal', true, false, false],
                  ['Gérer les utilisateurs', true, false, false],
                ] as [string, boolean, boolean, boolean][]).map(([label, admin, agent, comptable], i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 text-foreground">{label}</td>
                    <td className="text-center">{admin ? '✅' : '❌'}</td>
                    <td className="text-center">{agent ? '✅' : '❌'}</td>
                    <td className="text-center">{comptable ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add user dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un utilisateur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Nom complet</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Ahmed Benali"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" placeholder="Ex: ahmed@societe.ma"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Mot de passe</label>
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password" placeholder="Minimum 6 caractères"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Rôle</label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map(opt => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.role === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                    <input type="radio" name="role" value={opt.value} checked={form.role === opt.value} onChange={() => setForm(f => ({ ...f, role: opt.value }))} className="mt-1" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-muted">Annuler</button>
            <button onClick={handleAdd} disabled={creating} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-70">
              {creating ? '...' : 'Ajouter'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
// ══════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════

function generateComplianceCertificate(settings: import('@/contexts/SettingsContext').CompanySettings, invoices: any[], closedYears: number[]) {
  const doc = `
═══════════════════════════════════════════════════
        ATTESTATION DE CONFORMITÉ
        Article 210 du Code Général des Impôts
═══════════════════════════════════════════════════

Date de génération : ${new Date().toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}

SOCIÉTÉ : ${settings.name}
ICE : ${settings.ice}
IF : ${settings.ifNumber}
RC : ${settings.rc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOGICIEL : FacturaPro Maroc
VERSION : 2026.1.0
ÉDITEUR : FacturaPro Technologies

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MÉTHODES DE SÉCURITÉ :

1. EMPREINTE NUMÉRIQUE : SHA-256
2. CHAÎNAGE SÉQUENTIEL (blockchain)
3. SIGNATURE NUMÉRIQUE : HMAC-SHA256
4. NUMÉROTATION SÉQUENTIELLE (FA-AAAA-NNNN)
5. IMMUTABILITÉ post-validation
6. JOURNAL D'AUDIT immuable
7. QR CODE DGI conforme
8. DROIT DE TIMBRE 0,25% (espèces)
9. CLÔTURE FISCALE avec Master Hash
10. CONSERVATION 10 ans (export JSON)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATISTIQUES :
- Factures totales : ${invoices.length}
- Factures validées : ${invoices.filter((i: any) => i.status === 'validated' || i.status === 'paid').length}
- Factures signées : ${invoices.filter((i: any) => i.hash).length}
- Exercices clôturés : ${closedYears.length > 0 ? closedYears.join(', ') : 'Aucun'}

═══════════════════════════════════════════════════
`;
  const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attestation_conformite_art210_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast({ title: 'Attestation générée ✓', description: 'Document de conformité Article 210 téléchargé.' });
}

function SequencingGuard({ invoices }: { invoices: any[] }) {
  const validatedNumbers = invoices
    .filter((i: any) => i.number !== 'BROUILLON' && !i.number.startsWith('AV-'))
    .map((i: any) => i.number);
  const gaps = useMemo(() => detectInvoiceGaps(validatedNumbers), [validatedNumbers]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><AlertCircle className="w-4 h-4 text-primary" /> Contrôle de Séquençage</CardTitle>
        <CardDescription>Vérification de la continuité de la numérotation (Art. 210 CGI)</CardDescription>
      </CardHeader>
      <CardContent>
        {gaps.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Numérotation continue ✓</p>
              <p className="text-xs text-muted-foreground">{validatedNumbers.length} facture(s) vérifiée(s) — aucune rupture détectée.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-destructive">⚠️ Rupture de séquence détectée</p>
                <p className="text-xs text-muted-foreground">{gaps.length} numéro(s) manquant(s).</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Numéros manquants :</p>
              <div className="flex flex-wrap gap-2">
                {gaps.map(g => <span key={g} className="px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-mono font-bold">{g}</span>)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SystemHealthCheck({ invoices }: { invoices: any[] }) {
  const [result, setResult] = useState<{ total: number; missing: string[] } | null>(null);

  const runCheck = () => {
    const validated = invoices.filter((i: any) => i.status === 'validated' || i.status === 'paid' || i.status === 'avoir');
    const missing: string[] = [];
    for (const inv of validated) {
      const issues: string[] = [];
      if (!inv.hash) issues.push('Hash manquant');
      if (!inv.signature) issues.push('Signature manquante');
      if (inv.number === 'BROUILLON') issues.push('Numéro séquentiel absent');
      if (issues.length > 0) missing.push(`${inv.number || inv.id}: ${issues.join(', ')}`);
    }
    setResult({ total: validated.length, missing });
    toast({
      title: missing.length === 0 ? 'Système sain ✓' : `⚠️ ${missing.length} problème(s) détecté(s)`,
      description: missing.length === 0 ? `${validated.length} factures vérifiées.` : 'Consultez les détails ci-dessous.',
      variant: missing.length > 0 ? 'destructive' : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><HeartPulse className="w-4 h-4 text-primary" /> Contrôle de Santé</CardTitle>
        <CardDescription>Vérifie Hash, Signature et Numéro de toutes les factures validées</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <button onClick={runCheck} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
          <HeartPulse className="w-4 h-4" /> Lancer le contrôle
        </button>
        {result && (
          <div className={cn('p-4 rounded-xl border', result.missing.length === 0 ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5')}>
            {result.missing.length === 0 ? (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-foreground">Système sain ✓</p>
                  <p className="text-xs text-muted-foreground">{result.total} facture(s) — tout est conforme.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /><p className="text-sm font-bold text-destructive">{result.missing.length} anomalie(s)</p></div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.missing.map((m, i) => <p key={i} className="text-xs font-mono text-destructive bg-destructive/10 px-2 py-1 rounded">{m}</p>)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImportProducts({ addProduct }: { addProduct: (p: any) => void }) {
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast({ title: 'Fichier vide', variant: 'destructive' }); return; }
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/[;,\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 3) continue;
          const [reference, name, description, priceStr, vatStr, unit, stockStr] = cols;
          if (!name) continue;
          addProduct({
            reference: reference || '', name, description: description || '',
            unitPrice: parseFloat(priceStr) || 0,
            vatRate: ([0, 7, 10, 14, 20].includes(parseInt(vatStr)) ? parseInt(vatStr) : 20) as any,
            unit: unit || 'Unité', stock: parseInt(stockStr) || 0, minStockThreshold: 5,
          });
          count++;
        }
        toast({ title: `${count} produit(s) importé(s) ✓` });
      } catch { toast({ title: 'Erreur de lecture', variant: 'destructive' }); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Upload className="w-4 h-4 text-primary" /> Import de Produits</CardTitle>
        <CardDescription>Importez depuis un fichier CSV : Référence ; Nom ; Description ; Prix HT ; TVA (%) ; Unité ; Stock</CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer w-fit">
          <Upload className="w-4 h-4" /> Importer un fichier CSV
          <input type="file" accept=".csv,.txt,.tsv" onChange={handleImport} className="hidden" />
        </label>
      </CardContent>
    </Card>
  );
}

// ── Audit Log ────────────────────────────────

function actionIcon(action: string) {
  if (action.includes('Validation') || action.includes('validé')) return <CheckCircle className="w-3.5 h-3.5 text-primary" />;
  if (action.includes('Paiement') || action.includes('payée')) return <Banknote className="w-3.5 h-3.5 text-primary" />;
  if (action.includes('avoir') || action.includes('Avoir')) return <Undo2 className="w-3.5 h-3.5 text-destructive" />;
  if (action.includes('Impression')) return <Printer className="w-3.5 h-3.5 text-muted-foreground" />;
  return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
}

function AuditLogSection({ auditLogs }: { auditLogs: import('@/contexts/AuditContext').AuditEntry[] }) {
  const [dateFilter, setDateFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const filtered = auditLogs
    .filter(l => !dateFilter || l.timestamp.startsWith(dateFilter))
    .filter(l => !userFilter || l.user.toLowerCase().includes(userFilter.toLowerCase()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const users = [...new Set(auditLogs.map(l => l.user))];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Clock className="w-4 h-4 text-primary" /> Journal d'activité</CardTitle>
        <CardDescription>Historique immuable — ces entrées ne peuvent être ni modifiées ni supprimées</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring/30">
            <option value="">Tous les utilisateurs</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          {(dateFilter || userFilter) && (
            <button onClick={() => { setDateFilter(''); setUserFilter(''); }} className="text-xs text-primary hover:underline">Réinitialiser</button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} entrée(s)</span>
        </div>
        <div className="rounded-lg border overflow-hidden max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Date / Heure</TableHead>
                <TableHead className="w-24">Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-32">Document</TableHead>
                <TableHead>Détails</TableHead>
                <TableHead className="hidden lg:table-cell">Ancienne valeur</TableHead>
                <TableHead className="hidden lg:table-cell">Nouvelle valeur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune entrée trouvée</TableCell></TableRow>
              ) : (
                filtered.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.timestamp).toLocaleString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs"><div className="flex items-center gap-1.5"><User className="w-3 h-3 text-muted-foreground" />{entry.user}</div></TableCell>
                    <TableCell className="text-sm"><div className="flex items-center gap-1.5">{actionIcon(entry.action)}{entry.action}</div></TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{entry.documentNumber || entry.documentType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.details || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono hidden lg:table-cell max-w-[120px] truncate" title={entry.oldValue}>{entry.oldValue || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono hidden lg:table-cell max-w-[120px] truncate" title={entry.newValue}>{entry.newValue || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
