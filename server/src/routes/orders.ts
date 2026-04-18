import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { updateOrderStatus } from "../services/orders";

const router = Router();
router.use(requireAuth, requireBar);

router.get("/", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const channel = req.query.channel ? String(req.query.channel) : undefined;
  const orders = await prisma.order.findMany({
    where: {
      barId: req.barId!,
      ...(status ? { status: status as never } : {}),
      ...(channel ? { channel: channel as never } : {})
    },
    include: {
      table: true,
      createdByUser: { select: { id: true, name: true, email: true } },
      items: { include: { product: true }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      receivable: true
    },
    orderBy: { openedAt: "desc" }
  });
  res.json(orders);
});

router.get("/:id", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, barId: req.barId! },
    include: {
      table: true,
      createdByUser: { select: { id: true, name: true, email: true } },
      items: { include: { product: true }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      receivable: true
    }
  });
  if (!order) {
    throw new Error("Pedido nao encontrado.");
  }
  res.json(order);
});

router.post("/", requireRole("ADMIN", "GERENTE", "CAIXA", "GARCOM", "OPERADOR"), async (req, res) => {
  const data = z.object({
    channel: z.enum(["SALAO", "BALCAO", "DELIVERY", "WHATSAPP", "QR"]).default("BALCAO"),
    tableId: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        notes: z.string().optional().nullable()
      })
    ).default([])
  }).parse(req.body);

  const productIds = data.items.map((item) => item.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, barId: req.barId! }
      })
    : [];
  const productMap = new Map(products.map((item) => [item.id, item]));

  if (products.length !== new Set(productIds).size) {
    throw new Error("Um ou mais produtos nao pertencem ao restaurante ativo.");
  }

  const subtotal = data.items.reduce((sum, item) => {
    const product = productMap.get(item.productId)!;
    return sum + Number(product.salePrice) * item.quantity;
  }, 0);

  const order = await prisma.order.create({
    data: {
      barId: req.barId!,
      tableId: data.tableId || null,
      createdByUserId: req.user!.userId,
      channel: data.channel,
      status: "ABERTO",
      customerName: data.customerName || null,
      notes: data.notes || null,
      subtotal,
      totalAmount: subtotal,
      items: {
        create: data.items.map((item) => {
          const product = productMap.get(item.productId)!;
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Number(product.salePrice),
            totalPrice: Number(product.salePrice) * item.quantity,
            notes: item.notes || null
          };
        })
      }
    },
    include: {
      items: { include: { product: true } },
      table: true
    }
  });

  res.status(201).json(order);
});

router.patch("/:id/status", requireRole("ADMIN", "GERENTE", "CAIXA", "GARCOM", "COZINHA", "OPERADOR"), async (req, res) => {
  const data = z.object({
    status: z.enum(["ABERTO", "CONFIRMADO", "EM_PREPARO", "PRONTO", "ENTREGUE", "AGUARDANDO_PAGAMENTO", "FECHADO", "CANCELADO"])
  }).parse(req.body);
  const order = await updateOrderStatus(req.params.id, req.barId!, data.status);
  res.json(order);
});

export default router;
