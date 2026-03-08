import React, { createContext, useContext, useEffect, useCallback, useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/api/client";

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  documentType: string;
  documentId: string;
  documentNumber?: string;
  details?: string;
  oldValue?: string;
  newValue?: string;
}

interface AuditContextType {
  logs: AuditEntry[];
  log: (entry: Omit<AuditEntry, "id" | "timestamp" | "user">) => void;
}

const AuditContext = createContext<AuditContextType | null>(null);

function mapRow(r: any): AuditEntry {
  return {
    id: r.id,
    timestamp: r.createdAt ?? r.timestamp ?? new Date().toISOString(),
    user: r.userName ?? r.user ?? "Utilisateur",
    action: r.action,
    documentType: r.documentType,
    documentId: r.documentId ?? "",
    documentNumber: r.documentNumber ?? undefined,
    details: r.details ?? undefined,
    oldValue: r.oldValue ? JSON.stringify(r.oldValue) : undefined,
    newValue: r.newValue ? JSON.stringify(r.newValue) : undefined,
  };
}

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { currentUser } = useRole();
  const [logs, setLogs] = useState<AuditEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setLogs([]);
      return;
    }
    try {
      const rows = await api.get<any[]>("/audit");
      setLogs((rows || []).map(mapRow));
    } catch {
      setLogs([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      setLogs([]);
      return;
    }
    refresh();
  }, [loading, isAuthenticated, refresh]);

  const log = useCallback(
    (entry: Omit<AuditEntry, "id" | "timestamp" | "user">) => {
      // Si pas connecté, on garde seulement en local (optionnel)
      const temp: AuditEntry = {
        ...entry,
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        user: currentUser.name,
      };
      setLogs((prev) => [temp, ...prev]);

      if (!isAuthenticated) return;

      const payload: any = {
  action: entry.action,
  documentType: entry.documentType,
};

if (entry.documentId) payload.documentId = entry.documentId;
if (entry.documentNumber) payload.documentNumber = entry.documentNumber;
if (entry.details) payload.details = entry.details;

if (entry.oldValue) payload.oldValue = JSON.parse(entry.oldValue);
if (entry.newValue) payload.newValue = JSON.parse(entry.newValue);

api.post("/audit", payload).catch(() => {});
    },
    [currentUser.name, isAuthenticated]
  );

  return <AuditContext.Provider value={{ logs, log }}>{children}</AuditContext.Provider>;
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be inside AuditProvider");
  return ctx;
}