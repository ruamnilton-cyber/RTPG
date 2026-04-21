import path from "node:path";
import { NextFunction, Request, Response } from "express";
import { appEnv } from "../env";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

// Limpa entradas expiradas a cada 15 min para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt < now) loginAttempts.delete(key);
  }
}, 15 * 60 * 1000).unref();

function getClientKey(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (ip || req.socket.remoteAddress || "local").trim();
}

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // 'unsafe-inline' necessÃ¡rio para React em desenvolvimento; em produÃ§Ã£o considere nonce-based CSP
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  );
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
