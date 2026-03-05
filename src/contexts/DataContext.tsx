import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { InvoiceLine, VatRate } from '@/lib/moroccanUtils';
import { generateInvoiceNumber, calculateTotals } from '@/lib/moroccanUtils';
import { useAudit } from '@/contexts/AuditContext';
import { useSettings } from '@/contexts/SettingsContext';
import { signInvoiceServerSide, GENESIS_HASH } from '@/lib/hashUtils';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────
export type ClientType = 'company' | 'individual';

export interface Client {
  id: string;
  clientType: ClientType;
  businessName: string;
  ice: string;
  ifNumber: string;
  rc?: string;
  address: string;
  city: string;
  email?: string;
  phone?: string;
}

export type InvoiceStatus = 'draft' | 'pending' | 'validated' | 'paid' | 'cancelled' | 'avoir';

export const DRAFT_NUMBER = 'BROUILLON';

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference?: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  clientId: string;
  lines: InvoiceLine[];
  status: InvoiceStatus;
  notes?: string;
  paymentMethod?: string;
  paymentRef?: string;
  totals: ReturnType<typeof calculateTotals>;
  originalInvoiceId?: string;
  hasAvoir?: boolean;
  avoirId?: string;
  payments?: Payment[];
  totalPaid?: number;
  hash?: string;
  previousHash?: string;
  signature?: string;
  blId?: string;
  dgiStatus?: 'pending' | 'accepted' | 'rejected' | 'manual';
  dgiRegistrationNumber?: string;
  signedPdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  reference: string;
  name: string;
  description?: string;
  unitPrice: number;
  vatRate: VatRate;
  unit?: string;
  stock: number;
  minStockThreshold: number;
}

export type StockMovementType = 'sale' | 'purchase' | 'return' | 'manual';

export interface StockMovement {
  id: string;
  productId: string;
  date: string;
  type: StockMovementType;
  quantity: number;
  newBalance: number;
  documentRef?: string;
  auditEntryId?: string;
}

// ── DB Row → App Model mappers ───────────────
function dbClientToApp(row: any): Client {
  return {
    id: row.id,
    clientType: row.client_type,
    businessName: row.business_name,
    ice: row.ice || '',
    ifNumber: row.if_number || '',
    rc: row.rc || undefined,
    address: row.address,
    city: row.city,
    email: row.email || undefined,
    phone: row.phone || undefined,
  };
}

function dbProductToApp(row: any): Product {
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    description: row.description || undefined,
    unitPrice: Number(row.unit_price),
    vatRate: row.vat_rate as VatRate,
    unit: row.unit || undefined,
    stock: row.stock,
    minStockThreshold: row.min_stock_threshold,
  };
}

function dbInvoiceToApp(row: any, lines: InvoiceLine[], payments: Payment[]): Invoice {
  const totals = calculateTotals(lines);
  return {
    id: row.id,
    number: row.number,
    date: row.invoice_date,
    dueDate: row.due_date,
    clientId: row.client_id,
    lines,
    status: row.status as InvoiceStatus,
    notes: row.notes || undefined,
    paymentMethod: row.payment_method || undefined,
    paymentRef: row.payment_ref || undefined,
    totals,
    originalInvoiceId: row.original_invoice_id || undefined,
    hasAvoir: row.has_avoir,
    avoirId: row.avoir_id || undefined,
    payments: payments.length > 0 ? payments : undefined,
    totalPaid: Number(row.total_paid) || 0,
    hash: row.hash || undefined,
    previousHash: row.previous_hash || undefined,
    signature: row.signature || undefined,
    blId: row.bl_id || undefined,
    dgiStatus: row.dgi_status || undefined,
    dgiRegistrationNumber: row.dgi_registration_number || undefined,
    signedPdfUrl: row.signed_pdf_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbMovementToApp(row: any): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    date: row.movement_date,
    type: row.type as StockMovementType,
    quantity: row.quantity,
    newBalance: row.new_balance,
    documentRef: row.document_ref || undefined,
  };
}

// ── Context interface ─────────────────────────
interface DataContextType {
  clients: Client[];
  invoices: Invoice[];
  products: Product[];
  addClient: (client: Omit<Client, 'id'>) => Client;
  updateClient: (id: string, updates: Partial<Omit<Client, 'id'>>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  validateInvoice: (id: string) => void;
  markAsPaid: (id: string) => void;
  addPayment: (invoiceId: string, payment: Omit<Payment, 'id'>) => void;
  createAvoir: (invoiceId: string, restockItems?: boolean) => Invoice;
  getInvoice: (id: string) => Invoice | undefined;
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, updates: Partial<Omit<Product, 'id'>>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, delta: number, type?: StockMovementType, documentRef?: string) => void;
  lowStockProducts: Product[];
  stockMovements: StockMovement[];
  getProductMovements: (productId: string) => StockMovement[];
}

const DataContext = createContext<DataContextType | null>(null);

function generateReference(existing: string[]): string {
  const nums = existing
    .filter(r => r.startsWith('ART-'))
    .map(r => parseInt(r.replace('ART-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `ART-${String(next).padStart(4, '0')}`;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { log: auditLog } = useAudit();
  const { isYearClosed } = useSettings();
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loaded, setLoaded] = useState(false);

  // ── Load all data from Supabase on mount ────
  useEffect(() => {
    async function fetchAll() {
      const [clientsRes, productsRes, invoicesRes, linesRes, paymentsRes, movementsRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at'),
        supabase.from('products').select('*').order('created_at'),
        supabase.from('invoices').select('*').order('created_at'),
        supabase.from('invoice_lines').select('*').order('sort_order'),
        supabase.from('payments').select('*').order('created_at'),
        supabase.from('stock_movements').select('*').order('movement_date', { ascending: false }),
      ]);

      if (clientsRes.data) setClients(clientsRes.data.map(dbClientToApp));
      if (productsRes.data) setProducts(productsRes.data.map(dbProductToApp));
      if (movementsRes.data) setStockMovements(movementsRes.data.map(dbMovementToApp));

      if (invoicesRes.data && linesRes.data && paymentsRes.data) {
        const linesByInvoice = new Map<string, InvoiceLine[]>();
        for (const l of linesRes.data) {
          const invoiceId = l.invoice_id;
          if (!linesByInvoice.has(invoiceId)) linesByInvoice.set(invoiceId, []);
          linesByInvoice.get(invoiceId)!.push({
            id: l.id,
            description: l.description,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unit_price),
            vatRate: l.vat_rate as VatRate,
          });
        }
        const paymentsByInvoice = new Map<string, Payment[]>();
        for (const p of paymentsRes.data) {
          const invoiceId = p.invoice_id;
          if (!paymentsByInvoice.has(invoiceId)) paymentsByInvoice.set(invoiceId, []);
          paymentsByInvoice.get(invoiceId)!.push({
            id: p.id,
            amount: Number(p.amount),
            date: p.payment_date,
            method: p.method,
            reference: p.reference || undefined,
          });
        }
        setInvoices(invoicesRes.data.map(row =>
          dbInvoiceToApp(row, linesByInvoice.get(row.id) || [], paymentsByInvoice.get(row.id) || [])
        ));
      }
      setLoaded(true);
    }
    fetchAll();
  }, []);

  // ── Client methods ────────────────────────────
  const addClient = (client: Omit<Client, 'id'>): Client => {
    const tempId = `c${Date.now()}`;
    const newClient: Client = { ...client, id: tempId };
    setClients(prev => [...prev, newClient]);

    supabase.from('clients').insert({
      client_type: client.clientType,
      business_name: client.businessName,
      ice: client.ice,
      if_number: client.ifNumber,
      rc: client.rc || null,
      address: client.address,
      city: client.city,
      email: client.email || null,
      phone: client.phone || null,
    }).select().single().then(({ data }) => {
      if (data) {
        setClients(prev => prev.map(c => c.id === tempId ? dbClientToApp(data) : c));
      }
    });

    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Omit<Client, 'id'>>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    const dbUpdates: any = {};
    if (updates.clientType !== undefined) dbUpdates.client_type = updates.clientType;
    if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName;
    if (updates.ice !== undefined) dbUpdates.ice = updates.ice;
    if (updates.ifNumber !== undefined) dbUpdates.if_number = updates.ifNumber;
    if (updates.rc !== undefined) dbUpdates.rc = updates.rc;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;

    supabase.from('clients').update(dbUpdates).eq('id', id).then();
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    supabase.from('clients').delete().eq('id', id).then();
  };

  // ── Invoice methods ───────────────────────────
  const addInvoice = (inv: Omit<Invoice, 'id' | 'number' | 'createdAt' | 'updatedAt'>): Invoice => {
    const docYear = new Date(inv.date).getFullYear();
    if (isYearClosed(docYear)) {
      throw new Error(`L'exercice ${docYear} est clôturé. Impossible de créer une facture pour cette année.`);
    }

    const now = new Date().toISOString();
    const tempId = `i${Date.now()}`;
    const totals = calculateTotals(inv.lines);
    const newInvoice: Invoice = { ...inv, id: tempId, number: DRAFT_NUMBER, totals, createdAt: now, updatedAt: now };
    setInvoices(prev => [...prev, newInvoice]);

    supabase.from('invoices').insert({
      number: DRAFT_NUMBER,
      invoice_date: inv.date,
      due_date: inv.dueDate,
      client_id: inv.clientId,
      status: inv.status || 'draft',
      notes: inv.notes || null,
      payment_method: inv.paymentMethod || null,
      payment_ref: inv.paymentRef || null,
      subtotal_ht: totals.subtotalHT,
      total_tva: totals.totalTVA,
      total_ttc: totals.totalTTC,
      timbre: totals.timbreAmount || 0,
      original_invoice_id: inv.originalInvoiceId || null,
      bl_id: inv.blId || null,
    }).select().single().then(async ({ data }) => {
      if (data) {
        // Insert lines
        const lineInserts = inv.lines.map((l, i) => ({
          invoice_id: data.id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          vat_rate: l.vatRate,
          sort_order: i,
        }));
        const { data: linesData } = await supabase.from('invoice_lines').insert(lineInserts).select();

        const appLines: InvoiceLine[] = linesData?.map(ld => ({
          id: ld.id,
          description: ld.description,
          quantity: Number(ld.quantity),
          unitPrice: Number(ld.unit_price),
          vatRate: ld.vat_rate as VatRate,
        })) || inv.lines;

        setInvoices(prev => prev.map(i2 => i2.id === tempId
          ? dbInvoiceToApp(data, appLines, [])
          : i2
        ));
      }
    });

    auditLog({ action: 'Création brouillon facture', documentType: 'Facture', documentId: tempId });
    return newInvoice;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev => {
      const inv = prev.find(i => i.id === id);
      if (!inv) return prev;
      const allowedPostLockFields = new Set(['dgiStatus', 'dgiRegistrationNumber', 'signedPdfUrl', 'blId', 'hasAvoir', 'avoirId']);
      const isLockedStatus = inv.status === 'validated' || inv.status === 'paid' || inv.status === 'avoir';
      if (isLockedStatus || inv.hash) {
        const onlyAllowed = Object.keys(updates).every(k => allowedPostLockFields.has(k));
        if (!onlyAllowed) {
          console.error('Cannot update a validated/locked invoice. Use Avoir instead.');
          return prev;
        }
      }
      return prev.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
    });

    // Persist whitelisted fields to DB
    const dbUpdates: any = {};
    if (updates.dgiStatus !== undefined) dbUpdates.dgi_status = updates.dgiStatus;
    if (updates.dgiRegistrationNumber !== undefined) dbUpdates.dgi_registration_number = updates.dgiRegistrationNumber;
    if (updates.signedPdfUrl !== undefined) dbUpdates.signed_pdf_url = updates.signedPdfUrl;
    if (updates.blId !== undefined) dbUpdates.bl_id = updates.blId;
    if (updates.hasAvoir !== undefined) dbUpdates.has_avoir = updates.hasAvoir;
    if (updates.avoirId !== undefined) dbUpdates.avoir_id = updates.avoirId;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.number !== undefined) dbUpdates.number = updates.number;
    if (updates.hash !== undefined) dbUpdates.hash = updates.hash;
    if (updates.previousHash !== undefined) dbUpdates.previous_hash = updates.previousHash;
    if (updates.signature !== undefined) dbUpdates.signature = updates.signature;
    if (updates.totalPaid !== undefined) dbUpdates.total_paid = updates.totalPaid;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('invoices').update(dbUpdates).eq('id', id).then();
    }
  };

  const validateInvoice = (id: string) => {
    const target = invoices.find(i => i.id === id);
    if (target) {
      const docYear = new Date(target.date).getFullYear();
      if (isYearClosed(docYear)) {
        console.error(`L'exercice ${docYear} est clôturé. Validation impossible.`);
        return;
      }
    }
    setInvoices(prev => {
      const validatedNumbers = prev
        .filter(i => (i.status === 'validated' || i.status === 'paid') && i.id !== id)
        .map(i => i.number);
      const finalNumber = generateInvoiceNumber(validatedNumbers);
      if (prev.some(i => i.number === finalNumber && i.id !== id)) {
        console.error(`Invoice number collision detected: ${finalNumber}`);
        return prev;
      }

      const validatedInvoices = prev
        .filter(i => i.hash && (i.status === 'validated' || i.status === 'paid' || i.status === 'avoir'))
        .sort((a, b) => a.number.localeCompare(b.number));
      const lastHash = validatedInvoices.length > 0
        ? validatedInvoices[validatedInvoices.length - 1].hash!
        : GENESIS_HASH;

      const t = prev.find(i => i.id === id);
      const clientICE = t ? (clients.find(c => c.id === t.clientId)?.ice || '') : '';

      signInvoiceServerSide({
        invoiceNumber: finalNumber,
        date: t?.date || new Date().toISOString().split('T')[0],
        clientICE,
        totalTTC: t?.totals.totalTTC || 0,
        previousHash: lastHash,
      }).then(async ({ hash, signature }) => {
        setInvoices(cur =>
          cur.map(i =>
            i.id === id
              ? { ...i, status: 'validated' as InvoiceStatus, number: finalNumber, hash, signature, previousHash: lastHash, updatedAt: new Date().toISOString() }
              : i
          )
        );
        // Persist to DB
        supabase.from('invoices').update({
          status: 'validated',
          number: finalNumber,
          hash,
          signature,
          previous_hash: lastHash,
        }).eq('id', id).then();
      });

      auditLog({ action: 'Validation facture', documentType: 'Facture', documentId: id, documentNumber: finalNumber });

      if (t && !t.blId) {
        for (const line of t.lines) {
          const product = products.find(p => p.name === line.description || p.reference === line.description);
          if (product) {
            adjustStock(product.id, -Math.abs(line.quantity), 'sale', finalNumber);
          }
        }
      }

      return prev.map(i =>
        i.id === id && i.status !== 'validated'
          ? { ...i, status: 'validated' as InvoiceStatus, number: finalNumber, previousHash: lastHash, updatedAt: new Date().toISOString() }
          : i
      );
    });
  };

  const markAsPaid = (id: string) => {
    const target = invoices.find(i => i.id === id);
    if (target) {
      const docYear = new Date(target.date).getFullYear();
      if (isYearClosed(docYear)) {
        console.error(`L'exercice ${docYear} est clôturé. Modification impossible.`);
        return;
      }
    }
    setInvoices(prev =>
      prev.map(i => {
        if (i.id !== id || i.status !== 'validated') return i;
        const totalPaid = i.totals.totalTTC;
        return { ...i, status: 'paid', totalPaid, updatedAt: new Date().toISOString() };
      })
    );
    supabase.from('invoices').update({ status: 'paid', total_paid: target?.totals.totalTTC || 0 }).eq('id', id).then();
    auditLog({ action: 'Marquée payée', documentType: 'Facture', documentId: id });
  };

  const addPayment = (invoiceId: string, payment: Omit<Payment, 'id'>) => {
    const tempPayId = `pay${Date.now()}`;
    setInvoices(prev =>
      prev.map(i => {
        if (i.id !== invoiceId) return i;
        const newPayment: Payment = { ...payment, id: tempPayId };
        const payments = [...(i.payments || []), newPayment];
        const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
        let status = i.status as InvoiceStatus;
        if (totalPaid >= i.totals.totalTTC) status = 'paid';
        return { ...i, payments, totalPaid, status, updatedAt: new Date().toISOString() };
      })
    );

    supabase.from('payments').insert({
      invoice_id: invoiceId,
      amount: payment.amount,
      payment_date: payment.date,
      method: payment.method,
      reference: payment.reference || null,
    }).select().single().then(({ data }) => {
      if (data) {
        // Update local payment id
        setInvoices(prev => prev.map(i => {
          if (i.id !== invoiceId) return i;
          const payments = (i.payments || []).map(p => p.id === tempPayId ? { ...p, id: data.id } : p);
          return { ...i, payments };
        }));
        // Update invoice total_paid in DB
        const inv = invoices.find(i => i.id === invoiceId);
        if (inv) {
          const newTotalPaid = (inv.payments || []).reduce((s, p) => s + p.amount, 0) + payment.amount;
          const newStatus = newTotalPaid >= inv.totals.totalTTC ? 'paid' : inv.status;
          supabase.from('invoices').update({ total_paid: newTotalPaid, status: newStatus }).eq('id', invoiceId).then();
        }
      }
    });

    auditLog({ action: `Paiement enregistré (${payment.amount} MAD)`, documentType: 'Facture', documentId: invoiceId, details: `Méthode: ${payment.method}` });
  };

  const createAvoir = (invoiceId: string, restockItems: boolean = false): Invoice => {
    const original = invoices.find(i => i.id === invoiceId);
    if (!original) throw new Error('Invoice not found');
    const invoiceYear = new Date(original.date).getFullYear();
    if (isYearClosed(invoiceYear)) throw new Error(`L'exercice ${invoiceYear} est clôturé. Aucun avoir ne peut être créé.`);

    const allNumbers = invoices.map(i => i.number).filter(n => n !== DRAFT_NUMBER);
    const aNum = generateInvoiceNumber(allNumbers).replace('FA-', 'AV-');
    const avoirLines = original.lines.map(l => ({ ...l, quantity: -Math.abs(l.quantity) }));
    const clientICE = clients.find(c => c.id === original.clientId)?.ice || '';

    const validatedInvoices = invoices
      .filter(i => i.hash && (i.status === 'validated' || i.status === 'paid' || i.status === 'avoir'))
      .sort((a, b) => a.number.localeCompare(b.number));
    const lastHash = validatedInvoices.length > 0
      ? validatedInvoices[validatedInvoices.length - 1].hash!
      : GENESIS_HASH;

    const avoirTotals = calculateTotals(avoirLines);
    const avoirDate = new Date().toISOString().split('T')[0];
    const tempId = `i${Date.now()}`;

    const avoir: Invoice = {
      ...original,
      id: tempId,
      number: aNum,
      status: 'avoir',
      originalInvoiceId: invoiceId,
      hasAvoir: false,
      avoirId: undefined,
      lines: avoirLines,
      totals: avoirTotals,
      date: avoirDate,
      previousHash: lastHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert avoir into DB
    supabase.from('invoices').insert({
      number: aNum,
      invoice_date: avoirDate,
      due_date: avoirDate,
      client_id: original.clientId,
      status: 'avoir',
      notes: original.notes || null,
      payment_method: original.paymentMethod || null,
      subtotal_ht: avoirTotals.subtotalHT,
      total_tva: avoirTotals.totalTVA,
      total_ttc: avoirTotals.totalTTC,
      timbre: avoirTotals.timbreAmount || 0,
      original_invoice_id: original.id,
      previous_hash: lastHash,
    }).select().single().then(async ({ data }) => {
      if (data) {
        // Insert avoir lines
        const lineInserts = avoirLines.map((l, i) => ({
          invoice_id: data.id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          vat_rate: l.vatRate,
          sort_order: i,
        }));
        await supabase.from('invoice_lines').insert(lineInserts);

        // Compute hash + signature server-side
        const { hash, signature } = await signInvoiceServerSide({
          invoiceNumber: aNum, date: avoirDate, clientICE, totalTTC: avoirTotals.totalTTC, previousHash: lastHash,
        });
        await supabase.from('invoices').update({ hash, signature }).eq('id', data.id);

        // Update original invoice
        await supabase.from('invoices').update({ has_avoir: true, avoir_id: data.id }).eq('id', invoiceId);

        // Update local state with real IDs
        setInvoices(cur => cur.map(i => {
          if (i.id === tempId) return { ...i, id: data.id, hash, signature };
          if (i.id === invoiceId) return { ...i, hasAvoir: true, avoirId: data.id };
          return i;
        }));
      }
    });

    if (restockItems) {
      for (const line of original.lines) {
        const product = products.find(p => p.name === line.description || p.reference === line.description);
        if (product) {
          adjustStock(product.id, Math.abs(line.quantity), 'return', aNum);
        }
      }
    }

    setInvoices(prev => {
      const newList = [...prev, avoir];
      return newList.map(i =>
        i.id === invoiceId
          ? { ...i, hasAvoir: true, avoirId: avoir.id, updatedAt: new Date().toISOString() }
          : i
      );
    });

    auditLog({ action: 'Création avoir', documentType: 'Avoir', documentId: avoir.id, documentNumber: aNum, details: `Sur facture ${original.number}` });
    return avoir;
  };

  // ── Product methods ───────────────────────────
  const addProduct = (product: Omit<Product, 'id'>): Product => {
    const ref = product.reference?.trim() || generateReference(products.map(p => p.reference));
    const tempId = `p${Date.now()}`;
    const newProduct: Product = { ...product, reference: ref, id: tempId, stock: product.stock ?? 0, minStockThreshold: product.minStockThreshold ?? 5 };
    setProducts(prev => [...prev, newProduct]);

    supabase.from('products').insert({
      reference: ref,
      name: product.name,
      description: product.description || null,
      unit_price: product.unitPrice,
      vat_rate: product.vatRate,
      unit: product.unit || null,
      stock: product.stock ?? 0,
      min_stock_threshold: product.minStockThreshold ?? 5,
    }).select().single().then(({ data }) => {
      if (data) {
        setProducts(prev => prev.map(p => p.id === tempId ? dbProductToApp(data) : p));
      }
    });

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Omit<Product, 'id'>>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    const dbUpdates: any = {};
    if (updates.reference !== undefined) dbUpdates.reference = updates.reference;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.unitPrice !== undefined) dbUpdates.unit_price = updates.unitPrice;
    if (updates.vatRate !== undefined) dbUpdates.vat_rate = updates.vatRate;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.stock !== undefined) dbUpdates.stock = updates.stock;
    if (updates.minStockThreshold !== undefined) dbUpdates.min_stock_threshold = updates.minStockThreshold;

    supabase.from('products').update(dbUpdates).eq('id', id).then();
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    supabase.from('products').delete().eq('id', id).then();
  };

  const adjustStock = (productId: string, delta: number, type: StockMovementType = 'manual', documentRef?: string) => {
    setProducts(prev => {
      const product = prev.find(p => p.id === productId);
      if (!product) return prev;
      const newBalance = (product.stock ?? 0) + delta;
      const movement: StockMovement = {
        id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        productId,
        date: new Date().toISOString(),
        type,
        quantity: delta,
        newBalance,
        documentRef,
      };
      setStockMovements(prev2 => [...prev2, movement]);

      // Persist to DB
      supabase.from('stock_movements').insert({
        product_id: productId,
        type,
        quantity: delta,
        new_balance: newBalance,
        document_ref: documentRef || null,
      }).then();
      supabase.from('products').update({ stock: newBalance }).eq('id', productId).then();

      auditLog({
        action: `Mouvement stock: ${delta > 0 ? '+' : ''}${delta} (${type})`,
        documentType: 'Produit',
        documentId: productId,
        documentNumber: product.reference,
        details: documentRef ? `Réf: ${documentRef}` : undefined,
      });
      return prev.map(p =>
        p.id === productId ? { ...p, stock: newBalance } : p
      );
    });
  };

  const getProductMovements = useCallback((productId: string) => {
    return stockMovements.filter(m => m.productId === productId).sort((a, b) => b.date.localeCompare(a.date));
  }, [stockMovements]);

  const lowStockProducts = useMemo(
    () => products.filter(p => (p.stock ?? 0) <= (p.minStockThreshold ?? 5))
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)),
    [products]
  );

  return (
    <DataContext.Provider value={{
      clients, invoices, products,
      addClient, updateClient, deleteClient, getClient: (id) => clients.find(c => c.id === id),
      addInvoice, updateInvoice, validateInvoice, markAsPaid, addPayment, createAvoir, getInvoice: (id) => invoices.find(i => i.id === id),
      addProduct, updateProduct, deleteProduct, adjustStock, lowStockProducts, stockMovements, getProductMovements,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
}
