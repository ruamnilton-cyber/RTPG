import { Prisma, type OrderStatus, type PaymentMethod } from "@prisma/client";
import { prisma } from "../lib/prisma";

type PrismaLike = Prisma.TransactionClient | typeof prisma;

function getOrderTotals(items: Array<{ quantity: number; unitPrice: number }>) {
  return items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
}

export async function ensureOrderForTableSession(
  tx: PrismaLike,
  input: { sessionId: string; barId: string; tableId: string; createdByUserId?: string | null }
) {
  const existing = await tx.order.findFirst({
    where: { tableSessionId: input.sessionId }
  });

  if (existing) {
    return existing;
  }

  const created = await tx.order.create({
    data: {
      barId: input.barId,
      tableId: input.tableId,
      tableSessionId: input.sessionId,
      createdByUserId: input.createdByUserId ?? null,
      channel: "SALAO",
      status: "ABERTO",
      subtotal: 0,
      totalAmount: 0
    }
  });

  await tx.tableSession.update({
    where: { id: input.sessionId },
    data: { orderId: created.id }
  });

  return created;
}

export async function syncOrderItemsFromSession(tx: PrismaLike, sessionId: string) {
  const session = await tx.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      items: true,
      order: true
    }
  });

  if (!session) {
    throw new Error("Sessao nao encontrada para sincronizar pedido.");
  }

  const order = session.order
    ? session.order
    : await ensureOrderForTableSession(tx, {
        sessionId: session.id,
        barId: session.table.barId,
        tableId: session.tableId,
        createdByUserId: session.userId
      });

  await tx.orderItem.deleteMany({ where: { orderId: order.id } });

  if (session.items.length) {
    await tx.orderItem.createMany({
      data: session.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.unitPrice) * item.quantity,
        notes: item.notes ?? null
      }))
    });
  }

  const subtotal = getOrderTotals(session.items);

  return tx.order.update({
    where: { id: order.id },
    data: {
      subtotal,
      totalAmount: subtotal,
      status: session.status === "AGUARDANDO_FECHAMENTO" ? "AGUARDANDO_PAGAMENTO" : "ABERTO"
    },
    include: {
      items: true
    }
  });
}

export async function markOrderClosedFromSale(
  tx: PrismaLike,
  input: {
    sessionId: string;
    saleId: string;
    totalAmount: number;
    paymentMethod?: PaymentMethod;
  }
) {
  const order = await tx.order.findFirst({
    where: { tableSessionId: input.sessionId },
    include: { table: true }
  });

  if (!order) {
    return null;
  }

  const closedOrder = await tx.order.update({
    where: { id: order.id },
    data: {
      status: "FECHADO",
      totalAmount: input.totalAmount,
      closedAt: new Date()
    }
  });

  const receivable = await tx.receivable.upsert({
    where: { orderId: order.id },
    update: {
      saleId: input.saleId,
      amount: input.totalAmount,
      status: "PAGO",
      paidAt: new Date(),
      dueDate: new Date()
    },
    create: {
      barId: order.barId,
      orderId: order.id,
      saleId: input.saleId,
      description: order.table ? `Recebimento da mesa ${order.table.number}` : "Recebimento do pedido",
      category: "Vendas",
      costCenter: "OPERACAO",
      amount: input.totalAmount,
      dueDate: new Date(),
      status: "PAGO",
      paidAt: new Date(),
      counterparty: order.customerName ?? ""
    }
  });

  if (input.paymentMethod) {
    await tx.paymentRecord.create({
      data: {
        barId: order.barId,
        orderId: order.id,
        saleId: input.saleId,
        receivableId: receivable.id,
        method: input.paymentMethod,
        amount: input.totalAmount,
        status: "CONFIRMADO",
        paidAt: new Date()
      }
    });
  }

  return closedOrder;
}

export async function updateOrderStatus(
  orderId: string,
  barId: string,
  status: OrderStatus
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, barId }
  });
  if (!order) {
    throw new Error("Pedido nao encontrado neste restaurante.");
  }

  return prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(status === "FECHADO" || status === "CANCELADO" ? { closedAt: new Date() } : {})
    }
  });
}
