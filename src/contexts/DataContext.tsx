import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { InvoiceLine, VatRate } from "@/lib/moroccanUtils";
import { calculateTotals, generateInvoiceNumber } from "@/lib/moroccanUtils";
import { useAudit } from "@/contexts/AuditContext";
import { useSettings } from "@/contexts/SettingsContext";
import { api } from "@/integrations/api/client";
import { signInvoiceServerSide, GENESIS_HASH } from "@/lib/hashUtils";
import { useAuth } from "@/contexts/AuthContext";
import { socket } from "@/integrations/realtime/socket";

// ── Types ─────────────────────────────────────────────────────────
export type ClientType = "company" | "individual";

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

export type InvoiceStatus =
  | "draft"
  | "pending"
  | "validated"
  | "paid"
  | "cancelled"
  | "avoir";

export const DRAFT_NUMBER = "BROUILLON";

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
  dgiStatus?: "pending" | "accepted" | "rejected" | "manual";
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

export type StockMovementType = "sale" | "purchase" | "return" | "manual";

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

interface DataContextType {
  clients: Client[];
  invoices: Invoice[];
  products: Product[];
  stockMovements: StockMovement[];

  addClient: (client: Omit<Client, "id">) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;

  addInvoice: (
    invoice: Omit<Invoice, "id" | "number" | "totals" | "createdAt" | "updatedAt">
  ) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  validateInvoice: (id: string) => void;
  markAsPaid: (id: string) => void;
  addPayment: (invoiceId: string, payment: Omit<Payment, "id">) => void;
  getInvoice: (id: string) => Invoice | undefined;

  addProduct: (product: Omit<Product, "id">) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  adjustStock: (
    productId: string,
    delta: number,
    type?: StockMovementType,
    documentRef?: string
  ) => void;
  lowStockProducts: Product[];
  getProductMovements: (productId: string) => StockMovement[];
}

const DataContext = createContext<DataContextType | null>(null);

// ── Helpers ─────────────────────────────────────────────────────
function uuidv4(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function dbNumberToUiNumber(dbNumber: string, status: InvoiceStatus): string {
  if (status === "draft") return DRAFT_NUMBER;
  if ((dbNumber || "").startsWith("DRAFT-")) return DRAFT_NUMBER;
  return dbNumber;
}

function uiNumberToDbNumber(uiNumber: string, invoiceId: string): string {
  if (uiNumber === DRAFT_NUMBER) return `DRAFT-${invoiceId}`;
  return uiNumber;
}

function toLinePayload(lines: InvoiceLine[]) {
  return (lines || []).map((l) => ({
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    vatRate: Number(l.vatRate),
  }));
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index === -1) return [item, ...list];

  const copy = [...list];
  copy[index] = item;
  return copy;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

function normalizeClient(c: any): Client {
  return {
    id: c.id,
    clientType: c.clientType,
    businessName: c.businessName,
    ice: c.ice ?? "",
    ifNumber: c.ifNumber ?? "",
    rc: c.rc ?? undefined,
    address: c.address,
    city: c.city,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
  };
}

function normalizeProduct(p: any): Product {
  return {
    id: p.id,
    reference: p.reference,
    name: p.name,
    description: p.description ?? undefined,
    unitPrice: Number(p.unitPrice),
    vatRate: p.vatRate as VatRate,
    unit: p.unit ?? undefined,
    stock: Number(p.stock ?? 0),
    minStockThreshold: Number(p.minStockThreshold ?? 5),
  };
}

function normalizeStockMovement(m: any): StockMovement {
  return {
    id: m.id,
    productId: m.productId,
    date: m.date ?? m.movementDate,
    type: m.type,
    quantity: Number(m.quantity),
    newBalance: Number(m.newBalance),
    documentRef: m.documentRef ?? undefined,
    auditEntryId: m.auditEntryId ?? undefined,
  };
}

// ── Provider ────────────────────────────────────────────────────
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { log: auditLog } = useAudit();
  const { isYearClosed } = useSettings();

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const reset = useCallback(() => {
    setClients([]);
    setProducts([]);
    setInvoices([]);
    setStockMovements([]);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    if (!isAuthenticated) return;

    const boot = await api.get<any>("/bootstrap");

    setClients((boot.clients || []).map(normalizeClient));
    setProducts((boot.products || []).map(normalizeProduct));

    const linesByInvoice = new Map<string, InvoiceLine[]>();
    for (const l of boot.invoiceLines || []) {
      if (!linesByInvoice.has(l.invoiceId)) linesByInvoice.set(l.invoiceId, []);
      linesByInvoice.get(l.invoiceId)!.push({
        id: l.id,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        vatRate: l.vatRate as VatRate,
      });
    }

    const paymentsByInvoice = new Map<string, Payment[]>();
    for (const p of boot.payments || []) {
      if (!paymentsByInvoice.has(p.invoiceId)) paymentsByInvoice.set(p.invoiceId, []);
      paymentsByInvoice.get(p.invoiceId)!.push({
        id: p.id,
        amount: Number(p.amount),
        date: p.paymentDate,
        method: p.method,
        reference: p.reference ?? undefined,
      });
    }

    setInvoices(
      (boot.invoices || []).map((inv: any) => {
        const lines = linesByInvoice.get(inv.id) || [];
        const totals = calculateTotals(lines);
        const status = inv.status as InvoiceStatus;

        return {
          id: inv.id,
          number: dbNumberToUiNumber(inv.number, status),
          date: inv.invoiceDate,
          dueDate: inv.dueDate,
          clientId: inv.clientId,
          lines,
          status,
          notes: inv.notes ?? undefined,
          paymentMethod: inv.paymentMethod ?? undefined,
          paymentRef: inv.paymentRef ?? undefined,
          totals,
          originalInvoiceId: inv.originalInvoiceId ?? undefined,
          hasAvoir: !!inv.hasAvoir,
          avoirId: inv.avoirId ?? undefined,
          payments: paymentsByInvoice.get(inv.id) || undefined,
          totalPaid: Number(inv.totalPaid ?? 0),
          hash: inv.hash ?? undefined,
          previousHash: inv.previousHash ?? undefined,
          signature: inv.signature ?? undefined,
          blId: inv.blId ?? undefined,
          dgiStatus: inv.dgiStatus ?? undefined,
          dgiRegistrationNumber: inv.dgiRegistrationNumber ?? undefined,
          signedPdfUrl: inv.signedPdfUrl ?? undefined,
          createdAt: inv.createdAt,
          updatedAt: inv.updatedAt,
        } as Invoice;
      })
    );

    setStockMovements((boot.stockMovements || []).map(normalizeStockMovement));
  }, [isAuthenticated]);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      reset();
      return;
    }

    refreshBootstrap().catch(console.error);
  }, [loading, isAuthenticated, refreshBootstrap, reset]);

  // ── Realtime connection ───────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      socket.disconnect();
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated]);

  // ── Realtime listeners ────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const onClientCreated = (payload: any) => {
      setClients((prev) => upsertById(prev, normalizeClient(payload)));
    };

    const onClientUpdated = (payload: any) => {
      setClients((prev) => upsertById(prev, normalizeClient(payload)));
    };

    const onClientDeleted = ({ id }: { id: string }) => {
      setClients((prev) => removeById(prev, id));
    };

    const onProductCreated = (payload: any) => {
      setProducts((prev) => upsertById(prev, normalizeProduct(payload)));
    };

    const onProductUpdated = (payload: any) => {
      setProducts((prev) => upsertById(prev, normalizeProduct(payload)));
    };

    const onProductDeleted = ({ id }: { id: string }) => {
      setProducts((prev) => removeById(prev, id));
      setStockMovements((prev) => prev.filter((m) => m.productId !== id));
    };

    const onStockMovementCreated = (payload: any) => {
      const movement = normalizeStockMovement(payload);

      setStockMovements((prev) => upsertById(prev, movement));
      setProducts((prev) =>
        prev.map((p) =>
          p.id === movement.productId ? { ...p, stock: movement.newBalance } : p
        )
      );
    };

    const onInvoiceChanged = () => {
      refreshBootstrap().catch(console.error);
    };

    const onPaymentCreated = () => {
      refreshBootstrap().catch(console.error);
    };

    socket.on("client.created", onClientCreated);
    socket.on("client.updated", onClientUpdated);
    socket.on("client.deleted", onClientDeleted);

    socket.on("product.created", onProductCreated);
    socket.on("product.updated", onProductUpdated);
    socket.on("product.deleted", onProductDeleted);

    socket.on("stock.movement.created", onStockMovementCreated);

    socket.on("invoice.created", onInvoiceChanged);
    socket.on("invoice.updated", onInvoiceChanged);
    socket.on("payment.created", onPaymentCreated);

    return () => {
      socket.off("client.created", onClientCreated);
      socket.off("client.updated", onClientUpdated);
      socket.off("client.deleted", onClientDeleted);

      socket.off("product.created", onProductCreated);
      socket.off("product.updated", onProductUpdated);
      socket.off("product.deleted", onProductDeleted);

      socket.off("stock.movement.created", onStockMovementCreated);

      socket.off("invoice.created", onInvoiceChanged);
      socket.off("invoice.updated", onInvoiceChanged);
      socket.off("payment.created", onPaymentCreated);
    };
  }, [isAuthenticated, refreshBootstrap]);

  // ── Clients (persist) ─────────────────────────────────────────
  const addClient = (client: Omit<Client, "id">): Client => {
    const id = uuidv4();
    const newClient: Client = { ...client, id };

    setClients((prev) => [...prev, newClient]);

    auditLog({
      action: "Création client",
      documentType: "Client",
      documentId: id,
    });

    api.post<any>("/clients", { id, ...client })
      .then((resp) => {
        setClients((prev) => upsertById(prev, normalizeClient(resp)));
      })
      .catch(() => {
        setClients((prev) => prev.filter((c) => c.id !== id));
      });

    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    const snapshot = clients;

    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));

    api.put<any>(`/clients/${id}`, updates)
      .then((resp) => {
        setClients((prev) => upsertById(prev, normalizeClient(resp)));
      })
      .catch(() => {
        setClients(snapshot);
      });
  };

  const deleteClient = (id: string) => {
    const snapshot = clients;

    setClients((prev) => prev.filter((c) => c.id !== id));

    api.del(`/clients/${id}`).catch(() => {
      setClients(snapshot);
    });
  };

  const getClient = (id: string) => clients.find((c) => c.id === id);

  // ── Products (persist) ────────────────────────────────────────
  const addProduct = (product: Omit<Product, "id">): Product => {
    const id = uuidv4();

    const optimistic: Product = {
      ...product,
      id,
      reference: product.reference || "",
    };

    setProducts((prev) => [...prev, optimistic]);

    api.post<any>("/products", { id, ...product })
      .then((resp) => {
        const createdProduct = normalizeProduct(resp?.product ?? resp);

        setProducts((prev) =>
          prev.map((p) => (p.id === id ? createdProduct : p))
        );

        const initialMovement = resp?.initialMovement;
        if (initialMovement) {
          const normalizedMovement = normalizeStockMovement(initialMovement);
          setStockMovements((prev) => upsertById(prev, normalizedMovement));
        }
      })
      .catch(() => {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      });

    return optimistic;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const snapshot = products;

    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));

    api.put<any>(`/products/${id}`, updates)
      .then((resp) => {
        setProducts((prev) => upsertById(prev, normalizeProduct(resp)));
      })
      .catch(() => {
        setProducts(snapshot);
      });
  };

  const deleteProduct = (id: string) => {
    const snapshotProducts = products;
    const snapshotMovements = stockMovements;

    setProducts((prev) => prev.filter((p) => p.id !== id));
    setStockMovements((prev) => prev.filter((m) => m.productId !== id));

    api.del(`/products/${id}`).catch(() => {
      setProducts(snapshotProducts);
      setStockMovements(snapshotMovements);
    });
  };

  // ── Invoices (persist) ─────────────────────────────────────────
  const addInvoice = (
    inv: Omit<Invoice, "id" | "number" | "totals" | "createdAt" | "updatedAt">
  ): Invoice => {
    const docYear = new Date(inv.date).getFullYear();
    if (isYearClosed(docYear)) {
      throw new Error(`L'exercice ${docYear} est clôturé.`);
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    const totals = calculateTotals(inv.lines);

    const invoice: Invoice = {
      ...inv,
      id,
      number: DRAFT_NUMBER,
      totals,
      createdAt: now,
      updatedAt: now,
    };

    setInvoices((prev) => [...prev, invoice]);

    auditLog({
      action: "Création brouillon facture",
      documentType: "Facture",
      documentId: id,
    });

    api.post("/invoices", {
      id,
      number: `DRAFT-${id}`,
      invoiceDate: inv.date,
      dueDate: inv.dueDate,
      clientId: inv.clientId,
      status: inv.status,
      notes: inv.notes ?? null,
      paymentMethod: inv.paymentMethod ?? null,
      paymentRef: inv.paymentRef ?? null,
      lines: toLinePayload(inv.lines),
    }).catch(() => {});

    return invoice;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const nextLines = (updates.lines ?? i.lines) as InvoiceLine[];
        const nextTotals = updates.lines ? calculateTotals(nextLines) : i.totals;

        return {
          ...i,
          ...updates,
          lines: nextLines,
          totals: nextTotals,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    const current = invoices.find((i) => i.id === id);
    const merged: any = { ...(current || {}), ...(updates || {}) };

    const lines: InvoiceLine[] = (merged.lines || current?.lines || []) as InvoiceLine[];
    const numberToStore = uiNumberToDbNumber(
      merged.number ?? current?.number ?? DRAFT_NUMBER,
      id
    );

    api.put(`/invoices/${id}`, {
      number: numberToStore,
      invoiceDate: merged.date ?? current?.date,
      dueDate: merged.dueDate ?? current?.dueDate,
      clientId: merged.clientId ?? current?.clientId,
      status: merged.status ?? current?.status,
      notes: merged.notes ?? null,
      paymentMethod: merged.paymentMethod ?? null,
      paymentRef: merged.paymentRef ?? null,
      lines: toLinePayload(lines),
    }).catch(() => {});
  };

  const validateInvoice = (id: string) => {
    const target = invoices.find((i) => i.id === id);
    if (!target) return;

    const docYear = new Date(target.date).getFullYear();
    if (isYearClosed(docYear)) return;

    const validatedNumbers = invoices
      .filter((i) => (i.status === "validated" || i.status === "paid") && i.id !== id)
      .map((i) => i.number)
      .filter((n) => n !== DRAFT_NUMBER);

    const finalNumber = generateInvoiceNumber(validatedNumbers);

    const sealed = invoices
      .filter(
        (i) =>
          i.hash &&
          (i.status === "validated" || i.status === "paid" || i.status === "avoir")
      )
      .sort((a, b) => (a.number || "").localeCompare(b.number || ""));

    const lastHash = sealed.length > 0 ? sealed[sealed.length - 1].hash! : GENESIS_HASH;
    const clientICE = clients.find((c) => c.id === target.clientId)?.ice || "";

    setInvoices((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "validated",
              number: finalNumber,
              previousHash: lastHash,
              updatedAt: new Date().toISOString(),
            }
          : i
      )
    );

    auditLog({
      action: "Validation facture (HMAC API)",
      documentType: "Facture",
      documentId: id,
      documentNumber: finalNumber,
    });

    signInvoiceServerSide({
      invoiceNumber: finalNumber,
      date: target.date,
      clientICE,
      totalTTC: target.totals.totalTTC,
      previousHash: lastHash,
    })
      .then(({ hash, signature }) => {
        setInvoices((cur) =>
          cur.map((i) =>
            i.id === id
              ? {
                  ...i,
                  hash,
                  signature,
                  previousHash: lastHash,
                  updatedAt: new Date().toISOString(),
                }
              : i
          )
        );

        api.post(`/invoices/${id}/validate`, {
          number: finalNumber,
          status: "validated",
          hash,
          signature,
          previousHash: lastHash,
        }).catch(() => {});
      })
      .catch(console.error);
  };

  const addPayment = (invoiceId: string, payment: Omit<Payment, "id">) => {
    const id = uuidv4();

    setInvoices((prev) =>
      prev.map((i) => {
        if (i.id !== invoiceId) return i;

        const newPayment: Payment = { ...payment, id };
        const payments = [...(i.payments || []), newPayment];
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
        const status = totalPaid >= i.totals.totalTTC ? "paid" : i.status;

        return {
          ...i,
          payments,
          totalPaid,
          status,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    auditLog({
      action: `Paiement enregistré (${payment.amount} MAD)`,
      documentType: "Facture",
      documentId: invoiceId,
      details: `Méthode: ${payment.method}`,
    });

    api.post(`/invoices/${invoiceId}/payments`, {
      id,
      amount: Number(payment.amount),
      paymentDate: payment.date,
      method: payment.method,
      reference: payment.reference ?? null,
    }).catch(() => {});
  };

  const markAsPaid = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    if (inv.status !== "validated" && inv.status !== "pending") return;

    const alreadyPaid = Number(inv.totalPaid ?? 0);
    const remaining = Math.max(0, inv.totals.totalTTC - alreadyPaid);
    if (remaining <= 0) return;

    addPayment(id, {
      amount: remaining,
      date: new Date().toISOString().split("T")[0],
      method: inv.paymentMethod || "Virement",
      reference: inv.paymentRef,
    });
  };

  const getInvoice = (id: string) => invoices.find((i) => i.id === id);

  // ── Stock (persist) ────────────────────────────────────────────
  const adjustStock = (
    productId: string,
    delta: number,
    type: StockMovementType = "manual",
    documentRef?: string
  ) => {
    const before = products.find((p) => p.id === productId)?.stock ?? 0;
    const optimisticBalance = before + delta;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, stock: (p.stock ?? 0) + delta } : p
      )
    );

    const localMoveId = uuidv4();
    const movement: StockMovement = {
      id: localMoveId,
      productId,
      date: new Date().toISOString(),
      type,
      quantity: delta,
      newBalance: optimisticBalance,
      documentRef,
    };

    setStockMovements((prev) => [movement, ...prev]);

    api.post<any>("/stock/adjust", { productId, delta, type, documentRef })
      .then((resp) => {
        const newBalance = Number(
          resp?.newBalance ?? resp?.movement?.newBalance ?? optimisticBalance
        );

        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, stock: newBalance } : p))
        );

        const apiMove = resp?.movement;
        if (apiMove?.id) {
          const normalized = normalizeStockMovement(apiMove);

          setStockMovements((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== localMoveId);
            return upsertById(withoutTemp, normalized);
          });
        }
      })
      .catch(() => {});
  };

  const getProductMovements = useCallback(
    (productId: string) => {
      return stockMovements
        .filter((m) => m.productId === productId)
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    [stockMovements]
  );

  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => (p.stock ?? 0) <= (p.minStockThreshold ?? 5))
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  }, [products]);

  return (
    <DataContext.Provider
      value={{
        clients,
        invoices,
        products,
        stockMovements,

        addClient,
        updateClient,
        deleteClient,
        getClient,

        addInvoice,
        updateInvoice,
        validateInvoice,
        markAsPaid,
        addPayment,
        getInvoice,

        addProduct,
        updateProduct,
        deleteProduct,

        adjustStock,
        lowStockProducts,
        getProductMovements,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be inside DataProvider");
  return ctx;
}