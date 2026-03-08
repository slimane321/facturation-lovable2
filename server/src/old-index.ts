import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();

app.use(express.json({ limit: "2mb" }));

// CORS : accepte une ou plusieurs origines séparées par virgule dans CORS_ORIGIN
const corsEnv = process.env.CORS_ORIGIN;
const allowedOrigins = corsEnv
  ? corsEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!allowedOrigins) return cb(null, true);
      if (!origin) return cb(null, true); // curl/postman
      return allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ───────────────────────── AUTH HELPERS ─────────────────────────

function signToken(payload: { sub: string; role: string; email: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");

  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

function requireAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as any;
    req.auth = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireAdmin(req: any, res: any, next: any) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// ───────────────────────── AUTH ─────────────────────────

app.post("/auth/login", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const user = await prisma.user.findUnique({
    where: { email: body.data.email },
  });

  if (!user) {
    return res.status(401).json({ error: "Bad credentials" });
  }

  const ok = await bcrypt.compare(body.data.password, user.passwordHash);

  if (!ok) {
    return res.status(401).json({ error: "Bad credentials" });
  }

  const token = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email.split("@")[0],
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

app.get("/auth/me", requireAuth, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.sub },
  });

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email.split("@")[0],
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

// ───────────────────────── USERS ─────────────────────────

app.get("/users/me", requireAuth, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.sub },
  });

  if (!user) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name ?? user.email.split("@")[0],
    role: user.role,
    createdAt: user.createdAt,
  });
});

app.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name ?? u.email.split("@")[0],
      role: u.role,
      createdAt: u.createdAt,
    }))
  );
});

// ───────────────────────── ADMIN CREATE USER ─────────────────────────

app.post("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      role: z.string().min(1),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const exists = await prisma.user.findUnique({
    where: { email: body.data.email },
  });

  if (exists) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: body.data.email,
      passwordHash,
      name: body.data.name,
      role: body.data.role,
    },
  });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  });
});

// ───────────────────────── EXPENSES ─────────────────────────

app.get("/expenses", requireAuth, async (_req, res) => {
  const rows = await prisma.expense.findMany({
    orderBy: { date: "desc" },
  });

  res.json(
    rows.map((r) => ({
      id: r.id,
      date: r.date,
      category: r.category,
      description: r.description,
      amount: Number(r.amount),
      tvaAmount: Number(r.tvaAmount),
      paymentMethod: r.paymentMethod,
      reference: r.reference ?? undefined,
    }))
  );
});

app.post("/expenses", requireAuth, async (req, res) => {
  const body = z
    .object({
      date: z.string().min(1),
      category: z.string().min(1),
      description: z.string().min(1),
      amount: z.number(),
      tvaAmount: z.number().optional().default(0),
      paymentMethod: z.string().min(1),
      reference: z.string().nullable().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const row = await prisma.expense.create({
    data: {
      date: body.data.date,
      category: body.data.category,
      description: body.data.description,
      amount: body.data.amount as any,
      tvaAmount: body.data.tvaAmount as any,
      paymentMethod: body.data.paymentMethod,
      reference: body.data.reference ?? null,
    },
  });

  res.json({
    id: row.id,
    date: row.date,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    tvaAmount: Number(row.tvaAmount),
    paymentMethod: row.paymentMethod,
    reference: row.reference ?? undefined,
  });
});

app.delete("/expenses/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  await prisma.expense.delete({ where: { id } });
  res.json({ ok: true });
});

// ───────────────────────── SETTINGS ─────────────────────────

app.get("/settings", requireAuth, async (_req, res) => {
  const row = await prisma.companySettings.findFirst({
    orderBy: { id: "asc" },
  });

  res.json(row);
});

app.put("/settings", requireAuth, async (req, res) => {
  const row = await prisma.companySettings.findFirst({
    orderBy: { id: "asc" },
  });

  if (!row) {
    return res.status(400).json({ error: "CompanySettings not initialized" });
  }

  const updated = await prisma.companySettings.update({
    where: { id: row.id },
    data: req.body,
  });

  res.json(updated);
});

app.get("/closed-years", requireAuth, async (_req, res) => {
  const rows = await prisma.closedFiscalYear.findMany({
    orderBy: { year: "asc" },
  });

  res.json(rows);
});

app.post("/closed-years/:year/close", requireAuth, async (req, res) => {
  const year = Number(req.params.year);
  const masterHash = req.body?.masterHash ?? null;

  const row = await prisma.closedFiscalYear.upsert({
    where: { year },
    update: { masterHash },
    create: { year, masterHash },
  });

  res.json(row);
});

app.post("/closed-years/:year/reopen", requireAuth, async (req, res) => {
  const year = Number(req.params.year);

  await prisma.closedFiscalYear.delete({ where: { year } }).catch(() => {});

  res.json({ ok: true });
});

// ───────────────────────── AUDIT ─────────────────────────

app.get("/audit", requireAuth, async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  res.json(logs);
});

app.post("/audit", requireAuth, async (req: any, res) => {
  const data = z
    .object({
      action: z.string().min(1),
      documentType: z.string().min(1),
      documentId: z.string().optional(),
      documentNumber: z.string().optional(),
      details: z.string().optional(),
      oldValue: z.any().optional(),
      newValue: z.any().optional(),
    })
    .safeParse(req.body);

  if (!data.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.sub },
  });

  const row = await prisma.auditLog.create({
    data: {
      userName: user?.name ?? user?.email ?? "Utilisateur",
      action: data.data.action,
      documentType: data.data.documentType,
      documentId: data.data.documentId ?? null,
      documentNumber: data.data.documentNumber ?? null,
      details: data.data.details ?? null,
      oldValue: data.data.oldValue ?? null,
      newValue: data.data.newValue ?? null,
    },
  });

  res.json(row);
});

// ───────────────────────── NOTIFICATIONS ─────────────────────────

app.get("/notifications", requireAuth, async (req: any, res) => {
  const rows = await prisma.notification.findMany({
    where: { userId: req.auth.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(rows);
});

app.post("/notifications", requireAuth, async (req: any, res) => {
  const data = z
    .object({
      category: z.string().min(1),
      title: z.string().min(1),
      message: z.string().min(1),
      href: z.string().optional(),
      icon: z.string().optional(),
    })
    .safeParse(req.body);

  if (!data.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const row = await prisma.notification.create({
    data: {
      userId: req.auth.sub,
      category: data.data.category,
      title: data.data.title,
      message: data.data.message,
      href: data.data.href ?? null,
      icon: data.data.icon ?? null,
      read: false,
    },
  });

  res.json(row);
});

app.put("/notifications/:id/read", requireAuth, async (req: any, res) => {
  const id = req.params.id;

  const row = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });

  res.json(row);
});

app.put("/notifications/read-all", requireAuth, async (req: any, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.auth.sub, read: false },
    data: { read: true },
  });

  res.json({ ok: true });
});

app.delete("/notifications", requireAuth, async (req: any, res) => {
  await prisma.notification.deleteMany({
    where: { userId: req.auth.sub },
  });

  res.json({ ok: true });
});

// ───────────────────────── DOCS ─────────────────────────

const LineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number(),
  unitPrice: z.number(),
  vatRate: z.number().int(),
});

function mapLines(lines: any[]) {
  return (lines || [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      id: l.id,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      vatRate: l.vatRate,
    }));
}

app.get("/docs/bootstrap", requireAuth, async (_req, res) => {
  const [devis, bc, bl, achats] = await Promise.all([
    prisma.devis.findMany({
      include: { lines: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bonCommande.findMany({
      include: { lines: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bonLivraison.findMany({
      include: { lines: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.achat.findMany({
      include: { lines: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  res.json({
    devis: devis.map((d) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      validUntil: d.validUntil,
      clientId: d.clientId,
      status: d.status,
      notes: d.notes ?? undefined,
      paymentMethod: d.paymentMethod ?? undefined,
      paymentRef: d.paymentRef ?? undefined,
      isConverted: d.isConverted,
      convertedToBCId: d.convertedToBCId ?? undefined,
      convertedToInvoiceId: d.convertedToInvoiceId ?? undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      lines: mapLines(d.lines as any),
    })),
    bc: bc.map((b) => ({
      id: b.id,
      number: b.number,
      date: b.date,
      clientId: b.clientId,
      status: b.status,
      devisId: b.devisId ?? undefined,
      notes: b.notes ?? undefined,
      paymentMethod: b.paymentMethod ?? undefined,
      paymentRef: b.paymentRef ?? undefined,
      isConverted: b.isConverted,
      convertedToBLId: b.convertedToBLId ?? undefined,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      lines: mapLines(b.lines as any),
    })),
    bl: bl.map((b) => ({
      id: b.id,
      number: b.number,
      date: b.date,
      clientId: b.clientId,
      status: b.status,
      bcId: b.bcId ?? undefined,
      devisId: b.devisId ?? undefined,
      notes: b.notes ?? undefined,
      paymentMethod: b.paymentMethod ?? undefined,
      paymentRef: b.paymentRef ?? undefined,
      isConverted: b.isConverted,
      convertedToInvoiceId: b.convertedToInvoiceId ?? undefined,
      sourceInvoiceId: b.sourceInvoiceId ?? undefined,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      lines: mapLines(b.lines as any),
    })),
    achats: achats.map((a) => ({
      id: a.id,
      supplierInvoiceNumber: a.supplierInvoiceNumber,
      supplierName: a.supplierName,
      supplierICE: a.supplierICE ?? undefined,
      date: a.date,
      dueDate: a.dueDate,
      status: a.status,
      notes: a.notes ?? undefined,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      lines: mapLines(a.lines as any),
    })),
  });
});

// (les endpoints docs CRUD existent déjà chez toi; garde ceux que tu as si tu les as)

// ───────────────────────── CLIENTS / PRODUCTS / INVOICES / PAYMENTS / STOCK ─────────────────────────

app.get("/clients", requireAuth, async (_req, res) => {
  const rows = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
  });

  res.json(rows);
});

app.post("/clients", requireAuth, async (req, res) => {
  const body = z
    .object({
      id: z.string().optional(),
      clientType: z.enum(["company", "individual"]),
      businessName: z.string().min(1),
      ice: z.string().optional().default(""),
      ifNumber: z.string().optional().default(""),
      rc: z.string().optional().nullable(),
      address: z.string().min(1),
      city: z.string().min(1),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const created = await prisma.client.create({
    data: {
      ...(body.data.id ? { id: body.data.id } : {}),
      clientType: body.data.clientType,
      businessName: body.data.businessName,
      ice: body.data.ice ?? "",
      ifNumber: body.data.ifNumber ?? "",
      rc: body.data.rc ?? null,
      address: body.data.address,
      city: body.data.city,
      email: body.data.email ?? null,
      phone: body.data.phone ?? null,
    },
  });

  res.json(created);
});

app.put("/clients/:id", requireAuth, async (req, res) => {
  const id = req.params.id;

  const body = z
    .object({
      clientType: z.enum(["company", "individual"]).optional(),
      businessName: z.string().min(1).optional(),
      ice: z.string().optional(),
      ifNumber: z.string().optional(),
      rc: z.string().nullable().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const updated = await prisma.client.update({
    where: { id },
    data: body.data as any,
  });

  res.json(updated);
});

app.delete("/clients/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  await prisma.client.delete({ where: { id } });
  res.json({ ok: true });
});

app.get("/products", requireAuth, async (_req, res) => {
  const rows = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
  });

  res.json(rows);
});

app.post("/products", requireAuth, async (req, res) => {
  const body = z
    .object({
      id: z.string().optional(),
      reference: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      unitPrice: z.number(),
      vatRate: z.number().int(),
      unit: z.string().optional().nullable(),
      stock: z.number().optional().default(0),
      minStockThreshold: z.number().optional().default(5),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const created = await prisma.product.create({
    data: {
      ...(body.data.id ? { id: body.data.id } : {}),
      reference: body.data.reference,
      name: body.data.name,
      description: body.data.description ?? null,
      unitPrice: body.data.unitPrice as any,
      vatRate: body.data.vatRate,
      unit: body.data.unit ?? null,
      stock: body.data.stock ?? 0,
      minStockThreshold: body.data.minStockThreshold ?? 5,
    } as any,
  });

  res.json(created);
});

app.put("/products/:id", requireAuth, async (req, res) => {
  const id = req.params.id;

  const body = z
    .object({
      reference: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      unitPrice: z.number().optional(),
      vatRate: z.number().int().optional(),
      unit: z.string().nullable().optional(),
      stock: z.number().optional(),
      minStockThreshold: z.number().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const updated = await prisma.product.update({
    where: { id },
    data: body.data as any,
  });

  res.json(updated);
});

app.delete("/products/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  await prisma.product.delete({ where: { id } });
  res.json({ ok: true });
});

// invoices (totals server-side)

const InvoiceLineIn = z.object({
  description: z.string().min(1),
  quantity: z.number(),
  unitPrice: z.number(),
  vatRate: z.number().int(),
});

function computeTotals(lines: Array<z.infer<typeof InvoiceLineIn>>) {
  const subtotalHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const totalTVA = lines.reduce(
    (s, l) => s + l.quantity * l.unitPrice * (l.vatRate / 100),
    0
  );
  const totalTTC = subtotalHT + totalTVA;

  return { subtotalHT, totalTVA, totalTTC };
}

app.post("/invoices", requireAuth, async (req, res) => {
  const body = z
    .object({
      id: z.string().optional(),
      number: z.string().min(1),
      invoiceDate: z.string().min(1),
      dueDate: z.string().min(1),
      clientId: z.string().min(1),
      status: z.string().min(1),
      notes: z.string().nullable().optional(),
      paymentMethod: z.string().nullable().optional(),
      paymentRef: z.string().nullable().optional(),
      lines: z.array(InvoiceLineIn),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const totals = computeTotals(body.data.lines);

  const created = await prisma.invoice.create({
    data: {
      ...(body.data.id ? { id: body.data.id } : {}),
      number: body.data.number,
      invoiceDate: body.data.invoiceDate,
      dueDate: body.data.dueDate,
      clientId: body.data.clientId,
      status: body.data.status,
      notes: body.data.notes ?? null,
      paymentMethod: body.data.paymentMethod ?? null,
      paymentRef: body.data.paymentRef ?? null,
      subtotalHT: totals.subtotalHT as any,
      totalTVA: totals.totalTVA as any,
      totalTTC: totals.totalTTC as any,
      totalPaid: 0 as any,
      lines: {
        create: body.data.lines.map((l, i) => ({
          description: l.description,
          quantity: l.quantity as any,
          unitPrice: l.unitPrice as any,
          vatRate: l.vatRate,
          sortOrder: i,
        })),
      },
    } as any,
  });

  res.json(created);
});

app.put("/invoices/:id", requireAuth, async (req, res) => {
  const id = req.params.id;

  const body = z
    .object({
      number: z.string().min(1).optional(),
      invoiceDate: z.string().min(1).optional(),
      dueDate: z.string().min(1).optional(),
      clientId: z.string().min(1).optional(),
      status: z.string().min(1).optional(),
      notes: z.string().nullable().optional(),
      paymentMethod: z.string().nullable().optional(),
      paymentRef: z.string().nullable().optional(),
      lines: z.array(InvoiceLineIn).optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const data: any = { ...body.data };

  if (body.data.lines) {
    const totals = computeTotals(body.data.lines);
    data.subtotalHT = totals.subtotalHT as any;
    data.totalTVA = totals.totalTVA as any;
    data.totalTTC = totals.totalTTC as any;
    data.lines = {
      deleteMany: {},
      create: body.data.lines.map((l, i) => ({
        description: l.description,
        quantity: l.quantity as any,
        unitPrice: l.unitPrice as any,
        vatRate: l.vatRate,
        sortOrder: i,
      })),
    };
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data,
  });

  res.json(updated);
});

app.post("/invoices/:id/validate", requireAuth, async (req, res) => {
  const id = req.params.id;

  const body = z
    .object({
      number: z.string().min(1),
      status: z.enum(["validated", "paid", "avoir"]),
      hash: z.string().min(1),
      signature: z.string().min(1),
      previousHash: z.string().min(1),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      number: body.data.number,
      status: body.data.status,
      hash: body.data.hash,
      signature: body.data.signature,
      previousHash: body.data.previousHash,
    } as any,
  });

  res.json(updated);
});

app.post("/invoices/:id/payments", requireAuth, async (req, res) => {
  const invoiceId = req.params.id;

  const body = z
    .object({
      id: z.string().optional(),
      amount: z.number(),
      paymentDate: z.string().min(1),
      method: z.string().min(1),
      reference: z.string().nullable().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const payment = await prisma.payment.create({
    data: {
      ...(body.data.id ? { id: body.data.id } : {}),
      invoiceId,
      amount: body.data.amount as any,
      paymentDate: body.data.paymentDate,
      method: body.data.method,
      reference: body.data.reference ?? null,
    } as any,
  });

  const agg = await prisma.payment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });

  const totalPaid = Number(agg._sum.amount ?? 0);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (invoice) {
    const status = totalPaid >= Number(invoice.totalTTC) ? "paid" : invoice.status;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        totalPaid: totalPaid as any,
        status,
      } as any,
    });
  }

  res.json(payment);
});

app.post("/stock/adjust", requireAuth, async (req, res) => {
  const body = z
    .object({
      productId: z.string().min(1),
      delta: z.number(),
      type: z.enum(["sale", "purchase", "return", "manual"]).optional().default("manual"),
      documentRef: z.string().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const product = await prisma.product.findUnique({
    where: { id: body.data.productId },
  });

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const newBalance = (product.stock ?? 0) + body.data.delta;

  await prisma.product.update({
    where: { id: body.data.productId },
    data: { stock: newBalance },
  });

  const move = await prisma.stockMovement.create({
    data: {
      productId: body.data.productId,
      movementDate: new Date().toISOString(),
      type: body.data.type,
      quantity: body.data.delta,
      newBalance,
      documentRef: body.data.documentRef ?? null,
    } as any,
  });

  res.json({
    productId: body.data.productId,
    newBalance,
    movement: move,
  });
});

// ───────────────────────── BOOTSTRAP ─────────────────────────

app.get("/bootstrap", requireAuth, async (_req, res) => {
  const [clients, products, invoices, invoiceLines, payments, stockMovements] =
    await Promise.all([
      prisma.client.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.invoice.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.invoiceLine.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.stockMovement.findMany({ orderBy: { movementDate: "desc" } }),
    ]);

  res.json({
    clients,
    products,
    invoices,
    invoiceLines,
    payments,
    stockMovements,
  });
});

// ───────────────────────── CRYPTO (HMAC) ─────────────────────────

app.post("/crypto/sign-invoice", requireAuth, async (req, res) => {
  const body = z
    .object({
      invoiceNumber: z.string().min(1),
      date: z.string().min(1),
      clientICE: z.string().optional().default(""),
      totalTTC: z.number(),
      previousHash: z.string().min(1),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const payload = [
    body.data.invoiceNumber,
    body.data.date,
    body.data.clientICE ?? "",
    body.data.totalTTC.toFixed(2),
    body.data.previousHash,
  ].join("|");

  const hash = crypto.createHash("sha256").update(payload, "utf8").digest("hex");

  const secret = process.env.HMAC_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ error: "HMAC_SECRET_KEY missing" });
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(hash, "utf8")
    .digest("hex");

  res.json({ hash, signature });
});

// 404 JSON (évite “Unexpected token <”)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
  });
});

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});