import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth, requireAdmin);

router.post("/users", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      role: z.string().min(1),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const exists = await prisma.user.findUnique({
    where: { email: body.data.email },
  });

  if (exists) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: body.data.email,
      passwordHash,
      name: body.data.name,
      role: body.data.role,
    },
  });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  });
});

export default router;