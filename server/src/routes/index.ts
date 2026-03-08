import { Router } from "express";
import authRoutes from "./auth";
import usersRoutes from "./users";
import adminRoutes from "./admin";
import expensesRoutes from "./expenses";
import settingsRoutes from "./settings";
import auditRoutes from "./audit";
import notificationsRoutes from "./notifications";
import docsRoutes from "./docs";
import clientsRoutes from "./clients";
import productsRoutes from "./products";
import invoicesRoutes from "./invoices";
import stockRoutes from "./stock";
import bootstrapRoutes from "./bootstrap";
import cryptoRoutes from "./crypto";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/admin", adminRoutes);
router.use("/expenses", expensesRoutes);
router.use("/", settingsRoutes);
router.use("/audit", auditRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/docs", docsRoutes);
router.use("/clients", clientsRoutes);
router.use("/products", productsRoutes);
router.use("/invoices", invoicesRoutes);
router.use("/stock", stockRoutes);
router.use("/", bootstrapRoutes);
router.use("/crypto", cryptoRoutes);

export default router;