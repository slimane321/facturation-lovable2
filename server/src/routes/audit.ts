import { Router, Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  res.json(logs);
});

router.post("/", async (req: Request, res) => {
  const auth = (req as AuthRequest).auth;

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
    where: { id: auth.sub },
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

export default router;