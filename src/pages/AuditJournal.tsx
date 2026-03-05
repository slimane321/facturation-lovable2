import { useMemo, useState } from 'react';
import { useAudit } from '@/contexts/AuditContext';
import { useLang } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Shield, Clock } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800 border-green-200',
  update: 'bg-blue-100 text-blue-800 border-blue-200',
  delete: 'bg-red-100 text-red-800 border-red-200',
  validate: 'bg-amber-100 text-amber-800 border-amber-200',
  payment: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

function actionBadgeClass(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-muted text-muted-foreground';
}

export default function AuditJournal() {
  const { t } = useLang();
  const { logs } = useAudit();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const docTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.documentType));
    return Array.from(types).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (filterType !== 'all') {
      result = result.filter(l => l.documentType === filterType);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.action.toLowerCase().includes(q) ||
        l.user.toLowerCase().includes(q) ||
        l.documentNumber?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, search, filterType]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal d'Audit</h1>
          <p className="text-sm text-muted-foreground">Traçabilité complète – Lecture seule (Art. 210 CGI)</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{logs.length}</p>
            <p className="text-xs text-muted-foreground">Total entrées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{docTypes.length}</p>
            <p className="text-xs text-muted-foreground">Types de documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{new Set(logs.map(l => l.user)).size}</p>
            <p className="text-xs text-muted-foreground">Utilisateurs actifs</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher action, utilisateur, document..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type de document" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {docTypes.map(dt => <SelectItem key={dt} value={dt}>{dt}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Log table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Heure</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune entrée d'audit</TableCell></TableRow>
              ) : filtered.slice(0, 200).map(log => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {new Date(log.timestamp).toLocaleString('fr-MA')}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{log.user}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={actionBadgeClass(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.documentType}</TableCell>
                  <TableCell className="font-mono text-xs">{log.documentNumber || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.details || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
