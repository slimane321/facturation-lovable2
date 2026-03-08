import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.post("/sign-invoice", async (req, res) => {
  const body = z
    .object({
      invoiceNumber: z.string().min(1),
      date: z.string().min(1),
      clientICE: z.string().optional().default(""),
      totalTTC: z.number(),
      previousHash: z.string().min(1),
    })
    .safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const payload = [
    body.data.invoiceNumber,
    body.data.date,
    body.data.clientICE ?? "",
    body.data.totalTTC.toFixed(2),
    body.data.previousHash,
  ].join("|");

  const hash = crypto.createHash("sha256").update(payload, "utf8").digest("hex");

  const secret = process.env.HMAC_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ error: "HMAC_SECRET_KEY missing" });
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(hash, "utf8")
    .digest("hex");

  res.json({ hash, signature });
});

export default router;