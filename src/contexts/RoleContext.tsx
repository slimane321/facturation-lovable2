/**
 * RoleContext — User roles from Supabase.
 * Reads profile + role from DB for the authenticated user.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'agent' | 'comptable';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface RoleContextType {
  currentUser: AppUser;
  users: AppUser[];
  refreshUsers: () => Promise<void>;
  isAdmin: boolean;
  isAgent: boolean;
  isComptable: boolean;
  can: (action: Permission) => boolean;
}

export type Permission =
  | 'view_revenue'
  | 'create_invoice'
  | 'validate_invoice'
  | 'delete_document'
  | 'access_settings'
  | 'close_fiscal_year'
  | 'manage_users'
  | 'export_data'
  | 'create_devis'
  | 'create_bl'
  | 'create_avoir';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view_revenue', 'create_invoice', 'validate_invoice', 'delete_document',
    'access_settings', 'close_fiscal_year', 'manage_users', 'export_data',
    'create_devis', 'create_bl', 'create_avoir',
  ],
  agent: [
    'create_invoice', 'create_devis', 'create_bl', 'export_data',
  ],
  comptable: [
    'view_revenue', 'export_data',
  ],
};

const FALLBACK_USER: AppUser = {
  id: '',
  name: 'Chargement…',
  email: '',
  role: 'agent',
  createdAt: new Date().toISOString(),
};

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [currentUser, setCurrentUser] = useState<AppUser>(FALLBACK_USER);
  const [users, setUsers] = useState<AppUser[]>([]);

  const fetchCurrentUserRole = useCallback(async () => {
    if (!user) return;

    // Fetch profile
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch role
    const { data: roleData } = await (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const role = (roleData?.role as UserRole) || 'agent';
    const displayName = profile?.display_name || user.email?.split('@')[0] || 'Utilisateur';

    setCurrentUser({
      id: user.id,
      name: displayName,
      email: user.email || '',
      role,
      createdAt: user.created_at || new Date().toISOString(),
    });
  }, [user]);

  const refreshUsers = useCallback(async () => {
    // Only admins can see all users (RLS enforces this)
    const { data: profiles } = await (supabase as any)
      .from('profiles')
      .select('*');

    const { data: roles } = await (supabase as any)
      .from('user_roles')
      .select('*');

    if (profiles && roles) {
      const roleMap: Record<string, UserRole> = {};
      (roles as any[]).forEach((r: any) => { roleMap[r.user_id] = r.role; });

      setUsers((profiles as any[]).map((p: any) => ({
        id: p.id,
        name: p.display_name || p.email,
        email: p.email,
        role: roleMap[p.id] || 'agent',
        createdAt: p.created_at,
      })));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchCurrentUserRole();
      refreshUsers();
    }
  }, [isAuthenticated, user, fetchCurrentUserRole, refreshUsers]);

  const can = useCallback((action: Permission): boolean => {
    return ROLE_PERMISSIONS[currentUser.role]?.includes(action) ?? false;
  }, [currentUser.role]);

  return (
    <RoleContext.Provider value={{
      currentUser,
      users,
      refreshUsers,
      isAdmin: currentUser.role === 'admin',
      isAgent: currentUser.role === 'agent',
      isComptable: currentUser.role === 'comptable',
      can,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be inside RoleProvider');
  return ctx;
}
