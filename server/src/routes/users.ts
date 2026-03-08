import { Router, Request } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

router.use(requireAuth);

router.get("/me", async (req: Request, res) => {
  const auth = (req as AuthRequest).auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
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

router.get("/", requireAdmin, async (_req, res) => {
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

export default router;