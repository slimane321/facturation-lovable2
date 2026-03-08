import { Router, Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, signToken } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";

const router = Router();

router.post("/login", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const user = await prisma.user.findUnique({
    where: { email: body.data.email },
  });

  if (!user) {
    return res.status(401).json({ error: "Bad credentials" });
  }

  const ok = await bcrypt.compare(body.data.password, user.passwordHash);

  if (!ok) {
    return res.status(401).json({ error: "Bad credentials" });
  }

  const token = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email.split("@")[0],
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

router.get("/me", requireAuth, async (req: Request, res) => {
  const auth = (req as AuthRequest).auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
  });

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email.split("@")[0],
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

export default router;