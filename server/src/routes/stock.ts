import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getIo } from "../lib/socket";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.post("/adjust", async (req, res) => {
  const body = z
    .object({
      productId: z.string().min(1),
      delta: z.coerce.number(),
      type: z.enum(["sale", "purchase", "return", "manual"]).optional().default("manual"),
      documentRef: z.string().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
  }

  const product = await prisma.product.findUnique({
    where: { id: body.data.productId },
  });

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const newBalance = Number(product.stock ?? 0) + Number(body.data.delta);

  const updatedProduct = await prisma.product.update({
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

  const io = getIo();
  io.emit("product.updated", updatedProduct);
  io.emit("stock.movement.created", move);

  res.json({
    productId: body.data.productId,
    newBalance,
    movement: move,
  });
});

export default router;