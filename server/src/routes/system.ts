import path from "node:path";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { appEnv } from "../env";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

/**
 * Visão global do sistema: caminhos de dados, contagens e resumo por bar.
 * Sem middleware de bar — é gestão da instalação inteira.
 */
router.get("/overview", async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [usersActive, usersTotal, barsAll, productCount, supplyCount, salesLast30, tablesTotal] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.user.count(),
    prisma.bar.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true, supplies: true, tables: true, sales: true }
        }
      }
    }),

    prisma.product.count(),
    prisma.supply.count(),
    prisma.sale.count({ where: { soldAt: { gte: thirtyDaysAgo } } }),
    prisma.restaurantTable.count()
  ]);

  const dbUrl = appEnv.databaseUrl ?? "";
  const dbFile =
    dbUrl.startsWith("file:") ? path.basename(dbUrl.replace(/^file:/i, "").split("?")[0]) : "(não SQLite ou URL customizada)";

  res.json({
    security: {
      jwtUsingDefaultSecret: appEnv.jwtSecret === "rtpg-dev-secret"
    },
    paths: {
      storageDir: appEnv.storageDir,
      rtpgBaseDir: appEnv.rtpgBaseDir,
      databaseFile: dbFile
    },
    counts: {
      usersActive,
      usersTotal,
      barsTotal: barsAll.length,
      barsActive: barsAll.filter((b) => b.active).length,
      productsTotal: productCount,
      suppliesTotal: supplyCount,
      tablesTotal,
      salesLast30Days: salesLast30
    },
    bars: barsAll.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      active: b.active,
      products: b._count.products,
      supplies: b._count.supplies,
      tables: b._count.tables,
      sales: b._count.sales
    })),
    runtime: {
      port: appEnv.port,
      node: process.version
    }
  });
});

router.get("/audit-log", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 400);
  const logs = await prisma.actionLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, role: true } }
    }
  });
  res.json(logs);
});

export default router;
