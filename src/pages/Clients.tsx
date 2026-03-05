import { useState, useMemo, useCallback } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import type { Client, ClientType } from '@/contexts/DataContext';
import { validateICE } from '@/lib/moroccanUtils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, Plus, Pencil, Trash2, Building2, User, Phone, Mail,
  MapPin, AlertCircle, Check, X, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/moroccanUtils';

// ── Types ──────────────────────────────────────
interface ClientFormData {
  clientType: ClientType;
  businessName: string;
  ice: string;
  ifNumber: string;
  rc: string;
  address: string;
  city: string;
  email: string;
  phone: string;
}

type FormErrors = Partial<Record<keyof ClientFormData, string>>;

const EMPTY_FORM: ClientFormData = {
  clientType: 'company',
  businessName: '',
  ice: '',
  ifNumber: '',
  rc: '',
  address: '',
  city: '',
  email: '',
  phone: '',
};

const MOROCCAN_CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir',
  'Meknès', 'Oujda', 'Kenitra', 'Tétouan', 'Safi', 'El Jadida',
  'Nador', 'Beni Mellal', 'Khouribga',
];

type FilterType = 'all' | 'company' | 'individual';

// ── Small reusable form atoms ─────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="w-3 h-3" />{msg}
    </p>
  );
}

function TextInput({
  value, onChange, placeholder, error, maxLength, className, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  error?: string; maxLength?: number; className?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={cn(
        'w-full px-3 py-2 rounded-lg border text-sm bg-background text-foreground',
        'placeholder:text-muted-foreground/50 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring',
        error ? 'border-destructive/60 bg-destructive/5' : 'border-input',
        className,
      )}
    />
  );
}

// ── Delete confirmation modal ─────────────────
function DeleteConfirm({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" />Supprimer le client
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          Êtes-vous sûr de vouloir supprimer <span className="font-semibold text-foreground">"{name}"</span> ?
          Cette action est irréversible.
        </p>
        <DialogFooter className="gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            Supprimer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Client form modal ─────────────────────────
function ClientModal({
  initial, onSave, onClose,
}: {
  initial?: Client;
  onSave: (data: ClientFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ClientFormData>(
    initial
      ? {
          clientType: initial.clientType,
          businessName: initial.businessName,
          ice: initial.ice,
          ifNumber: initial.ifNumber,
          rc: initial.rc || '',
          address: initial.address,
          city: initial.city,
          email: initial.email || '',
          phone: initial.phone || '',
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const set = (field: keyof ClientFormData) => (val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.businessName.trim()) errs.businessName = 'Champ requis';
    if (form.clientType === 'company' && !validateICE(form.ice))
      errs.ice = 'ICE invalide – 15 chiffres requis';
    if (form.clientType === 'company' && !form.ifNumber.trim())
      errs.ifNumber = 'Identifiant Fiscal requis pour une société';
    if (!form.address.trim()) errs.address = 'Adresse requise';
    if (!form.city.trim()) errs.city = 'Ville requise';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Email invalide';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSave(form);
  };

  const isCompany = form.clientType === 'company';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {initial ? <><Pencil className="w-4 h-4 text-primary" />Modifier le client</> : <><Plus className="w-4 h-4 text-primary" />Nouveau client</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Type toggle */}
          <div>
            <FieldLabel>Type de client</FieldLabel>
            <div className="flex gap-2">
              {(['company', 'individual'] as ClientType[]).map(type => (
                <button
                  key={type}
                  onClick={() => set('clientType')(type)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                    form.clientType === type
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                  )}
                >
                  {type === 'company'
                    ? <><Building2 className="w-4 h-4" />Société (ICE requis)</>
                    : <><User className="w-4 h-4" />Particulier</>}
                </button>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldLabel required>{isCompany ? 'Raison sociale' : 'Nom complet'}</FieldLabel>
              <TextInput value={form.businessName} onChange={set('businessName')}
                placeholder={isCompany ? 'SARL / SA / EURL...' : 'Prénom Nom'}
                error={errors.businessName} />
              <FieldError msg={errors.businessName} />
            </div>

            {/* ICE */}
            <div>
              <FieldLabel required={isCompany}>
                ICE {isCompany ? '(15 chiffres)' : '(optionnel)'}
              </FieldLabel>
              <div className="relative">
                <TextInput value={form.ice} onChange={v => set('ice')(v.replace(/\D/g, ''))}
                  placeholder="000000000000000" maxLength={15} error={errors.ice} />
                {form.ice.length === 15 && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-600" />
                )}
                {form.ice.length > 0 && form.ice.length !== 15 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">
                    {form.ice.length}/15
                  </span>
                )}
              </div>
              <FieldError msg={errors.ice} />
            </div>

            {/* IF */}
            <div>
              <FieldLabel required={isCompany}>Identifiant Fiscal (IF)</FieldLabel>
              <TextInput value={form.ifNumber} onChange={set('ifNumber')}
                placeholder="12345678" error={errors.ifNumber} />
              <FieldError msg={errors.ifNumber} />
            </div>

            {isCompany && (
              <div>
                <FieldLabel>Registre de Commerce (RC)</FieldLabel>
                <TextInput value={form.rc} onChange={set('rc')} placeholder="RC 12345" />
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldLabel required>Adresse</FieldLabel>
              <TextInput value={form.address} onChange={set('address')}
                placeholder="N° Rue, Quartier..." error={errors.address} />
              <FieldError msg={errors.address} />
            </div>
            <div>
              <FieldLabel required>Ville</FieldLabel>
              <div className="relative">
                <select
                  value={form.city}
                  onChange={e => set('city')(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 pr-8 rounded-lg border text-sm bg-background text-foreground appearance-none',
                    'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors',
                    errors.city ? 'border-destructive/60' : 'border-input',
                  )}
                >
                  <option value="">Sélectionner une ville</option>
                  {MOROCCAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="Autre">Autre</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              <FieldError msg={errors.city} />
            </div>
            {form.city === 'Autre' && (
              <div>
                <FieldLabel required>Préciser la ville</FieldLabel>
                <TextInput value="" onChange={val => set('city')(val)} placeholder="Nom de la ville" />
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Contact (optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>
                <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" />Email</span>
              </FieldLabel>
              <TextInput type="email" value={form.email} onChange={set('email')}
                placeholder="contact@societe.ma" error={errors.email} />
              <FieldError msg={errors.email} />
            </div>
            <div>
              <FieldLabel>
                <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" />Téléphone</span>
              </FieldLabel>
              <TextInput value={form.phone} onChange={set('phone')} placeholder="+212 5 22 00 00 00" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" />
            {initial ? 'Enregistrer' : 'Créer le client'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────
export default function ClientsPage() {
  const { t } = useLang();
  const { clients, invoices, addClient, updateClient, deleteClient } = useData();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [deleting, setDeleting] = useState<Client | undefined>();

  // Revenue per client (all validated/paid = total billed)
  const clientRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(inv => {
      if (['paid', 'validated'].includes(inv.status))
        map[inv.clientId] = (map[inv.clientId] || 0) + inv.totals.totalTTC;
    });
    return map;
  }, [invoices]);

  // Total paid per client (only "paid" invoices)
  const clientPaid = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.status === 'paid')
        map[inv.clientId] = (map[inv.clientId] || 0) + inv.totals.totalTTC;
    });
    return map;
  }, [invoices]);

  const invoiceCount = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach(inv => { map[inv.clientId] = (map[inv.clientId] || 0) + 1; });
    return map;
  }, [invoices]);

  const filtered = useMemo(() =>
    clients
      .filter(c => filter === 'all' || c.clientType === filter)
      .filter(c => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.businessName.toLowerCase().includes(q) ||
          c.ice.includes(q) ||
          c.city.toLowerCase().includes(q) ||
          (c.ifNumber && c.ifNumber.includes(q))
        );
      }),
    [clients, filter, search]
  );

  const handleSave = useCallback((data: ClientFormData) => {
    if (editing) {
      updateClient(editing.id, data);
    } else {
      addClient(data);
    }
    setModalOpen(false);
    setEditing(undefined);
  }, [editing, addClient, updateClient]);

  const openEdit = (client: Client) => { setEditing(client); setModalOpen(true); };
  const openAdd = () => { setEditing(undefined); setModalOpen(true); };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.clients}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients.length} client(s) enregistré(s)
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau client
        </button>
      </div>
      <div className="gold-accent-line w-24" />

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, ICE, ville…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { value: 'all', label: 'Tous' },
            { value: 'company', label: 'Sociétés' },
            { value: 'individual', label: 'Particuliers' },
          ] as { value: FilterType; label: string }[]).map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total clients', value: clients.length, icon: '👥' },
          { label: 'Sociétés', value: clients.filter(c => c.clientType === 'company').length, icon: '🏢' },
          { label: 'Particuliers', value: clients.filter(c => c.clientType === 'individual').length, icon: '👤' },
        ].map(s => (
          <div key={s.label} className="stat-card text-center py-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden animate-fade-in">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="w-10 h-10 mb-3 opacity-20" />
            <p className="font-medium">Aucun client trouvé</p>
            <button onClick={openAdd} className="mt-3 text-sm text-primary hover:underline">
              + Ajouter un client
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">ICE / IF</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Ville</span>
                  </th>
                   <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Factures</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Facturé</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden xl:table-cell">Payé</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden xl:table-cell">Solde dû</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(client => (
                  <tr key={client.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                          client.clientType === 'company'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-gold/15 text-gold-foreground'
                        )}>
                          {client.clientType === 'company'
                            ? <Building2 className="w-4 h-4" />
                            : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{client.businessName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              client.clientType === 'company'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-gold/15 text-gold-foreground'
                            )}>
                              {client.clientType === 'company' ? 'Société' : 'Particulier'}
                            </span>
                            {client.email && <p className="text-xs text-muted-foreground hidden sm:block">{client.email}</p>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <p className="text-xs font-mono text-foreground/80">{client.ice || '—'}</p>
                      {client.ifNumber && <p className="text-xs text-muted-foreground">IF: {client.ifNumber}</p>}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <p className="text-sm text-foreground">{client.city}</p>
                      {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {invoiceCount[client.id] || 0}
                      </span>
                    </td>
                     <td className="px-4 py-3.5 text-right">
                       <span className="text-sm font-bold text-primary tabular-nums">
                         {clientRevenue[client.id] ? formatCurrency(clientRevenue[client.id]) : '—'}
                       </span>
                     </td>
                     <td className="px-4 py-3.5 text-right hidden xl:table-cell">
                       <span className="text-sm font-semibold tabular-nums" style={{ color: 'hsl(var(--status-paid))' }}>
                         {clientPaid[client.id] ? formatCurrency(clientPaid[client.id]) : '—'}
                       </span>
                     </td>
                     <td className="px-4 py-3.5 text-right hidden xl:table-cell">
                       {(() => {
                         const billed = clientRevenue[client.id] || 0;
                         const paid = clientPaid[client.id] || 0;
                         const due = billed - paid;
                         return (
                           <span className={cn('text-sm font-bold tabular-nums', due > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                             {due > 0 ? formatCurrency(due) : '—'}
                           </span>
                         );
                       })()}
                     </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(client)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleting(client)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalOpen && (
        <ClientModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
        />
      )}
      {deleting && (
        <DeleteConfirm
          name={deleting.businessName}
          onConfirm={() => { deleteClient(deleting.id); setDeleting(undefined); }}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </div>
  );
}
