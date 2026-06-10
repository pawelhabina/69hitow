import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export interface AdminToken {
  role: "admin";
}

export function signAdminToken() {
  return jwt.sign({ role: "admin" } satisfies AdminToken, env.jwtSecret, { expiresIn: "8h" });
}

export function verifyAdminToken(token: string | null | undefined) {
  if (!token || !env.jwtSecret) return false;
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AdminToken;
    return decoded.role === "admin";
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (verifyAdminToken(token)) {
    return next();
  }
  return res.status(401).json({ message: "Sesja wygasla albo token jest niepoprawny." });
}
