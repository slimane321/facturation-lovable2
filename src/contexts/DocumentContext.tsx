/**
 * DocumentContext — manages Devis, Bon de Commande, Bon de Livraison, and Achats.
 * Persisted in Supabase tables.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { InvoiceLine, VatRate } from '@/lib/moroccanUtils';
import { calculateTotals } from '@/lib/moroccanUtils';
import { useAudit } from '@/contexts/AuditContext';
import { useData } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  dueDate?: string;
  clientId: string;
  lines: InvoiceLine[];
  status: DevisStatus;
  notes?: string;
  totals: ReturnType<typeof calculateTotals>;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  convertedToId?: string;
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
  dueDate?: string;
  clientId: string;
  lines: InvoiceLine[];
  status: BCStatus;
  devisId?: string;
  notes?: string;
  totals: ReturnType<typeof calculateTotals>;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  convertedToId?: string;
  convertedToBLId?: string;
  isConverted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BonLivraison {
  id: string;
  number: string;
  date: string;
  dueDate?: string;
  clientId: string;
  lines: InvoiceLine[];
  status: BLStatus;
  bcId?: string;
  devisId?: string;
  notes?: string;
  totals: ReturnType<typeof calculateTotals>;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  convertedToId?: string;
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

// ── Numbering helpers ─────────────────────────────────────────────────────────

function nextNumber(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .filter(n => n.startsWith(`${prefix}-${year}-`))
    .map(n => parseInt(n.split('-').pop() ?? '0', 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}

// ── DB mappers ────────────────────────────────────────────────────────────────

function dbLinesToApp(rows: any[]): InvoiceLine[] {
  return rows.map(r => ({
    id: r.id,
    description: r.description,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    vatRate: r.vat_rate as VatRate,
  }));
}

function dbDevisToApp(row: any, lines: InvoiceLine[]): Devis {
  const totals = calculateTotals(lines);
  return {
    id: row.id,
    number: row.number,
    date: row.devis_date,
    validUntil: row.validity_date || row.devis_date,
    clientId: row.client_id,
    lines,
    status: mapDevisStatus(row.status),
    notes: row.notes || undefined,
    totals,
    paymentMethod: row.payment_method || undefined,
    isConverted: row.is_converted,
    convertedToBCId: row.converted_bc_id || undefined,
    convertedToId: row.converted_bc_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDevisStatus(s: string): DevisStatus {
  const map: Record<string, DevisStatus> = {
    draft: 'draft', sent: 'sent', accepted: 'accepted',
    rejected: 'refused', expired: 'draft', converted: 'converted',
  };
  return map[s] || 'draft';
}

function dbBCToApp(row: any, lines: InvoiceLine[]): BonCommande {
  const totals = calculateTotals(lines);
  return {
    id: row.id,
    number: row.number,
    date: row.bc_date,
    clientId: row.client_id,
    lines,
    status: mapBCStatus(row.status),
    devisId: row.source_devis_id || undefined,
    notes: row.notes || undefined,
    totals,
    paymentMethod: row.payment_method || undefined,
    isConverted: row.is_converted,
    convertedToBLId: row.converted_bl_id || undefined,
    convertedToId: row.converted_bl_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBCStatus(s: string): BCStatus {
  const map: Record<string, BCStatus> = {
    draft: 'pending', confirmed: 'confirmed', converted: 'converted', cancelled: 'pending',
  };
  return map[s] || 'pending';
}

function dbBLToApp(row: any, lines: InvoiceLine[]): BonLivraison {
  const totals = calculateTotals(lines);
  return {
    id: row.id,
    number: row.number,
    date: row.bl_date,
    clientId: row.client_id,
    lines,
    status: mapBLStatus(row.status),
    bcId: row.source_bc_id || undefined,
    notes: row.notes || undefined,
    totals,
    isConverted: row.is_converted,
    convertedToInvoiceId: row.linked_invoice_id || undefined,
    convertedToId: row.linked_invoice_id || undefined,
    sourceInvoiceId: row.source_invoice_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBLStatus(s: string): BLStatus {
  const map: Record<string, BLStatus> = {
    draft: 'prepared', delivered: 'delivered', converted: 'invoiced', cancelled: 'prepared',
  };
  return map[s] || 'prepared';
}

function dbAchatToApp(row: any, lines: InvoiceLine[]): Achat {
  const totals = calculateTotals(lines);
  return {
    id: row.id,
    supplierInvoiceNumber: row.number,
    supplierName: row.supplier_name,
    supplierICE: row.supplier_ice || undefined,
    date: row.achat_date,
    dueDate: row.achat_date,
    lines,
    status: mapAchatStatus(row.status),
    totals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAchatStatus(s: string): AchatStatus {
  const map: Record<string, AchatStatus> = {
    draft: 'pending', validated: 'received', paid: 'paid', cancelled: 'pending',
  };
  return map[s] || 'pending';
}

function appDevisStatusToDb(s: DevisStatus): string {
  const map: Record<DevisStatus, string> = {
    draft: 'draft', sent: 'sent', accepted: 'accepted', refused: 'rejected', converted: 'converted',
  };
  return map[s] || 'draft';
}

function appBCStatusToDb(s: BCStatus): string {
  const map: Record<BCStatus, string> = {
    pending: 'draft', confirmed: 'confirmed', received: 'confirmed', converted: 'converted',
  };
  return map[s] || 'draft';
}

function appBLStatusToDb(s: BLStatus): string {
  const map: Record<BLStatus, string> = {
    prepared: 'draft', delivered: 'delivered', signed: 'delivered', invoiced: 'converted',
  };
  return map[s] || 'draft';
}

function appAchatStatusToDb(s: AchatStatus): string {
  const map: Record<AchatStatus, string> = {
    pending: 'draft', received: 'validated', paid: 'paid',
  };
  return map[s] || 'draft';
}

// ── Helper to insert lines ────────────────────────────────────────────────────

async function insertDevisLines(parentId: string, lines: InvoiceLine[]) {
  const rows = lines.map((l, i) => ({ devis_id: parentId, description: l.description, quantity: l.quantity, unit_price: l.unitPrice, vat_rate: l.vatRate, sort_order: i }));
  const { data } = await supabase.from('devis_lines').insert(rows).select();
  return data ? dbLinesToApp(data) : lines;
}
async function insertBCLines(parentId: string, lines: InvoiceLine[]) {
  const rows = lines.map((l, i) => ({ bc_id: parentId, description: l.description, quantity: l.quantity, unit_price: l.unitPrice, vat_rate: l.vatRate, sort_order: i }));
  const { data } = await supabase.from('bc_lines').insert(rows).select();
  return data ? dbLinesToApp(data) : lines;
}
async function insertBLLines(parentId: string, lines: InvoiceLine[]) {
  const rows = lines.map((l, i) => ({ bl_id: parentId, description: l.description, quantity: l.quantity, unit_price: l.unitPrice, vat_rate: l.vatRate, sort_order: i }));
  const { data } = await supabase.from('bl_lines').insert(rows).select();
  return data ? dbLinesToApp(data) : lines;
}
async function insertAchatLines(parentId: string, lines: InvoiceLine[]) {
  const rows = lines.map((l, i) => ({ achat_id: parentId, description: l.description, quantity: l.quantity, unit_price: l.unitPrice, vat_rate: l.vatRate, sort_order: i }));
  const { data } = await supabase.from('achat_lines').insert(rows).select();
  return data ? dbLinesToApp(data) : lines;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface DocumentContextType {
  devisList: Devis[];
  bcList: BonCommande[];
  blList: BonLivraison[];
  achatsList: Achat[];
  addDevis: (d: Omit<Devis, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => Devis;
  updateDevis: (id: string, updates: Partial<Devis>) => void;
  deleteDevis: (id: string) => void;
  convertDevisToBC: (devisId: string) => BonCommande;
  addBC: (bc: Omit<BonCommande, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => BonCommande;
  updateBC: (id: string, updates: Partial<BonCommande>) => void;
  deleteBC: (id: string) => void;
  convertBCToBL: (bcId: string) => BonLivraison;
  addBL: (bl: Omit<BonLivraison, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => BonLivraison;
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
  addAchat: (a: Omit<Achat, 'id' | 'createdAt' | 'updatedAt'>) => Achat;
  updateAchat: (id: string, updates: Partial<Achat>) => void;
  deleteAchat: (id: string) => void;
}

const DocumentContext = createContext<DocumentContextType | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const { log: auditLog } = useAudit();
  const { adjustStock, products } = useData();
  const { isYearClosed } = useSettings();
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [bcList, setBCList] = useState<BonCommande[]>([]);
  const [blList, setBLList] = useState<BonLivraison[]>([]);
  const [achatsList, setAchatsList] = useState<Achat[]>([]);

  const now = () => new Date().toISOString();
  const todayStr = () => new Date().toISOString().split('T')[0];

  // ── Load all data from Supabase on mount ────
  useEffect(() => {
    async function fetchAll() {
      const [devisRes, devisLinesRes, bcRes, bcLinesRes, blRes, blLinesRes, achatsRes, achatLinesRes] = await Promise.all([
        supabase.from('devis').select('*').order('created_at'),
        supabase.from('devis_lines').select('*').order('sort_order'),
        supabase.from('bon_commande').select('*').order('created_at'),
        supabase.from('bc_lines').select('*').order('sort_order'),
        supabase.from('bon_livraison').select('*').order('created_at'),
        supabase.from('bl_lines').select('*').order('sort_order'),
        supabase.from('achats').select('*').order('created_at'),
        supabase.from('achat_lines').select('*').order('sort_order'),
      ]);

      function groupLines(rows: any[], fkCol: string): Map<string, InvoiceLine[]> {
        const map = new Map<string, InvoiceLine[]>();
        for (const r of (rows || [])) {
          const key = r[fkCol];
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push({
            id: r.id,
            description: r.description,
            quantity: Number(r.quantity),
            unitPrice: Number(r.unit_price),
            vatRate: r.vat_rate as VatRate,
          });
        }
        return map;
      }

      const devisLines = groupLines(devisLinesRes.data || [], 'devis_id');
      const bcLines = groupLines(bcLinesRes.data || [], 'bc_id');
      const blLines = groupLines(blLinesRes.data || [], 'bl_id');
      const achatLines = groupLines(achatLinesRes.data || [], 'achat_id');

      if (devisRes.data) setDevisList(devisRes.data.map(r => dbDevisToApp(r, devisLines.get(r.id) || [])));
      if (bcRes.data) setBCList(bcRes.data.map(r => dbBCToApp(r, bcLines.get(r.id) || [])));
      if (blRes.data) setBLList(blRes.data.map(r => dbBLToApp(r, blLines.get(r.id) || [])));
      if (achatsRes.data) setAchatsList(achatsRes.data.map(r => dbAchatToApp(r, achatLines.get(r.id) || [])));
    }
    fetchAll();
  }, []);

  /** Decrease stock for each line item that matches a product by description/reference */
  const decreaseStockForLines = (lines: InvoiceLine[], documentRef?: string) => {
    for (const line of lines) {
      const product = products.find(p => p.name === line.description || p.reference === line.description);
      if (product) adjustStock(product.id, -Math.abs(line.quantity), 'sale', documentRef);
    }
  };

  /** Increase stock for each line item that matches a product */
  const increaseStockForLines = (lines: InvoiceLine[], type: 'purchase' | 'return' = 'purchase', documentRef?: string) => {
    for (const line of lines) {
      const product = products.find(p => p.name === line.description || p.reference === line.description);
      if (product) adjustStock(product.id, Math.abs(line.quantity), type, documentRef);
    }
  };

  // ── Devis ──────────────────────────────────────
  const addDevis = (d: Omit<Devis, 'id' | 'number' | 'createdAt' | 'updatedAt'>): Devis => {
    const num = nextNumber('DV', devisList.map(x => x.number));
    const totals = calculateTotals(d.lines);
    const tempId = `dv${Date.now()}`;
    const item: Devis = { ...d, id: tempId, number: num, totals, isConverted: false, createdAt: now(), updatedAt: now() };
    setDevisList(prev => [...prev, item]);

    supabase.from('devis').insert([{
      number: num,
      devis_date: d.date,
      validity_date: d.validUntil || null,
      client_id: d.clientId,
      status: appDevisStatusToDb(d.status) as any,
      notes: d.notes || null,
      payment_method: d.paymentMethod || null,
      subtotal_ht: totals.subtotalHT,
      total_tva: totals.totalTVA,
      total_ttc: totals.totalTTC,
    }]).select().single().then(async ({ data }) => {
      if (data) {
        const appLines = await insertDevisLines(data.id, d.lines);
        setDevisList(prev => prev.map(x => x.id === tempId ? dbDevisToApp(data, appLines) : x));
      }
    });

    auditLog({ action: 'Création devis', documentType: 'Devis', documentId: tempId, documentNumber: num });
    return item;
  };

  const updateDevis = (id: string, updates: Partial<Devis>) => {
    setDevisList(prev => prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: now() } : d));
    const dbU: any = {};
    if (updates.status) dbU.status = appDevisStatusToDb(updates.status);
    if (updates.notes !== undefined) dbU.notes = updates.notes;
    if (updates.isConverted !== undefined) dbU.is_converted = updates.isConverted;
    if (updates.convertedToBCId !== undefined) dbU.converted_bc_id = updates.convertedToBCId;
    if (Object.keys(dbU).length > 0) supabase.from('devis').update(dbU).eq('id', id).then();
  };

  const deleteDevis = (id: string) => {
    setDevisList(prev => prev.filter(d => d.id !== id));
    supabase.from('devis').delete().eq('id', id).then();
  };

  const convertDevisToBC = (devisId: string): BonCommande => {
    const devis = devisList.find(d => d.id === devisId);
    if (!devis) throw new Error('Devis not found');
    if (devis.isConverted) throw new Error('Devis already converted');

    const freshLines = devis.lines.map(l => ({
      ...l, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, vatRate: Number(l.vatRate) as any,
    }));
    const freshTotals = calculateTotals(freshLines);
    const tempId = `bc${Date.now()}`;

    let newBC!: BonCommande;
    setBCList(prev => {
      const num = nextNumber('BC', prev.map(x => x.number));
      newBC = {
        id: tempId, number: num, date: todayStr(), dueDate: devis.dueDate, clientId: devis.clientId,
        lines: freshLines, status: 'pending', devisId, notes: devis.notes, totals: freshTotals,
        paymentMethod: devis.paymentMethod, paymentRef: devis.paymentRef, isConverted: false,
        createdAt: now(), updatedAt: now(),
      };

      // Persist BC to DB
      supabase.from('bon_commande').insert([{
        number: num, bc_date: todayStr(), client_id: devis.clientId,
        status: 'draft' as any, notes: devis.notes || null, payment_method: devis.paymentMethod || null,
        subtotal_ht: freshTotals.subtotalHT, total_tva: freshTotals.totalTVA, total_ttc: freshTotals.totalTTC,
        source_devis_id: devisId,
      }]).select().single().then(async ({ data }) => {
        if (data) {
          const appLines = await insertBCLines(data.id, freshLines);
          setBCList(p => p.map(x => x.id === tempId ? dbBCToApp(data, appLines) : x));
          // Update devis with converted_bc_id
          supabase.from('devis').update({ status: 'converted', is_converted: true, converted_bc_id: data.id }).eq('id', devisId).then();
          setDevisList(p => p.map(d => d.id === devisId ? { ...d, status: 'converted' as DevisStatus, convertedToBCId: data.id, convertedToId: data.id, isConverted: true, updatedAt: now() } : d));
        }
      });

      return [...prev, newBC];
    });

    setDevisList(prev => prev.map(d =>
      d.id === devisId ? { ...d, status: 'converted', convertedToBCId: newBC?.id, convertedToId: newBC?.id, isConverted: true, updatedAt: now() } : d
    ));

    auditLog({ action: 'Conversion Devis → BC', documentType: 'Devis', documentId: devisId, documentNumber: devis.number, details: `BC créé: ${newBC?.number}` });
    return newBC;
  };

  // ── BC ─────────────────────────────────────────
  const addBC = (bc: Omit<BonCommande, 'id' | 'number' | 'createdAt' | 'updatedAt'>): BonCommande => {
    const num = nextNumber('BC', bcList.map(x => x.number));
    const totals = calculateTotals(bc.lines);
    const tempId = `bc${Date.now()}`;
    const item: BonCommande = { ...bc, id: tempId, number: num, totals, isConverted: false, createdAt: now(), updatedAt: now() };
    setBCList(prev => [...prev, item]);

    supabase.from('bon_commande').insert([{
      number: num, bc_date: bc.date, client_id: bc.clientId,
      status: appBCStatusToDb(bc.status) as any, notes: bc.notes || null, payment_method: bc.paymentMethod || null,
      subtotal_ht: totals.subtotalHT, total_tva: totals.totalTVA, total_ttc: totals.totalTTC,
      source_devis_id: bc.devisId || null,
    }]).select().single().then(async ({ data }) => {
      if (data) {
        const appLines = await insertBCLines(data.id, bc.lines);
        setBCList(prev => prev.map(x => x.id === tempId ? dbBCToApp(data, appLines) : x));
      }
    });

    auditLog({ action: 'Création bon de commande', documentType: 'BC', documentId: tempId, documentNumber: num });
    return item;
  };

  const updateBC = (id: string, updates: Partial<BonCommande>) => {
    setBCList(prev => prev.map(b => b.id === id ? { ...b, ...updates, updatedAt: now() } : b));
    const dbU: any = {};
    if (updates.status) dbU.status = appBCStatusToDb(updates.status);
    if (updates.notes !== undefined) dbU.notes = updates.notes;
    if (updates.isConverted !== undefined) dbU.is_converted = updates.isConverted;
    if (updates.convertedToBLId !== undefined) dbU.converted_bl_id = updates.convertedToBLId;
    if (Object.keys(dbU).length > 0) supabase.from('bon_commande').update(dbU).eq('id', id).then();
  };

  const deleteBC = (id: string) => {
    setBCList(prev => prev.filter(b => b.id !== id));
    supabase.from('bon_commande').delete().eq('id', id).then();
  };

  const convertBCToBL = (bcId: string): BonLivraison => {
    const bc = bcList.find(b => b.id === bcId);
    if (!bc) throw new Error('BC not found');
    if (bc.isConverted) throw new Error('BC already converted');

    const freshTotals = calculateTotals(bc.lines);
    const tempId = `bl${Date.now()}`;

    let newBL!: BonLivraison;
    setBLList(prev => {
      const num = nextNumber('BL', prev.map(x => x.number));
      newBL = {
        id: tempId, number: num, date: todayStr(), dueDate: bc.dueDate, clientId: bc.clientId,
        lines: bc.lines, status: 'prepared', bcId, devisId: bc.devisId, notes: bc.notes, totals: freshTotals,
        paymentMethod: bc.paymentMethod, paymentRef: bc.paymentRef, isConverted: false,
        createdAt: now(), updatedAt: now(),
      };

      supabase.from('bon_livraison').insert([{
        number: num, bl_date: todayStr(), client_id: bc.clientId,
        status: 'draft' as any, notes: bc.notes || null,
        subtotal_ht: freshTotals.subtotalHT, total_tva: freshTotals.totalTVA, total_ttc: freshTotals.totalTTC,
        source_bc_id: bcId,
      }]).select().single().then(async ({ data }) => {
        if (data) {
          const appLines = await insertBLLines(data.id, bc.lines);
          setBLList(p => p.map(x => x.id === tempId ? dbBLToApp(data, appLines) : x));
          supabase.from('bon_commande').update({ status: 'converted', is_converted: true, converted_bl_id: data.id }).eq('id', bcId).then();
          setBCList(p => p.map(b => b.id === bcId ? { ...b, status: 'converted' as BCStatus, convertedToBLId: data.id, isConverted: true, updatedAt: now() } : b));
        }
      });

      return [...prev, newBL];
    });

    decreaseStockForLines(bc.lines, newBL?.number);
    setBCList(prev => prev.map(b =>
      b.id === bcId ? { ...b, status: 'converted', convertedToBLId: newBL?.id, isConverted: true, updatedAt: now() } : b
    ));

    auditLog({ action: 'Conversion BC → BL', documentType: 'BC', documentId: bcId, documentNumber: bc.number, details: `BL créé: ${newBL?.number}` });
    return newBL;
  };

  // ── BL ─────────────────────────────────────────
  const addBL = (bl: Omit<BonLivraison, 'id' | 'number' | 'createdAt' | 'updatedAt'>): BonLivraison => {
    const docYear = new Date(bl.date || new Date()).getFullYear();
    if (isYearClosed(docYear)) {
      throw new Error(`L'exercice ${docYear} est clôturé. Impossible de créer un BL pour cette année.`);
    }
    const num = nextNumber('BL', blList.map(x => x.number));
    const totals = calculateTotals(bl.lines);
    const tempId = `bl${Date.now()}`;
    const item: BonLivraison = { ...bl, id: tempId, number: num, totals, isConverted: false, createdAt: now(), updatedAt: now() };
    setBLList(prev => [...prev, item]);

    supabase.from('bon_livraison').insert([{
      number: num, bl_date: bl.date, client_id: bl.clientId,
      status: appBLStatusToDb(bl.status) as any, notes: bl.notes || null,
      subtotal_ht: totals.subtotalHT, total_tva: totals.totalTVA, total_ttc: totals.totalTTC,
      source_bc_id: bl.bcId || null, source_invoice_id: bl.sourceInvoiceId || null,
    }]).select().single().then(async ({ data }) => {
      if (data) {
        const appLines = await insertBLLines(data.id, bl.lines);
        setBLList(prev => prev.map(x => x.id === tempId ? dbBLToApp(data, appLines) : x));
      }
    });

    decreaseStockForLines(bl.lines, item.number);
    auditLog({ action: 'Création bon de livraison', documentType: 'BL', documentId: tempId, documentNumber: num });
    return item;
  };

  const updateBL = (id: string, updates: Partial<BonLivraison>) => {
    setBLList(prev => prev.map(b => b.id === id ? { ...b, ...updates, updatedAt: now() } : b));
    const dbU: any = {};
    if (updates.status) dbU.status = appBLStatusToDb(updates.status);
    if (updates.notes !== undefined) dbU.notes = updates.notes;
    if (updates.isConverted !== undefined) dbU.is_converted = updates.isConverted;
    if (updates.convertedToInvoiceId !== undefined) dbU.linked_invoice_id = updates.convertedToInvoiceId;
    if (Object.keys(dbU).length > 0) supabase.from('bon_livraison').update(dbU).eq('id', id).then();
  };

  const deleteBL = (id: string) => {
    setBLList(prev => prev.filter(b => b.id !== id));
    supabase.from('bon_livraison').delete().eq('id', id).then();
  };

  const convertBLToInvoiceData = (blId: string, invoiceId?: string) => {
    const bl = blList.find(b => b.id === blId);
    if (!bl) return null;
    if (bl.isConverted) return null;
    if (bl.sourceInvoiceId) return null;
    const blYear = new Date(bl.date).getFullYear();
    if (isYearClosed(blYear)) return null;

    const freshLines = bl.lines.map(l => ({
      ...l, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, vatRate: Number(l.vatRate) as any,
    }));
    const freshTotals = calculateTotals(freshLines);

    setBLList(prev => prev.map(b =>
      b.id === blId ? { ...b, status: 'invoiced', isConverted: true, convertedToId: invoiceId, convertedToInvoiceId: invoiceId, updatedAt: now() } : b
    ));
    supabase.from('bon_livraison').update({ status: 'converted', is_converted: true, linked_invoice_id: invoiceId || null }).eq('id', blId).then();

    return {
      clientId: bl.clientId,
      lines: freshLines,
      notes: bl.notes,
      blNumber: bl.number,
      totals: freshTotals,
      dueDate: bl.dueDate,
      paymentMethod: bl.paymentMethod,
      paymentRef: bl.paymentRef,
      setInvoiceId: (id: string) => {
        setBLList(prev => prev.map(b =>
          b.id === blId ? { ...b, convertedToId: id, convertedToInvoiceId: id, updatedAt: now() } : b
        ));
        supabase.from('bon_livraison').update({ linked_invoice_id: id }).eq('id', blId).then();
      },
    };
  };

  // ── Achats ─────────────────────────────────────
  const addAchat = (a: Omit<Achat, 'id' | 'createdAt' | 'updatedAt'>): Achat => {
    const tempId = `a${Date.now()}`;
    const totals = calculateTotals(a.lines);
    const item: Achat = { ...a, id: tempId, totals, createdAt: now(), updatedAt: now() };
    setAchatsList(prev => [...prev, item]);

    supabase.from('achats').insert([{
      number: a.supplierInvoiceNumber,
      achat_date: a.date,
      supplier_name: a.supplierName,
      supplier_ice: a.supplierICE || null,
      status: appAchatStatusToDb(a.status) as any,
      subtotal_ht: totals.subtotalHT,
      total_tva: totals.totalTVA,
      total_ttc: totals.totalTTC,
    }]).select().single().then(async ({ data }) => {
      if (data) {
        const appLines = await insertAchatLines(data.id, a.lines);
        setAchatsList(prev => prev.map(x => x.id === tempId ? dbAchatToApp(data, appLines) : x));
      }
    });

    increaseStockForLines(a.lines, 'purchase', a.supplierInvoiceNumber);
    return item;
  };

  const updateAchat = (id: string, updates: Partial<Achat>) => {
    setAchatsList(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: now() } : a));
    const dbU: any = {};
    if (updates.status) dbU.status = appAchatStatusToDb(updates.status);
    if (Object.keys(dbU).length > 0) supabase.from('achats').update(dbU).eq('id', id).then();
  };

  const deleteAchat = (id: string) => {
    setAchatsList(prev => prev.filter(a => a.id !== id));
    supabase.from('achats').delete().eq('id', id).then();
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
  if (!ctx) throw new Error('useDocuments must be inside DocumentProvider');
  return ctx;
}
