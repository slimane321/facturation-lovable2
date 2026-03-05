/**
 * AuditContext — Append-only audit trail persisted in Supabase audit_logs table.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRole } from '@/contexts/RoleContext';
import { supabase } from '@/integrations/supabase/client';

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
  log: (entry: Omit<AuditEntry, 'id' | 'timestamp' | 'user'>) => void;
}

const AuditContext = createContext<AuditContextType | null>(null);

function dbRowToAuditEntry(row: any): AuditEntry {
  return {
    id: row.id,
    timestamp: row.created_at,
    user: row.user_name || '',
    action: row.action,
    documentType: row.document_type,
    documentId: row.document_id || '',
    documentNumber: row.document_number || undefined,
    details: row.details || undefined,
    oldValue: row.old_value ? JSON.stringify(row.old_value) : undefined,
    newValue: row.new_value ? JSON.stringify(row.new_value) : undefined,
  };
}

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const { currentUser } = useRole();

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setLogs(data.map(dbRowToAuditEntry));
      });
  }, []);

  const log = useCallback((entry: Omit<AuditEntry, 'id' | 'timestamp' | 'user'>) => {
    const tempEntry: AuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      user: currentUser.name,
    };
    setLogs(prev => [tempEntry, ...prev]);

    supabase.from('audit_logs').insert({
      user_name: currentUser.name,
      action: entry.action,
      document_type: entry.documentType,
      document_id: entry.documentId || null,
      document_number: entry.documentNumber || null,
      details: entry.details || null,
      old_value: entry.oldValue ? JSON.parse(entry.oldValue) : null,
      new_value: entry.newValue ? JSON.parse(entry.newValue) : null,
    }).select().single().then(({ data }) => {
      if (data) {
        setLogs(prev => prev.map(l => l.id === tempEntry.id ? dbRowToAuditEntry(data) : l));
      }
    });
  }, [currentUser.name]);

  return (
    <AuditContext.Provider value={{ logs, log }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be inside AuditProvider');
  return ctx;
}
