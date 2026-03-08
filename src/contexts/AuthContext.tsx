import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from "react";
import { api } from "@/integrations/api/client";
import {
  connectSocket,
  disconnectSocket,
  refreshSocketAuth,
} from "@/integrations/realtime/socket";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "fm_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      disconnectSocket();
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(me.user);

      refreshSocketAuth();
      connectSocket();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      disconnectSocket();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post<{ token: string; user: AuthUser }>(
        "/auth/login",
        { email, password }
      );

      localStorage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);

      refreshSocketAuth();
      connectSocket();

      return { success: true };
    } catch (e: any) {
      disconnectSocket();

      return {
        success: false,
        error: e?.message || "Identifiants incorrects.",
      };
    }
  }, []);

  const logout = useCallback(async () => {
    disconnectSocket();
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        loading,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}