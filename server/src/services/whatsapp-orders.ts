/**
 * whatsapp-orders.ts
 *
 * Lógica de negócio para pedidos originados pelo WhatsApp.
 * Agora totalmente isolado por barId — cada restaurante opera
 * seus próprios pedidos, conversas, cardápio e produtos.
 *
 * PONTO DE EXTENSÃO PARA IA:
 *   A função `parseOrderText` pode ser substituída por uma chamada
 *   à OpenAI mantendo a mesma assinatura.
 */

import { prisma } from "../lib/prisma";
import { sendWppMessage } from "./whatsapp-service";
import { createPaymentLink } from "./payment-service";
import { randomUUID } from "node:crypto";

// ─── Cardápio (por bar) ──────────────────────────────────────────────────────

export async function getFormattedMenu(barId: string): Promise<string> {
  const categories = await prisma.productCategory.findMany({
    where: { barId, products: { some: { barId, active: true } } },
    include: {
      products: {
        where: { barId, active: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  if (!categories.length) {
    return "📋 Cardápio ainda não cadastrado. Entre em contato diretamente.";
  }

  const lines: string[] = ["🍽️ *CARDÁPIO*\n"];

  for (const cat of categories) {
    lines.push(`*${cat.name.toUpperCase()}*`);
    for (const p of cat.products) {
      const price = p.salePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const desc = p.description ? `  _${p.description}_` : "";
      lines.push(`• ${p.name} — ${price}${desc}`);
    }
    lines.push("");
  }

  lines.push("Para fazer seu pedido, basta digitar os itens desejados.\nEx: *1 X-Burguer, 2 Refrigerante*");
  return lines.join("\n");
}

// ─── Intérprete de mensagem (regras simples) ──────────────────────────────────

interface ParsedItem {
  quantity: number;
  name: string;
}

function parseOrderText(text: string): ParsedItem[] {
  const cleaned = text
    .toLowerCase()
    .replace(/\bquero\b|\bpor favor\b|\bpls\b|\bpfv\b/g, "")
    .replace(/\be\b/g, ",");

  const items: ParsedItem[] = [];
  const segments = cleaned.split(/[,\n;]+/);

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;

    const match = s.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (match) {
      items.push({ quantity: parseInt(match[1], 10), name: match[2].trim() });
    } else {
      const nameOnly = s.replace(/^\d+\s*/, "").trim();
      if (nameOnly.length > 1) {
        items.push({ quantity: 1, name: nameOnly });
      }
    }
  }

  return items;
}

async function matchProducts(barId: string, parsedItems: ParsedItem[]) {
  const products = await prisma.product.findMany({ where: { barId, active: true } });

  return parsedItems.map((item) => {
    const normalized = item.name.toLowerCase();
    const product = products.find((p) => {
      const pName = p.name.toLowerCase();
      return pName.includes(normalized) || normalized.includes(pName);
    });

    return { ...item, product: product ?? null };
  });
}

// ─── Fluxo de conversa ────────────────────────────────────────────────────────

type ConversationState = "IDLE" | "MENU_SENT" | "AWAITING_ORDER" | "ORDER_PENDING_CONFIRM" | "AWAITING_PAYMENT";

export async function handleIncomingMessage(barId: string, phone: string, body: string): Promise<void> {
  const text = body.trim();
  const textLower = text.toLowerCase();

  // Obtém ou cria estado da conversa — isolado por barId + phone
  let conv = await prisma.whatsappConversation.findUnique({
    where: { barId_phone: { barId, phone } },
  });
  if (!conv) {
    conv = await prisma.whatsappConversation.create({
      data: {
        id: randomUUID(),
        barId,
        phone,
        state: "IDLE",
      },
    });
  }

  const convState = conv.state as ConversationState;

  // ── Saudação / início ──────────────────────────────────────────────────────
  const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello|hi|menu|cardápio|cardapio)\b/i.test(textLower);

  if (isGreeting || convState === "IDLE") {
    const menu = await getFormattedMenu(barId);
    await sendWppMessage(barId, phone, `Olá! Bem-vindo(a)! 😊\n\n${menu}`);
    await updateConvState(barId, phone, "MENU_SENT");
    return;
  }

  // ── Cliente pediu cardápio explicitamente ──────────────────────────────────
  if (textLower.includes("cardapio") || textLower.includes("cardápio") || textLower.includes("menu")) {
    const menu = await getFormattedMenu(barId);
    await sendWppMessage(barId, phone, menu);
    await updateConvState(barId, phone, "MENU_SENT");
    return;
  }

  // ── Cancelamento ──────────────────────────────────────────────────────────
  if (/\bcancel[ae]\b/i.test(textLower)) {
    if (conv.lastOrderId) {
      await prisma.whatsappOrder.updateMany({
        where: { id: conv.lastOrderId, barId, status: { in: ["NOVO", "AGUARDANDO_PAGAMENTO"] } },
        data: { status: "CANCELADO", updatedAt: new Date() },
      });
      await sendWppMessage(barId, phone, "Seu pedido foi cancelado. Se quiser pedir novamente, é só me chamar! 😊");
    } else {
      await sendWppMessage(barId, phone, "Não há pedido ativo para cancelar.");
    }
    await updateConvState(barId, phone, "IDLE");
    return;
  }

  // ── Confirmação do pedido ─────────────────────────────────────────────────
  if (convState === "ORDER_PENDING_CONFIRM") {
    if (/\bsim\b|\bok\b|\bconfirm[ao]\b|\bquero\b|\bpode\b|\bcerto\b/i.test(textLower)) {
      await finalizeOrder(barId, phone, conv.lastOrderId ?? "", conv.context ?? "{}");
      return;
    }
    if (/\bn[aã]o\b|\bnop\b|\bnops\b|\bcancela\b/i.test(textLower)) {
      if (conv.lastOrderId) {
        await prisma.whatsappOrder.update({
          where: { id: conv.lastOrderId },
          data: { status: "CANCELADO", updatedAt: new Date() },
        });
      }
      await sendWppMessage(barId, phone, "Pedido cancelado. Me diga novamente o que deseja pedir:");
      await updateConvState(barId, phone, "MENU_SENT");
      return;
    }
  }

  // ── Tentativa de identificar pedido ──────────────────────────────────────
  if (convState === "MENU_SENT" || convState === "AWAITING_ORDER") {
    const parsed = parseOrderText(text);
    if (!parsed.length) {
      await sendWppMessage(
        barId,
        phone,
        'Não entendi seu pedido. 😅 Por favor, informe os itens, ex: *2 X-Burguer, 1 Suco de Laranja*\n\nDigite *cardápio* para ver as opções disponíveis.'
      );
      return;
    }

    const matched = await matchProducts(barId, parsed);
    const found = matched.filter((m) => m.product !== null);
    const notFound = matched.filter((m) => m.product === null);

    if (!found.length) {
      await sendWppMessage(
        barId,
        phone,
        `Não encontrei esses itens no cardápio: ${notFound.map((m) => m.name).join(", ")}.\n\nDigite *cardápio* para ver as opções.`
      );
      return;
    }

    // Cria pedido provisório — vinculado ao barId
    const total = found.reduce((sum, m) => sum + m.product!.salePrice * m.quantity, 0);
    const itemLines = found.map((m) => {
      const price = (m.product!.salePrice * m.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return `• ${m.quantity}x ${m.product!.name} — ${price}`;
    });

    const orderId = randomUUID();
    const context = JSON.stringify({
      items: found.map((m) => ({
        productId: m.product!.id,
        productName: m.product!.name,
        quantity: m.quantity,
        unitPrice: m.product!.salePrice,
        totalPrice: m.product!.salePrice * m.quantity,
      })),
    });

    await prisma.whatsappOrder.create({
      data: {
        id: orderId,
        barId,
        phone,
        customerName: conv.customerName ?? undefined,
        status: "NOVO",
        totalAmount: total,
        items: {
          create: found.map((m) => ({
            id: randomUUID(),
            productId: m.product!.id,
            productName: m.product!.name,
            quantity: m.quantity,
            unitPrice: m.product!.salePrice,
            totalPrice: m.product!.salePrice * m.quantity,
          })),
        },
      },
    });

    await prisma.whatsappConversation.update({
      where: { barId_phone: { barId, phone } },
      data: {
        state: "ORDER_PENDING_CONFIRM",
        lastOrderId: orderId,
        context,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const totalStr = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const confirmMsg = [
      "🛒 *Resumo do seu pedido:*\n",
      ...itemLines,
      `\n💰 *Total: ${totalStr}*`,
      "\nConfirma o pedido? Responda *sim* para confirmar ou *não* para cancelar.",
    ].join("\n");

    if (notFound.length) {
      await sendWppMessage(barId, phone, `⚠️ Item(s) não encontrado(s): ${notFound.map((m) => m.name).join(", ")}. Continuarei com o restante.\n`);
    }

    await sendWppMessage(barId, phone, confirmMsg);
    return;
  }

  // ── Estado AGUARDANDO_PAGAMENTO ────────────────────────────────────────────
  if (convState === "AWAITING_PAYMENT") {
    await sendWppMessage(
      barId,
      phone,
      "⏳ Seu pedido já foi gerado e está aguardando pagamento. Verifique o link enviado anteriormente.\n\nSe precisar de ajuda, aguarde que um atendente entrará em contato."
    );
    return;
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  await sendWppMessage(barId, phone, 'Olá! Como posso ajudar? 😊\n\nDigite *cardápio* para ver nossas opções.');
  await updateConvState(barId, phone, "IDLE");
}

// ─── Finalização do pedido ────────────────────────────────────────────────────

async function finalizeOrder(barId: string, phone: string, orderId: string, _context: string): Promise<void> {
  const order = await prisma.whatsappOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || order.barId !== barId) {
    await sendWppMessage(barId, phone, "Erro ao localizar seu pedido. Por favor, faça o pedido novamente.");
    await updateConvState(barId, phone, "IDLE");
    return;
  }

  const link = await createPaymentLink(orderId, order.totalAmount, phone);

  await prisma.whatsappOrder.update({
    where: { id: orderId },
    data: { status: "AGUARDANDO_PAGAMENTO", paymentStatus: "PENDENTE", updatedAt: new Date() },
  });

  await updateConvState(barId, phone, "AWAITING_PAYMENT");

  const totalStr = order.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await sendWppMessage(
    barId,
    phone,
    [
      "✅ *Pedido confirmado!*\n",
      `💰 Total: *${totalStr}*`,
      `\n🔗 *Link de pagamento:*\n${link.url}`,
      "\nApós o pagamento, nossa equipe irá confirmar e seu pedido será processado.\n\nObrigado! 🙏",
    ].join("\n")
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function updateConvState(barId: string, phone: string, state: string) {
  await prisma.whatsappConversation.update({
    where: { barId_phone: { barId, phone } },
    data: { state, lastMessageAt: new Date(), updatedAt: new Date() },
  });
}

// ─── Consultas para o painel (isoladas por barId) ────────────────────────────

export async function listOrders(barId: string, status?: string) {
  return prisma.whatsappOrder.findMany({
    where: {
      barId,
      ...(status ? { status: status as "NOVO" | "AGUARDANDO_PAGAMENTO" | "AGUARDANDO_CONFERENCIA" | "CONFIRMADO" | "CANCELADO" } : {}),
    },
    include: { items: true, paymentLinks: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrder(barId: string, id: string) {
  return prisma.whatsappOrder.findFirst({
    where: { id, barId },
    include: { items: { include: { product: true } }, paymentLinks: { orderBy: { createdAt: "desc" } } },
  });
}

export async function confirmOrderPayment(barId: string, orderId: string, userId: string): Promise<void> {
  const order = await prisma.whatsappOrder.findFirst({ where: { id: orderId, barId } });
  if (!order) throw new Error("Pedido não encontrado para este restaurante.");

  await prisma.whatsappOrder.update({
    where: { id: orderId },
    data: {
      status: "CONFIRMADO",
      paymentStatus: "PAGO",
      confirmedBy: userId,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.paymentLink.updateMany({
    where: { orderId, status: "PENDENTE" },
    data: { status: "PAGO", paidAt: new Date() },
  });

  if (order.phone) {
    try {
      await sendWppMessage(
        barId,
        order.phone,
        "✅ *Pagamento confirmado!* Seu pedido foi recebido e está sendo preparado. Obrigado! 🙏"
      );
      await updateConvState(barId, order.phone, "IDLE");
    } catch {
      // não bloqueia se WhatsApp estiver offline
    }
  }
}

export async function cancelOrder(barId: string, orderId: string): Promise<void> {
  const order = await prisma.whatsappOrder.findFirst({ where: { id: orderId, barId } });
  if (!order) throw new Error("Pedido não encontrado para este restaurante.");

  await prisma.whatsappOrder.update({
    where: { id: orderId },
    data: { status: "CANCELADO", updatedAt: new Date() },
  });

  if (order.phone) {
    try {
      await sendWppMessage(
        barId,
        order.phone,
        "❌ Seu pedido foi cancelado. Se precisar de ajuda, entre em contato."
      );
      await updateConvState(barId, order.phone, "IDLE");
    } catch {
      // não bloqueia
    }
  }
}
