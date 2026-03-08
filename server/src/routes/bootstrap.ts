import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/bootstrap", async (_req, res) => {
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

export default router;