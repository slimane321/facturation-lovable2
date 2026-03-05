/**
 * Notifications — Full page notification center with filtering.
 */
import { useState, useMemo } from 'react';
import { useNotifications, type NotifCategory } from '@/contexts/NotificationContext';
import { Bell, Package, CreditCard, Shield, Radio, Settings, Trash2, Check, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: NotifCategory | 'all'; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: 'all',      label: 'Toutes',    icon: Bell },
  { value: 'stock',    label: 'Stock',     icon: Package },
  { value: 'payment',  label: 'Paiement',  icon: CreditCard },
  { value: 'dgi',      label: 'DGI',       icon: Radio },
  { value: 'security', label: 'Sécurité',  icon: Shield },
  { value: 'system',   label: 'Système',   icon: Settings },
];

const CATEGORY_COLORS: Record<NotifCategory, string> = {
  stock:    'text-orange-500 bg-orange-500/10',
  payment:  'text-destructive bg-destructive/10',
  dgi:      'text-blue-600 bg-blue-600/10',
  security: 'text-primary bg-primary/10',
  system:   'text-muted-foreground bg-muted',
};

export default function Notifications() {
  const { notifications, markRead, markAllRead, clearAll, unreadCount } = useNotifications();
  const [catFilter, setCatFilter] = useState<NotifCategory | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    return notifications
      .filter(n => catFilter === 'all' || n.category === catFilter)
      .filter(n => {
        const d = n.timestamp.split('T')[0];
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
  }, [notifications, catFilter, dateFrom, dateTo]);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Centre de Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount} non lue(s) • {notifications.length} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Check className="w-4 h-4" />
              Tout marquer comme lu
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => { if (confirm('Supprimer toutes les notifications ?')) clearAll(); }}
              className="flex items-center gap-2 px-3 py-2 border border-destructive/30 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Tout effacer
            </button>
          )}
        </div>
      </div>

      <div className="gold-accent-line w-24" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const count = cat.value === 'all'
              ? notifications.length
              : notifications.filter(n => n.category === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setCatFilter(cat.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  catFilter === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <Icon className="w-3 h-3" />
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {/* Notification list */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune notification</p>
            <p className="text-xs mt-1">Les alertes apparaîtront ici automatiquement.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(notif => {
              const color = CATEGORY_COLORS[notif.category];
              const catInfo = CATEGORIES.find(c => c.value === notif.category);
              const Icon = catInfo?.icon || Bell;
              return (
                <div
                  key={notif.id}
                  className={cn(
                    'flex items-start gap-4 px-6 py-4 transition-colors',
                    !notif.read && 'bg-primary/5'
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={cn('text-sm font-semibold', !notif.read ? 'text-foreground' : 'text-foreground/70')}>
                        {notif.title}
                      </p>
                      {!notif.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto', color)}>
                        {catInfo?.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(notif.timestamp).toLocaleString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!notif.read && (
                    <button
                      onClick={() => markRead(notif.id)}
                      className="p-1.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded transition-colors flex-shrink-0 mt-1"
                      title="Marquer comme lu"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
