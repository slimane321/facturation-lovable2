import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
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

router.post("/", async (req, res) => {
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

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  await prisma.expense.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;