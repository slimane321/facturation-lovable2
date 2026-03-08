import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";

const router = Router();

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

router.use(requireAuth);

router.get("/bootstrap", async (_req, res) => {
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

export default router;