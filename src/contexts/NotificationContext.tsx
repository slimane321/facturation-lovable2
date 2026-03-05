/**
 * NotificationContext — Manages app-wide notifications with categories,
 * read/unread state, and Supabase persistence with realtime updates.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type NotifCategory = 'stock' | 'payment' | 'dgi' | 'security' | 'system';

export interface AppNotification {
  id: string;
  timestamp: string;
  category: NotifCategory;
  title: string;
  message: string;
  read: boolean;
  href?: string;
  icon?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  notify: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  hasSent: (dedupKey: string) => boolean;
  registerSent: (dedupKey: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const MAX_NOTIFICATIONS = 100;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [sentKeys] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  // Track auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch notifications from DB
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      if (!error && data) {
        setNotifications(data.map(dbToApp));
      }
    };

    fetchNotifications();

    // Realtime subscription
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [dbToApp(payload.new as any), ...prev].slice(0, MAX_NOTIFICATIONS));
          } else if (payload.eventType === 'UPDATE') {
            const updated = dbToApp(payload.new as any);
            setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            setNotifications(prev => prev.filter(n => n.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const notify = useCallback(async (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    if (!userId) return;
    await supabase.from('notifications').insert({
      user_id: userId,
      category: n.category,
      title: n.title,
      message: n.message,
      href: n.href ?? null,
      icon: n.icon ?? null,
      read: false,
    });
    // Realtime will update state
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  }, [userId]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', userId);
  }, [userId]);

  const hasSent = useCallback((key: string) => sentKeys.has(key), [sentKeys]);
  const registerSent = useCallback((key: string) => { sentKeys.add(key); }, [sentKeys]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, notify, markRead, markAllRead, clearAll, hasSent, registerSent }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
}

function dbToApp(row: any): AppNotification {
  return {
    id: row.id,
    timestamp: row.created_at,
    category: row.category as NotifCategory,
    title: row.title,
    message: row.message,
    read: row.read,
    href: row.href ?? undefined,
    icon: row.icon ?? undefined,
  };
}
