import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      barId?: string;
    }
  }
}

const DEFAULT_BAR_ID = "default-bar";

/**
 * Garante que existe pelo menos um bar no sistema.
 * Se não existir, cria o bar padrão e vincula o usuário.
 */
async function ensureDefaultBar(userId: string): Promise<string> {
  try {
    let bar = await prisma.bar.findUnique({ where: { id: DEFAULT_BAR_ID } });
    if (!bar) {
      bar = await prisma.bar.create({
        data: {
          id: DEFAULT_BAR_ID,
          name: "Restaurante Principal",
          slug: "principal",
          active: true,
        },
      });
    }

    // Garante vínculo do usuário com o bar padrão
    const existing = await prisma.userBar.findUnique({
      where: { userId_barId: { userId, barId: DEFAULT_BAR_ID } },
    });
    if (!existing) {
      await prisma.userBar.create({
        data: { id: `ub-${userId}`, userId, barId: DEFAULT_BAR_ID },
      });
    }

    return DEFAULT_BAR_ID;
  } catch (err) {
    console.error("[requireBar] Erro ao garantir bar padrão:", err);
    return DEFAULT_BAR_ID;
  }
}

export async function getEffectiveBarIds(userId: string, role: string, email?: string): Promise<string[]> {
  try {
    const isPlatformAdmin = role === "ADMIN" && email === "admin@rtpg.local";
    if (isPlatformAdmin) {
      const rows = await prisma.bar.findMany({
        where: { active: true },
        select: { id: true },
        orderBy: { name: "asc" },
      });
      if (rows.length) return rows.map((row) => row.id);
      // Admin mas sem bar? Cria o padrão
      const barId = await ensureDefaultBar(userId);
      return [barId];
    }

    const links = await prisma.userBar.findMany({
      where: { userId },
      select: { barId: true },
    });

    if (links.length) return links.map((item) => item.barId);

    // Nenhum vínculo: auto-provisiona o bar padrão
    const barId = await ensureDefaultBar(userId);
    return [barId];
  } catch (err) {
    // Se as tabelas Bar/UserBar não existem (migration não rodou),
    // retorna o bar padrão como fallback
    console.error("[requireBar] Erro ao buscar bars:", err);
    return [DEFAULT_BAR_ID];
  }
}

export async function requireBar(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Nao autenticado." });
  }

  try {
    const allowed = await getEffectiveBarIds(req.user.userId, req.user.role, req.user.email);
    const headerBar = typeof req.headers["x-bar-id"] === "string" ? req.headers["x-bar-id"].trim() : "";
    const chosen = headerBar && allowed.includes(headerBar) ? headerBar : allowed[0];
    req.barId = chosen;
    next();
  } catch (error) {
    console.error("[requireBar]", error);
    // Fallback: usa o bar padrão para não bloquear o usuário
    req.barId = DEFAULT_BAR_ID;
    next();
  }
}
