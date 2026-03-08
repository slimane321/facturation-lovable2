import { Request } from "express";

export type JwtAuthPayload = {
  sub: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
};

export type AuthRequest = Request & {
  auth: JwtAuthPayload;
};