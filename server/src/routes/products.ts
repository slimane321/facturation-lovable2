import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getIo } from "../lib/socket";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

const emptyToUndefined = (v: unknown) => {
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
};

const emptyToNull = (v: unknown) => {
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
};

const ProductCreateSchema = z.object({
  id: z.string().optional(),
  reference: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  name: z.string().min(1),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  unitPrice: z.coerce.number(),
  vatRate: z.coerce.number().int().default(20),
  unit: z.preprocess(emptyToNull, z.string().nullable().optional()),
  stock: z.coerce.number().optional().default(0),
  minStockThreshold: z.coerce.number().optional().default(5),
});

const ProductUpdateSchema = z.object({
  reference: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  name: z.string().min(1).optional(),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  unitPrice: z.coerce.number().optional(),
  vatRate: z.coerce.number().int().optional(),
  unit: z.preprocess(emptyToNull, z.string().nullable().optional()),
  stock: z.coerce.number().optional(),
  minStockThreshold: z.coerce.number().optional(),
});

function formatProductReference(sequence: number) {
  return `PRD-${String(sequence).padStart(5, "0")}`;
}

async function generateNextProductReference() {
  const products = await prisma.product.findMany({
    where: {
      reference: {
        startsWith: "PRD-",
      },
    },
    select: {
      reference: true,
    },
  });

  let max = 0;

  for (const p of products) {
    const match = p.reference.match(/^PRD-(\d+)$/);
    if (!match) continue;

    const value = Number(match[1]);
    if (value > max) max = value;
  }

  return formatProductReference(max + 1);
}

router.get("/", async (_req, res) => {
  const rows = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
  });

  res.json(rows);
});

router.post("/", async (req, res) => {
  const body = ProductCreateSchema.safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reference =
        body.data.reference ?? (await generateNextProductReference());

      const product = await tx.product.create({
        data: {
          ...(body.data.id ? { id: body.data.id } : {}),
          reference,
          name: body.data.name,
          description: body.data.description ?? null,
          unitPrice: body.data.unitPrice as any,
          vatRate: body.data.vatRate,
          unit: body.data.unit ?? null,
          stock: body.data.stock ?? 0,
          minStockThreshold: body.data.minStockThreshold ?? 5,
        } as any,
      });

      let initialMovement = null;

      if ((body.data.stock ?? 0) > 0) {
        initialMovement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementDate: new Date().toISOString(),
            type: "manual",
            quantity: body.data.stock,
            newBalance: body.data.stock,
            documentRef: "INITIAL_STOCK",
          } as any,
        });
      }

      return { product, initialMovement };
    });

    const io = getIo();
    io.emit("product.created", result.product);

    if (result.initialMovement) {
      io.emit("stock.movement.created", result.initialMovement);
    }

    res.json(result);
  } catch (error: any) {
    return res.status(400).json({
      error: error?.message ?? "Create product failed",
    });
  }
});

router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const body = ProductUpdateSchema.safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
  }

  const updated = await prisma.product.update({
    where: { id },
    data: body.data as any,
  });

  getIo().emit("product.updated", updated);

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;

  await prisma.product.delete({
    where: { id },
  });

  getIo().emit("product.deleted", { id });

  res.json({ ok: true });
});

export default router;