import path from "node:path";
import { NextFunction, Request, Response } from "express";
import { appEnv } from "../env";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

function getClientKey(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (ip || req.socket.remoteAddress || "local").trim();
}

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = `login:${getClientKey(req)}`;
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || current.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  current.count += 1;
  if (current.count > MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({
      message: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
    });
  }

  next();
}

export function clearLoginRateLimit(req: Request) {
  loginAttempts.delete(`login:${getClientKey(req)}`);
}

export function publicStorageGuard(req: Request, res: Response, next: NextFunction) {
  const requestedPath = decodeURIComponent(req.path).replace(/^\/+/, "");
  const normalized = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const allowedPrefix = `uploads${path.sep}`;
  const absolutePath = path.resolve(appEnv.storageDir, normalized);
  const storageRoot = path.resolve(appEnv.storageDir);

  if (!absolutePath.startsWith(storageRoot) || !normalized.startsWith(allowedPrefix)) {
    return res.status(403).json({ message: "Arquivo nao disponivel publicamente." });
  }

  const extension = path.extname(absolutePath).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    return res.status(403).json({ message: "Tipo de arquivo nao permitido." });
  }

  res.setHeader("Cache-Control", "public, max-age=86400");
  next();
}
