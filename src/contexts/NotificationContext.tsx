import React, { createContext, useContext, useEffect, useCallback, useState } from "react";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

export type NotifCategory = "stock" | "payment" | "dgi" | "security" | "system";

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
  notify: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  hasSent: (dedupKey: string) => boolean;
  registerSent: (dedupKey: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);
const MAX_NOTIFICATIONS = 100;

function mapRow(r: any): AppNotification {
  return {
    id: r.id,
    timestamp: r.createdAt ?? r.timestamp ?? new Date().toISOString(),
    category: (r.category as NotifCategory) ?? "system",
    title: r.title ?? "",
    message: r.message ?? "",
    read: !!r.read,
    href: r.href ?? undefined,
    icon: r.icon ?? undefined,
  };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [sentKeys] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    try {
      const rows = await api.get<any[]>("/notifications");
      setNotifications((rows || []).slice(0, MAX_NOTIFICATIONS).map(mapRow));
    } catch {
      setNotifications([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    refresh();
  }, [loading, isAuthenticated, refresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const notify = useCallback(
    async (n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      if (!isAuthenticated) return;
      try {
        const row = await api.post<any>("/notifications", n);
        setNotifications((prev) => [mapRow(row), ...prev].slice(0, MAX_NOTIFICATIONS));
      } catch {}
    },
    [isAuthenticated]
  );

  const markRead = useCallback(
    async (id: string) => {
      if (!isAuthenticated) return;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      await api.put(`/notifications/${id}/read`).catch(() => {});
    },
    [isAuthenticated]
  );

  const markAllRead = useCallback(async () => {
    if (!isAuthenticated) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await api.put("/notifications/read-all").catch(() => {});
  }, [isAuthenticated]);

  const clearAll = useCallback(async () => {
    if (!isAuthenticated) return;
    setNotifications([]);
    await api.del("/notifications").catch(() => {});
  }, [isAuthenticated]);

  const hasSent = useCallback((key: string) => sentKeys.has(key), [sentKeys]);
  const registerSent = useCallback((key: string) => void sentKeys.add(key), [sentKeys]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, notify, markRead, markAllRead, clearAll, hasSent, registerSent }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}