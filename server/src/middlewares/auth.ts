import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, JwtAuthPayload } from "../types/auth";

export function signToken(payload: { sub: string; role: string; email: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");

  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as JwtAuthPayload;
    (req as AuthRequest).auth = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = (req as AuthRequest).auth;

  if (auth?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}