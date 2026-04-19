import crypto from "node:crypto";
import { Router } from "express";
import QRCode from "qrcode";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { calculateProductCost } from "../services/inventory";
import { getBrandSetting } from "../services/settings";

const router = Router();
router.use(requireAuth, requireBar);

async function recalculateSessionSubtotal(tableSessionId: string) {
  const items = await prisma.tableSessionItem.findMany({ where: { tableSessionId } });
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  await prisma.tableSession.update({
    where: { id: tableSessionId },
    data: { subtotal }
  });
  return subtotal;
}

router.get("/tables", async (req, res) => {
  const tables = await prisma.restaurantTable.findMany({
    where: { barId: req.barId! },
    include: {
      sessions: {
        where: { status: { in: ["ABERTA", "AGUARDANDO_FECHAMENTO"] } },
        include: { items: true },
        orderBy: { openedAt: "desc" },
        take: 1
      },
      calls: {
        where: { status: "PENDENTE" },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { number: "asc" }
  });
  res.json(tables);
});

router.get("/inbox", async (req, res) => {
  const [openSessions, waitingCloseSessions, recentSales, waiterCalls] = await Promise.all([
    prisma.tableSession.findMany({
      where: { status: "ABERTA", table: { barId: req.barId! } },
      include: { table: true, items: { include: { product: true } }, user: true },
      orderBy: { openedAt: "asc" }
    }),
    prisma.tableSession.findMany({
      where: { status: "AGUARDANDO_FECHAMENTO", table: { barId: req.barId! } },
      include: { table: true, items: { include: { product: true } }, user: true },
      orderBy: { openedAt: "asc" }
    }),
    prisma.sale.findMany({
      where: { barId: req.barId! },
      include: { user: true, items: { include: { product: true } } },
      orderBy: { soldAt: "desc" },
      take: 8
    }),
    prisma.waiterCall.findMany({
      where: { status: "PENDENTE", table: { barId: req.barId! } },
      include: { table: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  res.json({
    queue: [
      ...openSessions.map((session) => ({
        id: session.id,
        type: "MESA_ABERTA",
        table: session.table.number,
        label: `Mesa ${session.table.number} aberta`,
        owner: session.user.name,
        itemsCount: session.items.length,
        total: session.subtotal,
        openedAt: session.openedAt
      })),
      ...waitingCloseSessions.map((session) => ({
        id: session.id,
        type: "FECHAMENTO_PENDENTE",
        table: session.table.number,
        label: `Mesa ${session.table.number} aguardando fechamento`,
        owner: session.user.name,
        itemsCount: session.items.length,
        total: session.subtotal,
        openedAt: session.openedAt
      }))
    ],
    calls: waiterCalls.map((call) => ({
      id: call.id,
      table: call.table.number,
      createdAt: call.createdAt,
      status: call.status
    })),
    recentSales: recentSales.map((sale) => ({
      id: sale.id,
      soldAt: sale.soldAt,
      user: sale.user.name,
      total: sale.grossAmount,
      finalAmount: sale.finalAmount,
      itemsCount: sale.items.length
    }))
  });
});

router.post("/tables", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({ number: z.number().int().positive(), name: z.string().min(1) }).parse(req.body);
  const table = await prisma.restaurantTable.create({
    data: { ...data, barId: req.barId!, qrCodeToken: crypto.randomUUID() }
  });
  res.status(201).json(table);
});

router.put("/tables/:tableId", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({ number: z.number().int().positive(), name: z.string().min(1) }).parse(req.body);
  const table = await prisma.restaurantTable.findFirst({
    where: { id: req.params.tableId, barId: req.barId! }
  });
  if (!table) {
    throw new Error("Mesa não encontrada neste restaurante.");
  }

  const updated = await prisma.restaurantTable.update({
    where: { id: req.params.tableId },
    data
  });
  res.json(updated);
});

router.delete("/tables/:tableId", requireRole("ADMIN"), async (req, res) => {
  const table = await prisma.restaurantTable.findFirst({
    where: { id: req.params.tableId, barId: req.barId! },
    include: {
      sessions: {
        where: { status: { in: ["ABERTA", "AGUARDANDO_FECHAMENTO"] } },
        take: 1
      }
    }
  });
  if (!table) {
    throw new Error("Mesa não encontrada neste restaurante.");
  }
  if (table.sessions.length > 0) {
    throw new Error("Não é possível excluir uma mesa com comanda aberta.");
  }

  await prisma.waiterCall.deleteMany({ where: { tableId: table.id } });
  await prisma.restaurantTable.delete({ where: { id: table.id } });
  res.status(204).send();
});

router.post("/tables/:tableId/session", async (req, res) => {
  const table = await prisma.restaurantTable.findFirst({
    where: { id: req.params.tableId, barId: req.barId! }
  });
  if (!table) {
    throw new Error("Mesa não encontrada neste bar.");
  }

  const existing = await prisma.tableSession.findFirst({
    where: { tableId: req.params.tableId, status: { in: ["ABERTA", "AGUARDANDO_FECHAMENTO"] } }
  });
  if (existing) {
    return res.json(existing);
  }

  const session = await prisma.tableSession.create({
    data: {
      tableId: req.params.tableId,
      userId: req.user!.userId,
      notes: req.body.notes ?? null
    }
  });

  await prisma.restaurantTable.update({ where: { id: req.params.tableId }, data: { status: "OCUPADA" } });
  res.status(201).json(session);
});

router.get("/tables/:tableId/session", async (req, res) => {
  const table = await prisma.restaurantTable.findFirst({
    where: { id: req.params.tableId, barId: req.barId! }
  });
  if (!table) {
    return res.json(null);
  }
  const session = await prisma.tableSession.findFirst({
    where: { tableId: req.params.tableId, status: { in: ["ABERTA", "AGUARDANDO_FECHAMENTO"] } },
    include: { table: true, items: { include: { product: true }, orderBy: { createdAt: "asc" } } }
  });
  res.json(session);
});

router.post("/sessions/:sessionId/items", async (req, res) => {
  const data = z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    notes: z.string().optional().nullable()
  }).parse(req.body);

  const session = await prisma.tableSession.findUnique({
    where: { id: req.params.sessionId },
    include: { table: true }
  });
  if (!session || session.status === "FECHADA") {
    throw new Error("Mesa não está disponível para lançamento.");
  }
  if (session.table.barId !== req.barId) {
    throw new Error("Sessão não pertence ao bar selecionado.");
  }

  const product = await prisma.product.findFirst({
    where: { id: data.productId, barId: req.barId! }
  });
  if (!product) {
    throw new Error("Produto não encontrado.");
  }

  const item = await prisma.tableSessionItem.create({
    data: {
      tableSessionId: req.params.sessionId,
      productId: data.productId,
      quantity: data.quantity,
      unitPrice: product.salePrice,
      notes: data.notes
    }
  });

  const subtotal = await recalculateSessionSubtotal(req.params.sessionId);
  res.status(201).json({ item, subtotal });
});

router.put("/session-items/:itemId", async (req, res) => {
  const data = z.object({
    quantity: z.number().int().positive(),
    notes: z.string().optional().nullable()
  }).parse(req.body);

  const current = await prisma.tableSessionItem.findUnique({
    where: { id: req.params.itemId },
    include: { tableSession: { include: { table: true } } }
  });
  if (!current) {
    throw new Error("Item da mesa não encontrado.");
  }
  if (current.tableSession.table.barId !== req.barId) {
    throw new Error("Item não pertence ao bar selecionado.");
  }

  const item = await prisma.tableSessionItem.update({ where: { id: req.params.itemId }, data });
  const subtotal = await recalculateSessionSubtotal(current.tableSessionId);
  res.json({ item, subtotal });
});

router.delete("/session-items/:itemId", async (req, res) => {
  const current = await prisma.tableSessionItem.findUnique({
    where: { id: req.params.itemId },
    include: { tableSession: { include: { table: true } } }
  });
  if (!current) {
    throw new Error("Item da mesa não encontrado.");
  }
  if (current.tableSession.table.barId !== req.barId) {
    throw new Error("Item não pertence ao bar selecionado.");
  }

  await prisma.tableSessionItem.delete({ where: { id: req.params.itemId } });
  const subtotal = await recalculateSessionSubtotal(current.tableSessionId);
  res.json({ subtotal });
});

router.post("/sessions/:sessionId/request-close", async (req, res) => {
  const session = await prisma.tableSession.findUnique({
    where: { id: req.params.sessionId },
    include: { table: true }
  });
  if (!session || session.table.barId !== req.barId) {
    throw new Error("Sessão não encontrada.");
  }
  const updated = await prisma.tableSession.update({
    where: { id: req.params.sessionId },
    data: { status: "AGUARDANDO_FECHAMENTO" }
  });
  await prisma.restaurantTable.update({ where: { id: session.tableId }, data: { status: "AGUARDANDO_FECHAMENTO" } });
  res.json(updated);
});

router.post("/sessions/:sessionId/close", async (req, res) => {
  const data = z.object({
    deductionsAmount: z.number().min(0).default(0),
    serviceFeeAmount: z.number().min(0).default(0)
  }).parse(req.body);
  const session = await prisma.tableSession.findUnique({
    where: { id: req.params.sessionId },
    include: {
      items: { include: { product: { include: { recipeItems: { include: { supply: true } } } } } },
      table: true
    }
  });

  if (!session) {
    throw new Error("Mesa não encontrada.");
  }
  if (session.table.barId !== req.barId) {
    throw new Error("Esta mesa não pertence ao bar selecionado.");
  }
  if (session.items.length === 0) {
    throw new Error("Não é possível fechar uma mesa sem itens.");
  }

  const totalGross = session.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const netAmount = totalGross - data.deductionsAmount + data.serviceFeeAmount;
  const totalCost = session.items.reduce((sum, item) => sum + calculateProductCost(item.product.recipeItems) * item.quantity, 0);
  const needs = new Map<string, { quantity: number; supplyName: string }>();
  for (const item of session.items) {
    for (const recipe of item.product.recipeItems) {
      const current = needs.get(recipe.supplyId);
      needs.set(recipe.supplyId, {
        quantity: (current?.quantity ?? 0) + Number(recipe.quantityRequired) * item.quantity,
        supplyName: recipe.supply.name
      });
    }
  }

  const sale = await prisma.$transaction(async (tx) => {
    const supplyIds = Array.from(needs.keys());
    const supplies = await tx.supply.findMany({ where: { id: { in: supplyIds }, barId: req.barId! } });
    const supplyMap = new Map(supplies.map((item) => [item.id, item]));

    for (const [supplyId, need] of needs.entries()) {
      const supply = supplyMap.get(supplyId);
      if (!supply) {
        throw new Error(`Insumo não encontrado para baixa: ${need.supplyName}.`);
      }
      if (Number(supply.stockCurrent) < need.quantity) {
        throw new Error(`Estoque insuficiente para ${need.supplyName}.`);
      }
    }

    for (const [supplyId, need] of needs.entries()) {
      const supply = supplyMap.get(supplyId)!;
      const previousStock = Number(supply.stockCurrent);
      const newStock = previousStock - need.quantity;

      await tx.supply.update({
        where: { id: supplyId },
        data: { stockCurrent: newStock }
      });

      await tx.inventoryMovement.create({
        data: {
          supplyId,
          type: "BAIXA_VENDA",
          quantity: -need.quantity,
          previousStock,
          currentStock: newStock,
          reason: "Baixa automática por fechamento de mesa",
          referenceId: session.id
        }
      });
    }

    const createdSale = await tx.sale.create({
      data: {
        barId: req.barId!,
        tableSessionId: session.id,
        userId: req.user!.userId,
        grossAmount: totalGross,
        deductionsAmount: data.deductionsAmount,
        netAmount,
        costAmount: totalCost,
        finalAmount: netAmount - totalCost,
        items: {
          create: session.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: Number(item.unitPrice) * item.quantity,
            costAmount: calculateProductCost(item.product.recipeItems) * item.quantity
          }))
        }
      },
      include: { items: true }
    });

    await tx.tableSession.update({
      where: { id: session.id },
      data: { status: "FECHADA", closedAt: new Date() }
    });

    await tx.restaurantTable.update({ where: { id: session.tableId }, data: { status: "LIVRE" } });
    return createdSale;
  });

  res.json(sale);
});

router.get("/qr-codes", async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const brand = await getBrandSetting(req.barId!);
  const tables = await prisma.restaurantTable.findMany({
    where: { barId: req.barId! },
    orderBy: { number: "asc" }
  });
  const output = await Promise.all(
    tables.map(async (table) => ({
      ...table,
      url: `${baseUrl}/public/mesa/${table.qrCodeToken}`,
      imageDataUrl: await QRCode.toDataURL(`${baseUrl}/public/mesa/${table.qrCodeToken}`),
      logoUrl: brand.logoUrl
    }))
  );
  res.json(output);
});

router.get("/calls", async (req, res) => {
  const calls = await prisma.waiterCall.findMany({
    where: { table: { barId: req.barId! } },
    include: { table: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(calls);
});

router.post("/calls/:id/handle", async (req, res) => {
  const call = await prisma.waiterCall.findUnique({
    where: { id: req.params.id },
    include: { table: true }
  });
  if (!call || call.table.barId !== req.barId) {
    throw new Error("Chamado não encontrado.");
  }
  const updated = await prisma.waiterCall.update({
    where: { id: req.params.id },
    data: { status: "ATENDIDO", handledAt: new Date() }
  });
  res.json(updated);
});

export default router;
