import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      barId?: string;
    }
  }
}

export async function getEffectiveBarIds(userId: string, role: string, email?: string): Promise<string[]> {
  const isPlatformAdmin = role === "ADMIN" && email === "admin@rtpg.local";
  if (isPlatformAdmin) {
    const rows = await prisma.bar.findMany({
      where: { active: true },
      select: { id: true },
      orderBy: { name: "asc" }
    });
    return rows.map((row) => row.id);
  }

  const links = await prisma.userBar.findMany({
    where: { userId },
    select: { barId: true }
  });

  if (!links.length) {
    return [];
  }

  return links.map((item) => item.barId);
}

export async function requireBar(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Nao autenticado." });
  }

  try {
    const allowed = await getEffectiveBarIds(req.user.userId, req.user.role, req.user.email);
    if (!allowed.length) {
      return res.status(400).json({
        message: "Nenhum restaurante vinculado a este login. Peca ao administrador da plataforma para revisar o acesso."
      });
    }

    const headerBar = typeof req.headers["x-bar-id"] === "string" ? req.headers["x-bar-id"].trim() : "";
    const chosen = headerBar && allowed.includes(headerBar) ? headerBar : allowed[0];
    req.barId = chosen;
    next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Falha ao resolver o restaurante ativo." });
  }
}
