import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  name: 'Votre Société SARL',
  ice: '001234567891234',
  ifNumber: '12345678',
  rc: 'RC 12345',
  patente: '12345678',
  cnss: '1234567',
  address: '1 Avenue Hassan II',
  city: 'Casablanca 20000',
  tel: '+212 5 22 00 00 00',
  email: 'contact@votresociete.ma',
  website: 'www.votresociete.ma',
  rib: 'BMCE 011 810 0000123456789012 47',
  bank: 'Bank of Africa',
  logoUrl: '',
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

// DB row → app model
function dbToApp(row: any): CompanySettings {
  return {
    name: row.name || DEFAULT_SETTINGS.name,
    ice: row.ice || '',
    ifNumber: row.if_number || '',
    rc: row.rc || '',
    patente: row.patente || '',
    cnss: row.cnss || '',
    address: row.address || '',
    city: row.city || '',
    tel: row.tel || '',
    email: row.email || '',
    website: row.website || undefined,
    rib: row.rib || '',
    bank: row.bank || '',
    logoUrl: row.logo_url || undefined,
    capitalSocial: row.capital_social || undefined,
  };
}

// App model → DB row (partial)
function appToDb(s: Partial<CompanySettings>): Record<string, any> {
  const map: Record<string, any> = {};
  if (s.name !== undefined) map.name = s.name;
  if (s.ice !== undefined) map.ice = s.ice;
  if (s.ifNumber !== undefined) map.if_number = s.ifNumber;
  if (s.rc !== undefined) map.rc = s.rc;
  if (s.patente !== undefined) map.patente = s.patente;
  if (s.cnss !== undefined) map.cnss = s.cnss;
  if (s.address !== undefined) map.address = s.address;
  if (s.city !== undefined) map.city = s.city;
  if (s.tel !== undefined) map.tel = s.tel;
  if (s.email !== undefined) map.email = s.email;
  if (s.website !== undefined) map.website = s.website;
  if (s.rib !== undefined) map.rib = s.rib;
  if (s.bank !== undefined) map.bank = s.bank;
  if (s.logoUrl !== undefined) map.logo_url = s.logoUrl;
  if (s.capitalSocial !== undefined) map.capital_social = s.capitalSocial;
  return map;
}

const CS_TABLE = 'company_settings' as any;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);
  const [closedYears, setClosedYears] = useState<number[]>([]);
  const [masterHashes, setMasterHashes] = useState<Record<number, string>>({});

  // Fetch company settings from DB (single row pattern)
  const fetchSettings = useCallback(async () => {
    const { data, error } = await (supabase.from(CS_TABLE) as any).select('*').limit(1);
    if (!error && data && data.length > 0) {
      setSettings(dbToApp(data[0]));
      setSettingsRowId(data[0].id);
    } else if (!error && (!data || data.length === 0)) {
      // Seed initial row with defaults
      const dbDefaults = appToDb(DEFAULT_SETTINGS);
      const { data: inserted } = await (supabase.from(CS_TABLE) as any).insert(dbDefaults).select().single();
      if (inserted) {
        setSettingsRowId(inserted.id);
        setSettings(dbToApp(inserted));
      }
    }
  }, []);

  // Fetch closed fiscal years from DB
  const fetchClosedYears = useCallback(async () => {
    const { data, error } = await supabase
      .from('closed_fiscal_years')
      .select('*')
      .order('year', { ascending: true });
    if (!error && data) {
      setClosedYears(data.map(r => r.year));
      const hashes: Record<number, string> = {};
      data.forEach(r => { if (r.master_hash) hashes[r.year] = r.master_hash; });
      setMasterHashes(hashes);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchClosedYears();
  }, [fetchSettings, fetchClosedYears]);

  const updateSettings = async (updates: Partial<CompanySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    if (settingsRowId) {
      const dbUpdates = appToDb(updates);
      await (supabase.from(CS_TABLE) as any).update(dbUpdates).eq('id', settingsRowId);
    }
  };

  const closeYear = async (year: number) => {
    if (closedYears.includes(year)) return;
    setClosedYears(prev => [...prev, year].sort());
    const { error } = await supabase
      .from('closed_fiscal_years')
      .insert({ year, master_hash: masterHashes[year] || null });
    if (error) {
      console.error('closeYear error:', error);
      setClosedYears(prev => prev.filter(y => y !== year));
    }
  };

  const reopenYear = async (year: number) => {
    const prev = closedYears;
    setClosedYears(closedYears.filter(y => y !== year));
    const { error } = await supabase
      .from('closed_fiscal_years')
      .delete()
      .eq('year', year);
    if (error) {
      console.error('reopenYear error:', error);
      setClosedYears(prev);
    }
  };

  const isYearClosed = (year: number) => closedYears.includes(year);

  const setMasterHash = async (year: number, hash: string) => {
    setMasterHashes(prev => ({ ...prev, [year]: hash }));
    await supabase
      .from('closed_fiscal_years')
      .update({ master_hash: hash })
      .eq('year', year);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, closedYears, closeYear, reopenYear, isYearClosed, masterHashes, setMasterHash }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider');
  return ctx;
}
