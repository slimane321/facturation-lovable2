import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getIo } from "../lib/socket";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const InvoiceLineIn = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  vatRate: z.coerce.number().int(),
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

router.use(requireAuth);

router.post("/", async (req, res) => {
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
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
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

  getIo().emit("invoice.created", created);

  res.json(created);
});

router.put("/:id", async (req, res) => {
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
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
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

  getIo().emit("invoice.updated", updated);

  res.json(updated);
});

router.post("/:id/validate", async (req, res) => {
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
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
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

  getIo().emit("invoice.updated", updated);

  res.json(updated);
});

router.post("/:id/payments", async (req, res) => {
  const invoiceId = req.params.id;

  const body = z
    .object({
      id: z.string().optional(),
      amount: z.coerce.number(),
      paymentDate: z.string().min(1),
      method: z.string().min(1),
      reference: z.string().nullable().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
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

  let updatedInvoice = null;

  if (invoice) {
    const status =
      totalPaid >= Number(invoice.totalTTC) ? "paid" : invoice.status;

    updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        totalPaid: totalPaid as any,
        status,
      } as any,
    });
  }

  const io = getIo();
  io.emit("payment.created", payment);

  if (updatedInvoice) {
    io.emit("invoice.updated", updatedInvoice);
  }

  res.json(payment);
});

export default router;