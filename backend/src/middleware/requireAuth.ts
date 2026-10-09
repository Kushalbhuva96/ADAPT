import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthSession } from "../models/AuthSession.js";

export type AuthenticatedRequest = Request & { auth?: { userId: string; jti: string } };

const identityKeys = new Set(["userId", "learnerId"]);

export function submittedIdentityMatches(value: unknown, userId: string, key = ""): boolean {
  if (Array.isArray(value)) return value.every((item) => submittedIdentityMatches(item, userId, key));
  if (!value || typeof value !== "object") return !identityKeys.has(key) || value === undefined || value === userId;
  return Object.entries(value).every(([childKey, childValue]) => submittedIdentityMatches(childValue, userId, childKey));
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const secret = process.env.JWT_SECRET;
    if (!secret || !token) return res.status(401).json({ message: "Authentication required." });
    const payload = jwt.verify(token, secret, { issuer: "adapt-api", audience: "adapt-client" }) as jwt.JwtPayload;
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    const jti = typeof payload.jti === "string" ? payload.jti : "";
    if (!userId || !jti || !(await AuthSession.exists({ jti, userId, expiresAt: { $gt: new Date() } }))) {
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    const path = req.originalUrl.replace(/^\/api(?:\/v1)?/, "").split("?")[0];
    const learnerResource = path.match(/^\/(dashboard|profile|progress|sync|recommendations)\/([^/]+)/);
    const embeddedLearner = path.match(/^\/(?:practice\/next|study-plan)\/([^/]+)/);
    if ((learnerResource && learnerResource[2] !== userId) || (embeddedLearner && embeddedLearner[1] !== userId)) {
      return res.status(403).json({ message: "You cannot access another learner's data." });
    }
    if (!submittedIdentityMatches(req.query, userId) || !submittedIdentityMatches(req.body, userId)) {
      return res.status(403).json({ message: "You cannot access another learner's data." });
    }
    // Keep the existing request contract while sourcing missing identity from the verified token.
    req.query.userId ??= userId;
    if (req.body && typeof req.body === "object") req.body.userId ??= userId;
    req.auth = { userId, jti };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session. Please sign in again." });
  }
}
