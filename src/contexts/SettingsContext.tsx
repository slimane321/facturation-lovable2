import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CompanySettings {
  name: string;
  ice: string;
  ifNumber: string;
  rc: string;
  patente: string;
  cnss: string;
  address: string;
  city: string;
  tel: string;
  email: string;
  website?: string;
  rib: string;
  bank: string;
  logoUrl?: string;
  capitalSocial?: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  name: "Votre Société SARL",
  ice: "001234567891234",
  ifNumber: "12345678",
  rc: "RC 12345",
  patente: "12345678",
  cnss: "1234567",
  address: "1 Avenue Hassan II",
  city: "Casablanca 20000",
  tel: "+212 5 22 00 00 00",
  email: "contact@votresociete.ma",
  website: "www.votresociete.ma",
  rib: "BMCE 011 810 0000123456789012 47",
  bank: "Bank of Africa",
  logoUrl: "",
};

interface SettingsContextType {
  settings: CompanySettings;
  updateSettings: (updates: Partial<CompanySettings>) => void;
  closedYears: number[];
  closeYear: (year: number) => void;
  reopenYear: (year: number) => void;
  isYearClosed: (year: number) => boolean;
  masterHashes: Record<number, string>;
  setMasterHash: (year: number, hash: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [closedYears, setClosedYears] = useState<number[]>([]);
  const [masterHashes, setMasterHashes] = useState<Record<number, string>>({});

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setClosedYears([]);
    setMasterHashes({});
  }, []);

  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const row = await api.get<any>("/settings");
      if (row) {
        setSettings({
          name: row.name ?? DEFAULT_SETTINGS.name,
          ice: row.ice ?? "",
          ifNumber: row.ifNumber ?? "",
          rc: row.rc ?? "",
          patente: row.patente ?? "",
          cnss: row.cnss ?? "",
          address: row.address ?? "",
          city: row.city ?? "",
          tel: row.tel ?? "",
          email: row.email ?? "",
          website: row.website ?? undefined,
          rib: row.rib ?? "",
          bank: row.bank ?? "",
          logoUrl: row.logoUrl ?? undefined,
          capitalSocial: row.capitalSocial ?? undefined,
        });
      }
    } catch {
      // keep defaults
    }
  }, [isAuthenticated]);

  const fetchClosedYears = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const rows = await api.get<any[]>("/closed-years");
      setClosedYears((rows || []).map((r) => r.year));
      const hashes: Record<number, string> = {};
      (rows || []).forEach((r) => {
        if (r.masterHash) hashes[r.year] = r.masterHash;
      });
      setMasterHashes(hashes);
    } catch {
      setClosedYears([]);
      setMasterHashes({});
    }
  }, [isAuthenticated]);

  // Fetch only after auth is ready
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      reset();
      return;
    }
    fetchSettings();
    fetchClosedYears();
  }, [loading, isAuthenticated, fetchSettings, fetchClosedYears, reset]);

  const updateSettings = useCallback(
    async (updates: Partial<CompanySettings>) => {
      if (!isAuthenticated) return;
      setSettings((prev) => ({ ...prev, ...updates }));
      await api.put("/settings", updates).catch(() => {});
    },
    [isAuthenticated]
  );

  const closeYear = useCallback(
    async (year: number) => {
      if (!isAuthenticated) return;
      if (closedYears.includes(year)) return;
      setClosedYears((prev) => [...prev, year].sort());
      await api.post(`/closed-years/${year}/close`, { masterHash: masterHashes[year] ?? null }).catch(() => {});
    },
    [isAuthenticated, closedYears, masterHashes]
  );

  const reopenYear = useCallback(
    async (year: number) => {
      if (!isAuthenticated) return;
      setClosedYears((prev) => prev.filter((y) => y !== year));
      await api.post(`/closed-years/${year}/reopen`).catch(() => {});
    },
    [isAuthenticated]
  );

  const isYearClosed = useCallback((year: number) => closedYears.includes(year), [closedYears]);

  const setMasterHash = useCallback(
    async (year: number, hash: string) => {
      if (!isAuthenticated) return;
      setMasterHashes((prev) => ({ ...prev, [year]: hash }));
      await api.post(`/closed-years/${year}/close`, { masterHash: hash }).catch(() => {});
    },
    [isAuthenticated]
  );

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, closedYears, closeYear, reopenYear, isYearClosed, masterHashes, setMasterHash }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
}