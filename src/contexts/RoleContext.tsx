import React, { createContext, useContext, useEffect, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/api/client";

export type UserRole = "admin" | "agent" | "comptable";

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
  | "view_revenue"
  | "create_invoice"
  | "validate_invoice"
  | "delete_document"
  | "access_settings"
  | "close_fiscal_year"
  | "manage_users"
  | "export_data"
  | "create_devis"
  | "create_bl"
  | "create_avoir";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ["view_revenue", "create_invoice", "validate_invoice", "delete_document", "access_settings", "close_fiscal_year", "manage_users", "export_data", "create_devis", "create_bl", "create_avoir"],
  agent: ["create_invoice", "create_devis", "create_bl", "export_data"],
  comptable: ["view_revenue", "export_data"],
};

const FALLBACK_USER: AppUser = {
  id: "",
  name: "Chargement…",
  email: "",
  role: "agent",
  createdAt: new Date().toISOString(),
};

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [currentUser, setCurrentUser] = useState<AppUser>(FALLBACK_USER);
  const [users, setUsers] = useState<AppUser[]>([]);

  const fetchMe = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    const me = await api.get<AppUser>("/users/me");
    setCurrentUser(me);
  }, [isAuthenticated, user]);

  const refreshUsers = useCallback(async () => {
    try {
      const list = await api.get<AppUser[]>("/users");
      setUsers(list);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchMe();
      refreshUsers();
    } else {
      setCurrentUser(FALLBACK_USER);
      setUsers([]);
    }
  }, [isAuthenticated, user, fetchMe, refreshUsers]);

  const can = useCallback((action: Permission) => {
    return ROLE_PERMISSIONS[currentUser.role]?.includes(action) ?? false;
  }, [currentUser.role]);

  return (
    <RoleContext.Provider
      value={{
        currentUser,
        users,
        refreshUsers,
        isAdmin: currentUser.role === "admin",
        isAgent: currentUser.role === "agent",
        isComptable: currentUser.role === "comptable",
        can,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be inside RoleProvider");
  return ctx;
}