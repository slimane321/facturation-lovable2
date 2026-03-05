/**
 * NotificationBell — Bell icon with unread badge and dropdown.
 */
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Package, CreditCard, Shield, Radio, Settings, Check, ChevronRight } from 'lucide-react';
import { useNotifications, type NotifCategory } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<NotifCategory, { icon: React.FC<{ className?: string }>; color: string; label: string }> = {
  stock:    { icon: Package,    color: 'text-orange-500 bg-orange-500/10', label: 'Stock' },
  payment:  { icon: CreditCard, color: 'text-destructive bg-destructive/10', label: 'Paiement' },
  dgi:      { icon: Radio,      color: 'text-blue-600 bg-blue-600/10', label: 'DGI' },
  security: { icon: Shield,     color: 'text-primary bg-primary/10', label: 'Sécurité' },
  system:   { icon: Settings,   color: 'text-muted-foreground bg-muted', label: 'Système' },
};

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const recent = notifications.slice(0, 10);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground/70" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
            {recent.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Aucune notification
              </div>
            ) : (
              recent.map(notif => {
                const config = CATEGORY_CONFIG[notif.category];
                const Icon = config.icon;
                return (
                  <button
                    key={notif.id}
                    onClick={() => {
                      markRead(notif.id);
                      if (notif.href) {
                        setOpen(false);
                      }
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors',
                      !notif.read && 'bg-primary/5'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', config.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('text-xs font-semibold', !notif.read ? 'text-foreground' : 'text-foreground/70')}>
                          {notif.title}
                        </p>
                        {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatTimeAgo(notif.timestamp)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-2">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              Voir toutes les notifications
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(ts).toLocaleDateString('fr-MA');
}
