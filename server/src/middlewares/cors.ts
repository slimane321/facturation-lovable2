import cors from "cors";

export function buildCorsMiddleware() {
  const corsEnv = process.env.CORS_ORIGIN;

  const allowedOrigins = corsEnv
    ? corsEnv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  return cors({
    origin: (origin, cb) => {
      if (!allowedOrigins) return cb(null, true);
      if (!origin) return cb(null, true); // curl/postman

      return allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  });
}