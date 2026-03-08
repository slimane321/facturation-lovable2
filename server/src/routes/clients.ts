import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getIo } from "../lib/socket";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const rows = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
  });

  res.json(rows);
});

router.post("/", async (req, res) => {
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
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
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

  getIo().emit("client.created", created);

  res.json(created);
});

router.put("/:id", async (req, res) => {
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
    return res.status(400).json({
      error: "Invalid body",
      details: body.error.flatten(),
    });
  }

  const updated = await prisma.client.update({
    where: { id },
    data: body.data as any,
  });

  getIo().emit("client.updated", updated);

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;

  await prisma.client.delete({ where: { id } });

  getIo().emit("client.deleted", { id });

  res.json({ ok: true });
});

export default router;