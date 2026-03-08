import express from "express";
import { buildCorsMiddleware } from "./middlewares/cors";
import apiRoutes from "./routes";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use(buildCorsMiddleware());

  app.use(apiRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      path: req.path,
    });
  });

  return app;
}