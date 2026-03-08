import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/settings", async (_req, res) => {
  const row = await prisma.companySettings.findFirst({
    orderBy: { id: "asc" },
  });

  res.json(row);
});

router.put("/settings", async (req, res) => {
  const row = await prisma.companySettings.findFirst({
    orderBy: { id: "asc" },
  });

  if (!row) {
    return res.status(400).json({ error: "CompanySettings not initialized" });
  }

  const updated = await prisma.companySettings.update({
    where: { id: row.id },
    data: req.body,
  });

  res.json(updated);
});

router.get("/closed-years", async (_req, res) => {
  const rows = await prisma.closedFiscalYear.findMany({
    orderBy: { year: "asc" },
  });

  res.json(rows);
});

router.post("/closed-years/:year/close", async (req, res) => {
  const year = Number(req.params.year);
  const masterHash = req.body?.masterHash ?? null;

  const row = await prisma.closedFiscalYear.upsert({
    where: { year },
    update: { masterHash },
    create: { year, masterHash },
  });

  res.json(row);
});

router.post("/closed-years/:year/reopen", async (req, res) => {
  const year = Number(req.params.year);

  await prisma.closedFiscalYear.delete({ where: { year } }).catch(() => {});

  res.json({ ok: true });
});

export default router;