import { useState } from 'react';
import { useRole, type UserRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, Trash2, Shield, ShieldCheck, FileText, UserCheck, Loader2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

const ROLE_LABELS: Record<UserRole, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  admin: { label: 'Administrateur', icon: ShieldCheck, color: 'text-primary' },
  agent: { label: 'Agent Commercial', icon: FileText, color: 'text-gold-foreground' },
  comptable: { label: 'Comptable', icon: UserCheck, color: 'text-blue-600' },
};

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin', label: 'Administrateur', desc: 'Accès complet à toutes les fonctionnalités' },
  { value: 'agent', label: 'Agent Commercial', desc: 'Créer devis, BL, brouillons. Pas de validation ni suppression.' },
  { value: 'comptable', label: 'Comptable', desc: 'Lecture seule. Export CSV/Excel et XML uniquement.' },
];

export default function UserManagement() {
  const { users, currentUser, can, refreshUsers } = useRole();
  const { session } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' as UserRole });
  const [creating, setCreating] = useState(false);

  if (!can('manage_users')) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 p-6 rounded-xl border border-destructive/30 bg-destructive/5">
          <Shield className="w-6 h-6 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Accès Refusé</p>
            <p className="text-sm text-muted-foreground">Seuls les administrateurs peuvent gérer les utilisateurs.</p>
          </div>
        </div>
      </div>
    );
  }

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
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: form.email.trim(),
          password: form.password,
          display_name: form.name.trim(),
          role: form.role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

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

  const handleDelete = async (id: string) => {
    if (id === currentUser.id) return;
    if (!confirm('Supprimer cet utilisateur ?')) return;
    // Note: deleting auth users requires service role — would need another edge function
    // For now, we just show a message
    toast({ title: 'Info', description: 'La suppression d\'utilisateur nécessite une action administrateur côté serveur.' });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des Utilisateurs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérez les accès et permissions de votre équipe
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Ajouter un utilisateur
        </button>
      </div>

      <div className="gold-accent-line w-24" />

      {/* Current user indicator */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
          {currentUser.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Connecté en tant que : {currentUser.name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role]?.label} — {currentUser.email}</p>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => {
              const role = ROLE_LABELS[user.role] || ROLE_LABELS.agent;
              const RoleIcon = role.icon;
              const isCurrentUser = user.id === currentUser.id;
              return (
                <TableRow key={user.id} className={isCurrentUser ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{user.name}</span>
                      {isCurrentUser && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">Vous</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <RoleIcon className={`w-3.5 h-3.5 ${role.color}`} />
                      <span className={`text-xs font-semibold ${role.color}`}>{role.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString('fr-MA')}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isCurrentUser && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Permission matrix */}
      <div className="bg-card rounded-xl border shadow-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Matrice des Permissions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Permission</th>
                <th className="text-center py-2 px-3 font-medium text-primary">Admin</th>
                <th className="text-center py-2 px-3 font-medium text-gold-foreground">Agent</th>
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
      </div>

      {/* Add user dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Nom complet</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Ahmed Benali"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Email</label>
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                type="email"
                placeholder="Ex: ahmed@societe.ma"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Mot de passe</label>
              <input
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                type="password"
                placeholder="Minimum 6 caractères"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Rôle</label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.role === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.value}
                      checked={form.role === opt.value}
                      onChange={() => setForm(f => ({ ...f, role: opt.value }))}
                      className="mt-1"
                    />
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
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-70"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
              Ajouter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
