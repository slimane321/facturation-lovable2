import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { InvoiceLine } from '@/lib/moroccanUtils';
import { calculateTotals } from '@/lib/moroccanUtils';
import { useAudit } from '@/contexts/AuditContext';
import { useData } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { api } from '@/integrations/api/client';
import { useAuth } from "@/contexts/AuthContext";

export type DevisStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'converted';
export type BCStatus = 'pending' | 'confirmed' | 'received' | 'converted';
export type BLStatus = 'prepared' | 'delivered' | 'signed' | 'invoiced';
export type AchatStatus = 'pending' | 'received' | 'paid';

export type PaymentMethod = 'Espèces' | 'Virement' | 'Chèque' | 'Effet';
export const PAYMENT_METHODS_DOC: PaymentMethod[] = ['Espèces', 'Virement', 'Chèque', 'Effet'];

export interface Devis {
  id: string;
  number: string;
  date: string;
  validUntil: string;
  clientId: string;
  lines: InvoiceLine[];
  status: DevisStatus;
  notes?: string;
  totals: ReturnType<typeof calculateTotals>;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  convertedToBCId?: string;
  convertedToInvoiceId?: string;
  isConverted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BonCommande {
  id: string;
  number: string;
  date: string;
  clientId: string;
  lines: InvoiceLine[];
  status: BCStatus;
  devisId?: string;
  notes?: string;
  totals: ReturnType<typeof calculateTotals>;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  convertedToBLId?: string;
  isConverted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BonLivraison {
  id: string;
  number: string;
  date: string;
  clientId: string;
  lines: InvoiceLine[];
  status: BLStatus;
  bcId?: string;
  devisId?: string;
  notes?: string;
  totals: ReturnType<typeof calculateTotals>;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  convertedToInvoiceId?: string;
  sourceInvoiceId?: string;
  isConverted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Achat {
  id: string;
  supplierInvoiceNumber: string;
  supplierName: string;
  supplierICE?: string;
  date: string;
  dueDate: string;
  lines: InvoiceLine[];
  status: AchatStatus;
  notes?: string;
  totals: ReturnType<typeof calculateTotals>;
  createdAt: string;
  updatedAt: string;
}


function nowIso() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().split('T')[0]; }

function nextNumber(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .filter(n => n.startsWith(`${prefix}-${year}-`))
    .map(n => parseInt(n.split('-').pop() ?? '0', 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}

interface DocumentContextType {
  devisList: Devis[];
  bcList: BonCommande[];
  blList: BonLivraison[];
  achatsList: Achat[];

  addDevis: (d: Omit<Devis, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'totals'>) => Devis;
  updateDevis: (id: string, updates: Partial<Devis>) => void;
  deleteDevis: (id: string) => void;
  convertDevisToBC: (devisId: string) => BonCommande;

  addBC: (bc: Omit<BonCommande, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'totals'>) => BonCommande;
  updateBC: (id: string, updates: Partial<BonCommande>) => void;
  deleteBC: (id: string) => void;
  convertBCToBL: (bcId: string) => BonLivraison;

  addBL: (bl: Omit<BonLivraison, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'totals'>) => BonLivraison;
  updateBL: (id: string, updates: Partial<BonLivraison>) => void;
  deleteBL: (id: string) => void;

  convertBLToInvoiceData: (blId: string, invoiceId?: string) => {
    clientId: string;
    lines: InvoiceLine[];
    notes?: string;
    blNumber: string;
    totals: ReturnType<typeof calculateTotals>;
    dueDate?: string;
    paymentMethod?: PaymentMethod;
    paymentRef?: string;
    setInvoiceId: (id: string) => void;
  } | null;

  addAchat: (a: Omit<Achat, 'id' | 'createdAt' | 'updatedAt' | 'totals'>) => Achat;
  updateAchat: (id: string, updates: Partial<Achat>) => void;
  deleteAchat: (id: string) => void;
}

const DocumentContext = createContext<DocumentContextType | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const { log: auditLog } = useAudit();
  const { adjustStock, products } = useData();
  const { isYearClosed } = useSettings();
  const { isAuthenticated, loading } = useAuth();
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [bcList, setBCList] = useState<BonCommande[]>([]);
  const [blList, setBLList] = useState<BonLivraison[]>([]);
  const [achatsList, setAchatsList] = useState<Achat[]>([]);

const reset = useCallback(() => {
  setDevisList([]);
  setBCList([]);
  setBLList([]);
  setAchatsList([]);
}, []);

const refreshBootstrap = useCallback(async () => {
  if (!isAuthenticated) return;

  const data = await api.get<any>('/docs/bootstrap');

  setDevisList((data?.devis || []).map((d: any) => ({ ...d, totals: calculateTotals(d.lines || []) })));
  setBCList((data?.bc || []).map((b: any) => ({ ...b, totals: calculateTotals(b.lines || []) })));
  setBLList((data?.bl || []).map((b: any) => ({ ...b, totals: calculateTotals(b.lines || []) })));
  setAchatsList((data?.achats || []).map((a: any) => ({ ...a, totals: calculateTotals(a.lines || []) })));
}, [isAuthenticated]);

useEffect(() => {
  if (loading) return;

  if (!isAuthenticated) {
    reset();
    return;
  }

  refreshBootstrap().catch(() => {
    reset();
  });
}, [loading, isAuthenticated, refreshBootstrap, reset]);

  const decreaseStockForLines = (lines: InvoiceLine[], documentRef?: string) => {
    for (const line of lines) {
      const product = products.find(p => p.name === line.description || p.reference === line.description);
      if (product) adjustStock(product.id, -Math.abs(line.quantity), 'sale', documentRef);
    }
  };
  const increaseStockForLines = (lines: InvoiceLine[], type: 'purchase' | 'return' = 'purchase', documentRef?: string) => {
    for (const line of lines) {
      const product = products.find(p => p.name === line.description || p.reference === line.description);
      if (product) adjustStock(product.id, Math.abs(line.quantity), type, documentRef);
    }
  };

  // ── Devis
  const addDevis: DocumentContextType['addDevis'] = (d) => {
    const num = nextNumber('DV', devisList.map(x => x.number));
    const tempId = `dv${Date.now()}`;
    const item: Devis = {
      ...d,
      id: tempId,
      number: num,
      totals: calculateTotals(d.lines),
      isConverted: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setDevisList(prev => [...prev, item]);
    auditLog({ action: 'Création devis', documentType: 'Devis', documentId: tempId, documentNumber: num });

    api.post<any>('/docs/devis', {
      number: num,
      date: d.date,
      validUntil: d.validUntil || d.date,
      clientId: d.clientId,
      status: d.status,
      notes: d.notes || null,
      paymentMethod: d.paymentMethod || null,
      paymentRef: d.paymentRef || null,
      isConverted: false,
      convertedToBCId: null,
      convertedToInvoiceId: null,
      lines: d.lines,
    }).then(created => {
      setDevisList(prev => prev.map(x => x.id === tempId ? { ...created, totals: calculateTotals(created.lines || []) } : x));
    }).catch(() => {});
    return item;
  };

  const updateDevis: DocumentContextType['updateDevis'] = (id, updates) => {
    setDevisList(prev => prev.map(d => d.id === id ? { ...d, ...updates, totals: calculateTotals((updates.lines || d.lines) as any), updatedAt: nowIso() } : d));
    const merged = { ...(devisList.find(x => x.id === id) || {}), ...(updates || {}) } as any;
    api.put(`/docs/devis/${id}`, {
      number: merged.number,
      date: merged.date,
      validUntil: merged.validUntil || merged.date,
      clientId: merged.clientId,
      status: merged.status,
      notes: merged.notes || null,
      paymentMethod: merged.paymentMethod || null,
      paymentRef: merged.paymentRef || null,
      isConverted: !!merged.isConverted,
      convertedToBCId: merged.convertedToBCId || null,
      convertedToInvoiceId: merged.convertedToInvoiceId || null,
      lines: merged.lines || [],
    }).catch(() => {});
  };

  const deleteDevis: DocumentContextType['deleteDevis'] = (id) => {
    setDevisList(prev => prev.filter(d => d.id !== id));
    api.del(`/docs/devis/${id}`).catch(() => {});
  };

  const convertDevisToBC: DocumentContextType['convertDevisToBC'] = (devisId) => {
    const devis = devisList.find(d => d.id === devisId);
    if (!devis) throw new Error('Devis introuvable');
    if (devis.isConverted) throw new Error('Devis déjà converti');
    const y = new Date(devis.date).getFullYear();
    if (isYearClosed(y)) throw new Error(`Exercice ${y} clôturé`);

    const bc = addBC({
      date: todayStr(),
      clientId: devis.clientId,
      lines: devis.lines,
      status: 'pending',
      devisId,
      notes: devis.notes,
      paymentMethod: devis.paymentMethod,
      paymentRef: devis.paymentRef,
      isConverted: false,
    });

    updateDevis(devisId, { status: 'converted', isConverted: true, convertedToBCId: bc.id });
    return bc;
  };

  // ── BC
  const addBC: DocumentContextType['addBC'] = (bc) => {
    const num = nextNumber('BC', bcList.map(x => x.number));
    const tempId = `bc${Date.now()}`;
    const item: BonCommande = {
      ...bc,
      id: tempId,
      number: num,
      totals: calculateTotals(bc.lines),
      isConverted: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setBCList(prev => [...prev, item]);
    auditLog({ action: 'Création bon de commande', documentType: 'BonCommande', documentId: tempId, documentNumber: num });

    api.post<any>('/docs/bc', {
      number: num,
      date: bc.date,
      clientId: bc.clientId,
      status: bc.status,
      devisId: bc.devisId || null,
      notes: bc.notes || null,
      paymentMethod: bc.paymentMethod || null,
      paymentRef: bc.paymentRef || null,
      isConverted: false,
      convertedToBLId: null,
      lines: bc.lines,
    }).then(created => {
      setBCList(prev => prev.map(x => x.id === tempId ? { ...created, totals: calculateTotals(created.lines || []) } : x));
    }).catch(() => {});
    return item;
  };

  const updateBC: DocumentContextType['updateBC'] = (id, updates) => {
    setBCList(prev => prev.map(b => b.id === id ? { ...b, ...updates, totals: calculateTotals((updates.lines || b.lines) as any), updatedAt: nowIso() } : b));
    const merged = { ...(bcList.find(x => x.id === id) || {}), ...(updates || {}) } as any;
    api.put(`/docs/bc/${id}`, {
      number: merged.number,
      date: merged.date,
      clientId: merged.clientId,
      status: merged.status,
      devisId: merged.devisId || null,
      notes: merged.notes || null,
      paymentMethod: merged.paymentMethod || null,
      paymentRef: merged.paymentRef || null,
      isConverted: !!merged.isConverted,
      convertedToBLId: merged.convertedToBLId || null,
      lines: merged.lines || [],
    }).catch(() => {});
  };

  const deleteBC: DocumentContextType['deleteBC'] = (id) => {
    setBCList(prev => prev.filter(b => b.id !== id));
    api.del(`/docs/bc/${id}`).catch(() => {});
  };

  const convertBCToBL: DocumentContextType['convertBCToBL'] = (bcId) => {
    const bc = bcList.find(b => b.id === bcId);
    if (!bc) throw new Error('BC introuvable');
    if (bc.isConverted) throw new Error('BC déjà converti');
    const y = new Date(bc.date).getFullYear();
    if (isYearClosed(y)) throw new Error(`Exercice ${y} clôturé`);

    const bl = addBL({
      date: todayStr(),
      clientId: bc.clientId,
      lines: bc.lines,
      status: 'prepared',
      bcId,
      devisId: bc.devisId,
      notes: bc.notes,
      paymentMethod: bc.paymentMethod,
      paymentRef: bc.paymentRef,
      isConverted: false,
    });

    updateBC(bcId, { status: 'converted', isConverted: true, convertedToBLId: bl.id });
    return bl;
  };

  // ── BL
  const addBL: DocumentContextType['addBL'] = (bl) => {
    const num = nextNumber('BL', blList.map(x => x.number));
    const tempId = `bl${Date.now()}`;
    const item: BonLivraison = {
      ...bl,
      id: tempId,
      number: num,
      totals: calculateTotals(bl.lines),
      isConverted: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setBLList(prev => [...prev, item]);
    auditLog({ action: 'Création bon de livraison', documentType: 'BonLivraison', documentId: tempId, documentNumber: num });

    api.post<any>('/docs/bl', {
      number: num,
      date: bl.date,
      clientId: bl.clientId,
      status: bl.status,
      bcId: bl.bcId || null,
      devisId: bl.devisId || null,
      notes: bl.notes || null,
      paymentMethod: bl.paymentMethod || null,
      paymentRef: bl.paymentRef || null,
      isConverted: false,
      convertedToInvoiceId: null,
      sourceInvoiceId: bl.sourceInvoiceId || null,
      lines: bl.lines,
    }).then(created => {
      setBLList(prev => prev.map(x => x.id === tempId ? { ...created, totals: calculateTotals(created.lines || []) } : x));
    }).catch(() => {});
    return item;
  };

  const updateBL: DocumentContextType['updateBL'] = (id, updates) => {
    setBLList(prev => prev.map(b => b.id === id ? { ...b, ...updates, totals: calculateTotals((updates.lines || b.lines) as any), updatedAt: nowIso() } : b));
    const merged = { ...(blList.find(x => x.id === id) || {}), ...(updates || {}) } as any;
    api.put(`/docs/bl/${id}`, {
      number: merged.number,
      date: merged.date,
      clientId: merged.clientId,
      status: merged.status,
      bcId: merged.bcId || null,
      devisId: merged.devisId || null,
      notes: merged.notes || null,
      paymentMethod: merged.paymentMethod || null,
      paymentRef: merged.paymentRef || null,
      isConverted: !!merged.isConverted,
      convertedToInvoiceId: merged.convertedToInvoiceId || null,
      sourceInvoiceId: merged.sourceInvoiceId || null,
      lines: merged.lines || [],
    }).catch(() => {});
  };

  const deleteBL: DocumentContextType['deleteBL'] = (id) => {
    setBLList(prev => prev.filter(b => b.id !== id));
    api.del(`/docs/bl/${id}`).catch(() => {});
  };

  const convertBLToInvoiceData: DocumentContextType['convertBLToInvoiceData'] = (blId, invoiceId) => {
    const bl = blList.find(b => b.id === blId);
    if (!bl) return null;
    if (bl.isConverted) return null;
    if (bl.sourceInvoiceId) return null;

    const y = new Date(bl.date).getFullYear();
    if (isYearClosed(y)) return null;

    const lines = bl.lines.map(l => ({ ...l }));
    const totals = calculateTotals(lines);

    setBLList(prev => prev.map(b => b.id === blId ? { ...b, status: 'invoiced', isConverted: true, convertedToInvoiceId: invoiceId, updatedAt: nowIso() } : b));
    api.put(`/docs/bl/${blId}`, { ...bl, status: 'invoiced', isConverted: true, convertedToInvoiceId: invoiceId || null, lines }).catch(() => {});

    // Stock movement (delivery -> invoice) usually decreases stock when invoiced; if you already did at invoice validation, skip.
    // decreaseStockForLines(lines, bl.number);

    return {
      clientId: bl.clientId,
      lines,
      notes: bl.notes,
      blNumber: bl.number,
      totals,
      dueDate: bl.dueDate,
      paymentMethod: bl.paymentMethod,
      paymentRef: bl.paymentRef,
      setInvoiceId: (id) => {
        setBLList(prev => prev.map(b => b.id === blId ? { ...b, convertedToInvoiceId: id, updatedAt: nowIso() } : b));
        api.put(`/docs/bl/${blId}`, { ...bl, convertedToInvoiceId: id, status: 'invoiced', isConverted: true, lines }).catch(() => {});
      },
    };
  };

  // ── Achats
  const addAchat: DocumentContextType['addAchat'] = (a) => {
    const tempId = `a${Date.now()}`;
    const item: Achat = {
      ...a,
      id: tempId,
      totals: calculateTotals(a.lines),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setAchatsList(prev => [...prev, item]);

    api.post<any>('/docs/achats', {
      supplierInvoiceNumber: a.supplierInvoiceNumber,
      supplierName: a.supplierName,
      supplierICE: a.supplierICE || null,
      date: a.date,
      dueDate: a.dueDate || a.date,
      status: a.status,
      notes: a.notes || null,
      lines: a.lines,
    }).then(created => {
      setAchatsList(prev => prev.map(x => x.id === tempId ? { ...created, totals: calculateTotals(created.lines || []) } : x));
    }).catch(() => {});

    increaseStockForLines(a.lines, 'purchase', a.supplierInvoiceNumber);
    auditLog({ action: 'Création achat', documentType: 'Achat', documentId: tempId, documentNumber: a.supplierInvoiceNumber });
    return item;
  };

  const updateAchat: DocumentContextType['updateAchat'] = (id, updates) => {
    setAchatsList(prev => prev.map(a => a.id === id ? { ...a, ...updates, totals: calculateTotals((updates.lines || a.lines) as any), updatedAt: nowIso() } : a));
    const merged = { ...(achatsList.find(x => x.id === id) || {}), ...(updates || {}) } as any;
    api.put(`/docs/achats/${id}`, {
      supplierInvoiceNumber: merged.supplierInvoiceNumber,
      supplierName: merged.supplierName,
      supplierICE: merged.supplierICE || null,
      date: merged.date,
      dueDate: merged.dueDate || merged.date,
      status: merged.status,
      notes: merged.notes || null,
      lines: merged.lines || [],
    }).catch(() => {});
  };

  const deleteAchat: DocumentContextType['deleteAchat'] = (id) => {
    setAchatsList(prev => prev.filter(a => a.id !== id));
    api.del(`/docs/achats/${id}`).catch(() => {});
  };

  return (
    <DocumentContext.Provider value={{
      devisList, bcList, blList, achatsList,
      addDevis, updateDevis, deleteDevis, convertDevisToBC,
      addBC, updateBC, deleteBC, convertBCToBL,
      addBL, updateBL, deleteBL, convertBLToInvoiceData,
      addAchat, updateAchat, deleteAchat,
    }}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentProvider');
  return ctx;
}