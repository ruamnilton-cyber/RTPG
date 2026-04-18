import { NextFunction, Request, Response } from "express";
import { formatTokenFromHeader } from "../lib/utils";
import { verifyToken } from "../lib/auth";

export type RequestUser = {
  userId: string;
  role: "ADMIN" | "GERENTE" | "CAIXA" | "GARCOM" | "COZINHA" | "FINANCEIRO" | "OPERADOR";
  name: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = formatTokenFromHeader(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: "Sessão inválida ou expirada." });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}

export function requireRole(...roles: Array<"ADMIN" | "GERENTE" | "CAIXA" | "GARCOM" | "COZINHA" | "FINANCEIRO" | "OPERADOR">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Você não tem permissão para acessar este recurso." });
    }

    next();
  };
}
