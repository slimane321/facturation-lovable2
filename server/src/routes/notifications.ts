import { Router, Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getIo } from "../lib/socket";
import { requireAuth } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: Request, res) => {
  const auth = (req as AuthRequest).auth;

  const rows = await prisma.notification.findMany({
    where: { userId: auth.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(rows);
});

router.post("/", async (req: Request, res) => {
  const auth = (req as AuthRequest).auth;

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
    return res.status(400).json({
      error: "Invalid body",
      details: data.error.flatten(),
    });
  }

  const row = await prisma.notification.create({
    data: {
      userId: auth.sub,
      category: data.data.category,
      title: data.data.title,
      message: data.data.message,
      href: data.data.href ?? null,
      icon: data.data.icon ?? null,
      read: false,
    },
  });

  getIo().to(`user:${auth.sub}`).emit("notification.created", row);

  res.json(row);
});

router.put("/:id/read", async (req: Request, res) => {
  const auth = (req as AuthRequest).auth;
  const id = req.params.id;

  const row = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });

  getIo().to(`user:${auth.sub}`).emit("notification.updated", row);

  res.json(row);
});

router.put("/read-all", async (req: Request, res) => {
  const auth = (req as AuthRequest).auth;

  await prisma.notification.updateMany({
    where: { userId: auth.sub, read: false },
    data: { read: true },
  });

  getIo().to(`user:${auth.sub}`).emit("notification.readAll", {
    userId: auth.sub,
  });

  res.json({ ok: true });
});

router.delete("/", async (req: Request, res) => {
  const auth = (req as AuthRequest).auth;

  await prisma.notification.deleteMany({
    where: { userId: auth.sub },
  });

  getIo().to(`user:${auth.sub}`).emit("notification.deletedAll", {
    userId: auth.sub,
  });

  res.json({ ok: true });
});

export default router;