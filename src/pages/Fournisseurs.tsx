import { useState, useMemo } from 'react';
import { useDocuments } from '@/contexts/DocumentContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Building2, Hash } from 'lucide-react';
import { toast } from 'sonner';

interface Supplier {
  name: string;
  ice: string;
  totalAchats: number;
  totalTTC: number;
  lastDate: string;
}

export default function Fournisseurs() {
  const { achatsList } = useDocuments();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', ice: '' });

  const suppliers = useMemo(() => {
    const map = new Map<string, Supplier>();
    achatsList.forEach(a => {
      const key = a.supplierName.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.totalAchats += 1;
        existing.totalTTC += a.totals.totalTTC;
        if (a.date > existing.lastDate) existing.lastDate = a.date;
        if (!existing.ice && a.supplierICE) existing.ice = a.supplierICE;
      } else {
        map.set(key, {
          name: a.supplierName,
          ice: a.supplierICE || '',
          totalAchats: 1,
          totalTTC: a.totals.totalTTC,
          lastDate: a.date,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalTTC - a.totalTTC);
  }, [achatsList]);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || s.ice.includes(q));
  }, [suppliers, search]);

  const handleAdd = () => {
    if (!form.name.trim()) { toast.error('Le nom du fournisseur est requis'); return; }
    toast.success(`Fournisseur "${form.name}" ajouté. Créez un achat pour le lier.`);
    setShowAdd(false);
    setForm({ name: '', ice: '' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fournisseurs</h1>
          <p className="text-sm text-muted-foreground">Gestion des fournisseurs extraits depuis vos achats</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nouveau Fournisseur
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Building2 className="w-8 h-8 text-primary" /><div><p className="text-2xl font-bold">{suppliers.length}</p><p className="text-xs text-muted-foreground">Fournisseurs</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Hash className="w-8 h-8 text-primary" /><div><p className="text-2xl font-bold">{achatsList.length}</p><p className="text-xs text-muted-foreground">Total achats</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div><p className="text-2xl font-bold">{suppliers.reduce((s, f) => s + f.totalTTC, 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD</p><p className="text-xs text-muted-foreground">Volume total achats</p></div></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Rechercher un fournisseur..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>ICE</TableHead>
                <TableHead className="text-right">Nb Achats</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead>Dernier achat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun fournisseur trouvé</TableCell></TableRow>
              ) : filtered.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{s.ice || '—'}</Badge></TableCell>
                  <TableCell className="text-right">{s.totalAchats}</TableCell>
                  <TableCell className="text-right font-semibold">{s.totalTTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(s.lastDate).toLocaleDateString('fr-MA')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau Fournisseur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Raison sociale *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>ICE</Label><Input value={form.ice} onChange={e => setForm({ ...form, ice: e.target.value })} placeholder="15 chiffres" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleAdd}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
