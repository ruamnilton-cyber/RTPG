import fs from "node:fs";
import path from "node:path";
import makeWASocket, {
  Browsers,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAVersion
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { prisma } from "../lib/prisma";
import { appEnv } from "../env";

const BAILEYS_VERSION_FALLBACK: WAVersion = [2, 3000, 1027934701];

type ConnectionState = "CONECTADO" | "DESCONECTADO" | "AGUARDANDO_QR";

type RuntimeMessage = {
  id: string;
  from: string;
  text: string;
  createdAt: string;
  direction: "IN" | "OUT";
};

type RuntimeHandoff = {
  id: string;
  from: string;
  reason: string;
  text: string;
  createdAt: string;
};

type WhatsAppRuntime = {
  barId: string;
  status: ConnectionState;
  qrCodeDataUrl: string | null;
  lastQrText: string | null;
  connectedAt: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  socket: ReturnType<typeof makeWASocket> | null;
  reconnectTimer: NodeJS.Timeout | null;
  recentMessages: RuntimeMessage[];
  handoffs: RuntimeHandoff[];
  manualDisconnect: boolean;
  qrRecoveryAttempts: number;
  qrHealthTimer: NodeJS.Timeout | null;
};

type CartItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string;
};

type CartSuggestion = {
  productId: string;
  name: string;
  unitPrice: number;
};

type ConversationStep =
  | "INICIO"
  | "MONTANDO_PEDIDO"
  | "AGUARDANDO_ENTREGA"
  | "AGUARDANDO_DADOS"
  | "AGUARDANDO_PAGAMENTO"
  | "AGUARDANDO_CONFIRMACAO";

type ConversationCart = {
  barId: string;
  jid: string;
  step: ConversationStep;
  customerName: string;
  customerPhone: string;
  fulfillmentType: "ENTREGA" | "RETIRADA" | "";
  address: string;
  paymentMethod: "PIX" | "CARTAO" | "DINHEIRO" | "";
  changeFor: string;
  items: CartItem[];
  suggestions: CartSuggestion[];
  updatedAt: string;
};

type ProductMatch = {
  product: Awaited<ReturnType<typeof prisma.product.findMany>>[number];
  quantity: number;
  score: number;
};

const runtimes = new Map<string, WhatsAppRuntime>();
const carts = new Map<string, ConversationCart>();
const PRODUCT_STOP_WORDS = new Set([
  "com",
  "sem",
  "uma",
  "umas",
  "uns",
  "para",
  "pra",
  "por",
  "favor",
  "quero",
  "queria",
  "pedido",
  "pedir",
  "fazer",
  "ver",
  "tem",
  "voce",
  "voces",
  "mais",
  "menos",
  "porcao",
  "porcao",
  "porcoes",
  "unidade",
  "unidades"
]);

function getAuthDir(barId: string) {
  return path.join(appEnv.storageDir, "whatsapp-auth", barId);
}

function getRuntime(barId: string) {
  const current = runtimes.get(barId);
  if (current) {
    return current;
  }

  const created: WhatsAppRuntime = {
    barId,
    status: "DESCONECTADO",
    qrCodeDataUrl: null,
    lastQrText: null,
    connectedAt: null,
    phoneNumber: null,
    lastError: null,
    socket: null,
    reconnectTimer: null,
    recentMessages: [],
    handoffs: [],
    manualDisconnect: false,
    qrRecoveryAttempts: 0,
    qrHealthTimer: null
  };
  runtimes.set(barId, created);
  return created;
}

function getCartKey(barId: string, jid: string) {
  return `${barId}:${jid}`;
}

function getCart(barId: string, jid: string) {
  const key = getCartKey(barId, jid);
  const current = carts.get(key);
  if (current) {
    current.updatedAt = new Date().toISOString();
    return current;
  }

  const created: ConversationCart = {
    barId,
    jid,
    step: "INICIO",
    customerName: "",
    customerPhone: "",
    fulfillmentType: "",
    address: "",
    paymentMethod: "",
    changeFor: "",
    items: [],
    suggestions: [],
    updatedAt: new Date().toISOString()
  };
  carts.set(key, created);
  return created;
}

function resetCart(barId: string, jid: string) {
  carts.delete(getCartKey(barId, jid));
}

function clearReconnectTimer(runtime: WhatsAppRuntime) {
  if (runtime.reconnectTimer) {
    clearTimeout(runtime.reconnectTimer);
    runtime.reconnectTimer = null;
  }
}

function clearQrHealthTimer(runtime: WhatsAppRuntime) {
  if (runtime.qrHealthTimer) {
    clearTimeout(runtime.qrHealthTimer);
    runtime.qrHealthTimer = null;
  }
}

function clearAuthDir(barId: string) {
  const authDir = getAuthDir(barId);
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
  }
}

async function resolveBaileysVersion() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const result = await fetchLatestBaileysVersion({ signal: controller.signal });
    clearTimeout(timeout);
    return {
      version: result.version ?? BAILEYS_VERSION_FALLBACK,
      warning: result.error ? `Fallback de versao aplicado: ${String(result.error)}` : null
    };
  } catch (error) {
    return {
      version: BAILEYS_VERSION_FALLBACK,
      warning: `Nao consegui consultar a ultima versao do WhatsApp Web. Usando fallback local. Motivo: ${String(error)}`
    };
  }
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !PRODUCT_STOP_WORDS.has(token));
}

function extractMessageText(message: any) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  );
}

function pushRuntimeMessage(runtime: WhatsAppRuntime, message: RuntimeMessage) {
  runtime.recentMessages = [message, ...runtime.recentMessages].slice(0, 30);
}

function pushRuntimeHandoff(runtime: WhatsAppRuntime, handoff: RuntimeHandoff) {
  runtime.handoffs = [handoff, ...runtime.handoffs].slice(0, 20);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCurrency(value: number) {
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}

function formatOrderStatus(status: string) {
  if (status === "ABERTO") return "recebido";
  if (status === "CONFIRMADO") return "confirmado";
  if (status === "EM_PREPARO") return "em preparo";
  if (status === "PRONTO") return "pronto";
  if (status === "ENTREGUE") return "entregue";
  if (status === "AGUARDANDO_PAGAMENTO") return "aguardando pagamento";
  if (status === "FECHADO") return "finalizado";
  if (status === "CANCELADO") return "cancelado";
  return status.toLowerCase();
}

function getGreetingMessage() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia.";
  if (hour < 18) return "Boa tarde.";
  return "Boa noite.";
}

async function reply(runtime: WhatsAppRuntime, jid: string, text: string) {
  if (!runtime.socket) return;
  await runtime.socket.sendMessage(jid, { text });
  pushRuntimeMessage(runtime, {
    id: `${Date.now()}-out`,
    from: jid,
    text,
    createdAt: new Date().toISOString(),
    direction: "OUT"
  });
}

async function replyMany(runtime: WhatsAppRuntime, jid: string, messages: string[]) {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]?.trim();
    if (!message) continue;
    await reply(runtime, jid, message);
    if (index < messages.length - 1) {
      await delay(500);
    }
  }
}

async function sendMenu(runtime: WhatsAppRuntime, jid: string, barId: string) {
  const products = await prisma.product.findMany({
    where: { barId, active: true },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });

  if (!products.length) {
    await reply(runtime, jid, "Ainda nao temos itens ativos no cardapio. Vou chamar um atendente para te ajudar.");
    pushRuntimeHandoff(runtime, {
      id: `${Date.now()}-handoff`,
      from: jid,
      reason: "Cliente pediu cardapio, mas nao existem produtos ativos",
      text: "Cardapio vazio no sistema.",
      createdAt: new Date().toISOString()
    });
    return;
  }

  const grouped = new Map<string, typeof products>();
  for (const product of products) {
    const category = product.category?.name ?? "Outros";
    grouped.set(category, [...(grouped.get(category) ?? []), product]);
  }

  const menuBlocks = Array.from(grouped.entries()).map(([category, categoryProducts]) => {
    const items = categoryProducts.map((product) => {
      const description = product.description ? ` - ${product.description}` : "";
      return `- ${product.name}${description}: ${formatCurrency(Number(product.salePrice))}`;
    });
    return [`*${category}*`, ...items].join("\n");
  });

  const messages = ["Claro! Aqui esta nosso cardapio:"];
  let current = "";
  for (const block of menuBlocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > 2800) {
      messages.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  if (current) messages.push(current);
  messages.push("Qual item voce gostaria de pedir?");

  await replyMany(runtime, jid, messages);
}

async function sendOrderStatus(runtime: WhatsAppRuntime, jid: string, barId: string) {
  const order = await prisma.order.findFirst({
    where: {
      barId,
      channel: "WHATSAPP",
      notes: { contains: `whatsapp-jid:${jid}` }
    },
    orderBy: { openedAt: "desc" }
  });

  if (!order) {
    await reply(runtime, jid, "Ainda nao encontrei pedido aberto com esse numero. Se quiser, me peca o cardapio que eu te ajudo a montar o pedido.");
    return;
  }

  await replyMany(runtime, jid, [
    `Seu pedido esta ${formatOrderStatus(order.status)}.`,
    `Total atual: ${formatCurrency(Number(order.totalAmount))}.\nSe quiser acrescentar algo, e so me mandar o nome do item.`
  ]);
}

async function findProductsFromText(barId: string, rawText: string) {
  const text = normalizeText(rawText);
  const textTokens = new Set(tokenize(rawText));
  const products = await prisma.product.findMany({
    where: { barId, active: true },
    orderBy: { name: "asc" }
  });

  return products
    .map((product) => {
    const normalizedName = normalizeText(product.name);
      const productTokens = tokenize(product.name);
      const descriptionTokens = tokenize(product.description ?? "");
      let score = 0;

      if (normalizedName.length >= 4 && text.includes(normalizedName)) {
        score += 100;
      }

      for (const token of productTokens) {
        if (textTokens.has(token)) score += token.length >= 6 ? 3 : 2;
        if (token.length >= 5 && text.includes(token)) score += 1;
      }

      for (const token of descriptionTokens) {
        if (textTokens.has(token)) score += 1;
      }

      return { product, score };
    })
    .filter((candidate) => candidate.score >= 2)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
}

async function getRestaurantName(barId: string) {
  const bar = await prisma.bar.findUnique({ where: { id: barId }, select: { name: true } });
  return bar?.name || "restaurante";
}

async function sendWelcome(runtime: WhatsAppRuntime, jid: string, restaurantName: string) {
  await replyMany(runtime, jid, [
    `Bem-vindo ao ${restaurantName}! 🍽️`,
    "Em que posso ajudar hoje?"
  ]);
}

function parseQuantity(rawText: string, productName: string) {
  const normalized = normalizeText(rawText);
  const normalizedProduct = normalizeText(productName);
  const beforeProduct = normalized.split(normalizedProduct)[0] ?? "";
  const numberBefore = beforeProduct.match(/(\d{1,2})\s*$/)?.[1];
  const firstNumber = normalized.match(/\b(\d{1,2})\b/)?.[1];
  const quantity = Number(numberBefore ?? firstNumber ?? 1);
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.min(quantity, 50);
}

async function findProductMatches(barId: string, rawText: string) {
  const candidates = await findProductsFromText(barId, rawText);
  if (!candidates.length) return [];

  const exact = candidates.filter((candidate) => candidate.score >= 100);
  if (exact.length) {
    return exact.map((candidate) => ({
      product: candidate.product,
      quantity: parseQuantity(rawText, candidate.product.name),
      score: candidate.score
    }));
  }

  const [first, second] = candidates;
  if (!first || first.score < 3) return [];
  if (second && first.score <= second.score + 1) return [];

  return [{
    product: first.product,
    quantity: parseQuantity(rawText, first.product.name),
    score: first.score
  }];
}

function getCartTotals(cart: ConversationCart) {
  const subtotal = cart.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return {
    subtotal,
    total: subtotal
  };
}

function getCartSummary(cart: ConversationCart) {
  if (!cart.items.length) return "Nenhum item selecionado ainda.";
  const lines = cart.items.map((item) => `- ${item.quantity}x ${item.name} - ${formatCurrency(item.quantity * item.unitPrice)}`);
  const totals = getCartTotals(cart);
  return [...lines, "", `Subtotal: ${formatCurrency(totals.subtotal)}`, `Total: ${formatCurrency(totals.total)}`].join("\n");
}

function addMatchesToCart(cart: ConversationCart, matches: ProductMatch[]) {
  for (const match of matches) {
    const existing = cart.items.find((item) => item.productId === match.product.id && !item.notes);
    if (existing) {
      existing.quantity += match.quantity;
    } else {
      cart.items.push({
        productId: match.product.id,
        name: match.product.name,
        quantity: match.quantity,
        unitPrice: Number(match.product.salePrice),
        notes: ""
      });
    }
  }
  cart.step = "MONTANDO_PEDIDO";
  cart.suggestions = [];
}

function isOrderIntent(normalized: string) {
  return [
    "fazer pedido",
    "fazer um pedido",
    "quero pedir",
    "queria pedir",
    "vou pedir",
    "montar pedido",
    "anota",
    "anotar",
    "me ve",
    "me manda",
    "pode mandar"
  ].some((term) => normalized.includes(normalizeText(term)));
}

function isMenuIntent(normalized: string) {
  return ["cardapio", "menu", "opcoes", "opções", "preco", "precos", "valor", "valores", "tem o que"].some((term) => normalized.includes(normalizeText(term)));
}

function isGreetingIntent(normalized: string) {
  return ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"].some((term) => normalized === normalizeText(term) || normalized.startsWith(normalizeText(term)));
}

async function replyWithProductSuggestions(runtime: WhatsAppRuntime, jid: string, barId: string, rawText: string) {
  const candidates = await findProductsFromText(barId, rawText);
  if (!candidates.length) return false;

  const optionsToShow = candidates.slice(0, 5);
  const cart = getCart(barId, jid);
  cart.suggestions = optionsToShow.map((candidate) => ({
    productId: candidate.product.id,
    name: candidate.product.name,
    unitPrice: Number(candidate.product.salePrice)
  }));

  const options = optionsToShow.map((candidate, index) => {
    return `${index + 1}. ${candidate.product.name} - ${formatCurrency(Number(candidate.product.salePrice))}`;
  });

  await replyMany(runtime, jid, [
    "Acho que encontrei algumas opcoes parecidas:",
    options.join("\n"),
    "Qual delas voce quer adicionar ao pedido?"
  ]);
  return true;
}

function getSuggestionChoice(cart: ConversationCart, rawText: string) {
  const choice = Number(normalizeText(rawText).match(/^\s*(\d{1,2})\s*$/)?.[1] ?? 0);
  if (!choice || !cart.suggestions.length) return null;
  const selected = cart.suggestions[choice - 1];
  if (!selected) return null;
  return selected;
}

function isPositiveConfirmation(normalized: string) {
  return ["sim", "confirmo", "confirmar", "pode confirmar", "tudo certo", "certo", "ok", "fechado"].some((term) => normalized.includes(term));
}

function isNegativeConfirmation(normalized: string) {
  return ["nao", "não", "cancelar", "cancela", "errado", "alterar", "mudar"].some((term) => normalized.includes(term));
}

function parseFulfillment(normalized: string): "ENTREGA" | "RETIRADA" | "" {
  if (normalized.includes("entrega") || normalized.includes("delivery")) return "ENTREGA";
  if (normalized.includes("retirada") || normalized.includes("retirar") || normalized.includes("buscar")) return "RETIRADA";
  return "";
}

function parsePayment(normalized: string): "PIX" | "CARTAO" | "DINHEIRO" | "" {
  if (normalized.includes("pix")) return "PIX";
  if (normalized.includes("cartao") || normalized.includes("credito") || normalized.includes("debito")) return "CARTAO";
  if (normalized.includes("dinheiro")) return "DINHEIRO";
  return "";
}

function extractPhone(text: string) {
  return text.replace(/\D/g, "").match(/\d{10,13}/)?.[0] ?? "";
}

async function createConfirmedWhatsAppOrder(cart: ConversationCart, restaurantName: string) {
  const totals = getCartTotals(cart);
  const notes = [
    `whatsapp-jid:${cart.jid}`,
    `telefone:${cart.customerPhone || ""}`,
    `tipo:${cart.fulfillmentType || ""}`,
    `endereco:${cart.address || ""}`,
    `pagamento:${cart.paymentMethod || ""}`,
    `troco:${cart.changeFor || ""}`
  ].join("\n");

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        barId: cart.barId,
        createdByUserId: null,
        channel: "WHATSAPP",
        status: "CONFIRMADO",
        customerName: cart.customerName || cart.jid,
        notes,
        subtotal: totals.subtotal,
        totalAmount: totals.total
      }
    });

    await tx.orderItem.createMany({
      data: cart.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        notes: item.notes || null
      }))
    });

    await tx.receivable.create({
      data: {
        barId: cart.barId,
        orderId: order.id,
        description: `Pedido WhatsApp - ${restaurantName}`,
        category: "Vendas",
        costCenter: "OPERACAO",
        amount: totals.total,
        dueDate: new Date(),
        status: "PENDENTE",
        counterparty: cart.customerName || cart.jid,
        notes: `Pagamento informado: ${cart.paymentMethod || "nao informado"}`
      }
    });

    return tx.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { product: true }, orderBy: { createdAt: "asc" } } }
    });
  });
}

async function sendOrderConfirmation(runtime: WhatsAppRuntime, jid: string, cart: ConversationCart) {
  const deliveryLine = cart.fulfillmentType ? `Forma de entrega: ${cart.fulfillmentType === "ENTREGA" ? "Entrega" : "Retirada"}` : "Forma de entrega: ainda nao informada";
  const paymentLine = cart.paymentMethod ? `Forma de pagamento: ${cart.paymentMethod === "CARTAO" ? "Cartao" : cart.paymentMethod}` : "Forma de pagamento: ainda nao informada";
  await replyMany(runtime, jid, [
    "Perfeito! Vou resumir seu pedido para confirmar.",
    [
      getCartSummary(cart),
      "",
      deliveryLine,
      cart.fulfillmentType === "ENTREGA" && cart.address ? `Endereco: ${cart.address}` : "",
      paymentLine,
      cart.paymentMethod === "DINHEIRO" && cart.changeFor ? `Troco para: ${cart.changeFor}` : "",
      "",
      "Esta tudo certo para eu confirmar seu pedido?"
    ].filter(Boolean).join("\n")
  ]);
}

async function handleIncomingMessage(barId: string, remoteJid: string, pushName: string, text: string) {
  const runtime = getRuntime(barId);
  pushRuntimeMessage(runtime, {
    id: `${Date.now()}-in`,
    from: remoteJid,
    text,
    createdAt: new Date().toISOString(),
    direction: "IN"
  });

  const normalized = normalizeText(text);
  if (!normalized) return;
  const restaurantName = await getRestaurantName(barId);
  const cart = getCart(barId, remoteJid);

  if (["atendente", "humano", "pessoa", "reclamacao", "reclamar"].some((term) => normalized.includes(term))) {
    pushRuntimeHandoff(runtime, {
      id: `${Date.now()}-handoff`,
      from: remoteJid,
      reason: "Cliente pediu atendimento humano",
      text,
      createdAt: new Date().toISOString()
    });
    await reply(runtime, remoteJid, "Vou encaminhar seu atendimento para um atendente agora.");
    return;
  }

  if (normalized.includes("status")) {
    await sendOrderStatus(runtime, remoteJid, barId);
    return;
  }

  if (isMenuIntent(normalized)) {
    await sendMenu(runtime, remoteJid, barId);
    return;
  }

  if (cart.step === "INICIO" && isGreetingIntent(normalized)) {
    cart.customerName = pushName || "";
    await sendWelcome(runtime, remoteJid, restaurantName);
    return;
  }

  const suggestionChoice = getSuggestionChoice(cart, text);
  if (suggestionChoice) {
    addMatchesToCart(cart, [{
      product: {
        id: suggestionChoice.productId,
        name: suggestionChoice.name,
        salePrice: suggestionChoice.unitPrice
      } as ProductMatch["product"],
      quantity: 1,
      score: 100
    }]);
    await replyMany(runtime, remoteJid, [
      "Perfeito, adicionei ao seu pedido:",
      `- 1x ${suggestionChoice.name}`,
      [
        "",
        `Total parcial: ${formatCurrency(getCartTotals(cart).total)}.`,
        "",
        "Deseja acrescentar mais algum item?",
        "Se ja estiver tudo certo, responda \"finalizar\"."
      ].join("\n")
    ]);
    return;
  }

  if (cart.step === "INICIO" && ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"].some((term) => normalized === normalizeText(term) || normalized.startsWith(normalizeText(term)))) {
    cart.customerName = pushName || "";
    await sendWelcome(runtime, remoteJid, restaurantName);
    return;
  }

  const matches = await findProductMatches(barId, text);
  if (matches.length) {
    addMatchesToCart(cart, matches);
    const added = matches.map((match) => `- ${match.quantity}x ${match.product.name}`).join("\n");
    await replyMany(runtime, remoteJid, [
      "Perfeito, adicionei ao seu pedido:",
      added,
      [
        "",
        `Total parcial: ${formatCurrency(getCartTotals(cart).total)}.`,
        "",
        "Deseja acrescentar bebida, sobremesa ou mais algum item?",
        "Se ja estiver tudo certo, responda \"finalizar\"."
      ].join("\n")
    ]);
    return;
  }

  if (["finalizar", "fechar", "concluir", "confirmar pedido", "so isso", "só isso"].some((term) => normalized.includes(normalizeText(term)))) {
    if (!cart.items.length) {
      await reply(runtime, remoteJid, "Ainda nao tenho itens no seu pedido. Me diga o item e a quantidade para eu montar.");
      return;
    }
    cart.step = "AGUARDANDO_ENTREGA";
    await reply(runtime, remoteJid, "Seu pedido e para entrega ou retirada?");
    return;
  }

  if (await replyWithProductSuggestions(runtime, remoteJid, barId, text)) {
    cart.step = "MONTANDO_PEDIDO";
    return;
  }

  if (isOrderIntent(normalized)) {
    cart.step = "MONTANDO_PEDIDO";
    await replyMany(runtime, remoteJid, [
      "Perfeito! Vamos montar seu pedido.",
      "Me diga o item e a quantidade. Exemplo: \"2 batatas\" ou \"1 camarao internacional\".",
      "Se quiser, tambem posso te mostrar o cardapio."
    ]);
    return;
  }

  if (cart.step === "AGUARDANDO_ENTREGA") {
    const fulfillment = parseFulfillment(normalized);
    if (!fulfillment) {
      await reply(runtime, remoteJid, "Me confirma, por favor: seu pedido e para entrega ou retirada?");
      return;
    }
    cart.fulfillmentType = fulfillment;
    cart.step = "AGUARDANDO_DADOS";
    if (fulfillment === "ENTREGA") {
      await reply(runtime, remoteJid, "Me informe, por favor: nome, telefone e endereco completo com numero e referencia.");
    } else {
      await reply(runtime, remoteJid, "Perfeito! Me informe seu nome e telefone para identificacao.");
    }
    return;
  }

  if (cart.step === "AGUARDANDO_DADOS") {
    const phone = extractPhone(text);
    cart.customerPhone = phone || cart.customerPhone;
    cart.customerName = cart.customerName || pushName || remoteJid;
    if (cart.fulfillmentType === "ENTREGA") {
      cart.address = text.trim();
    }
    cart.step = "AGUARDANDO_PAGAMENTO";
    await replyMany(runtime, remoteJid, [
      "Combinado.",
      "Qual sera a forma de pagamento?\n- Pix\n- Cartao\n- Dinheiro"
    ]);
    return;
  }

  if (cart.step === "AGUARDANDO_PAGAMENTO") {
    const payment = parsePayment(normalized);
    if (!payment) {
      await reply(runtime, remoteJid, "Qual sera a forma de pagamento: Pix, Cartao ou Dinheiro?");
      return;
    }
    cart.paymentMethod = payment;
    if (payment === "DINHEIRO") {
      const moneyMatch = text.match(/(?:troco|para)\s*(?:r\$)?\s*([\d.,]+)/i)?.[1];
      cart.changeFor = moneyMatch ? `R$ ${moneyMatch}` : "";
    }
    cart.step = "AGUARDANDO_CONFIRMACAO";
    await sendOrderConfirmation(runtime, remoteJid, cart);
    return;
  }

  if (cart.step === "AGUARDANDO_CONFIRMACAO") {
    if (isPositiveConfirmation(normalized)) {
      const order = await createConfirmedWhatsAppOrder(cart, restaurantName);
      const items = order?.items.map((item) => `${item.quantity}x ${item.product.name}`).join(", ") ?? getCartSummary(cart);
      pushRuntimeHandoff(runtime, {
        id: `${Date.now()}-order`,
        from: remoteJid,
        reason: "Novo pedido WhatsApp confirmado",
        text: [
          `Pedido: ${order?.id ?? "sem numero"}`,
          `Cliente: ${cart.customerName || pushName || remoteJid}`,
          `Telefone: ${cart.customerPhone || "nao informado"}`,
          `Itens: ${items}`,
          `Total: ${formatCurrency(getCartTotals(cart).total)}`,
          `Entrega/retirada: ${cart.fulfillmentType || "nao informado"}`,
          cart.address ? `Endereco: ${cart.address}` : "",
          `Pagamento: ${cart.paymentMethod || "nao informado"}`
        ].filter(Boolean).join("\n"),
        createdAt: new Date().toISOString()
      });
      resetCart(barId, remoteJid);
      await replyMany(runtime, remoteJid, [
        "Pedido confirmado com sucesso! ✅",
        `Ja encaminhei para a equipe do ${restaurantName}.`,
        "Em breve seu pedido sera preparado."
      ]);
      return;
    }

    if (isNegativeConfirmation(normalized)) {
      cart.step = "MONTANDO_PEDIDO";
      await reply(runtime, remoteJid, "Sem problema. Me diga o que deseja alterar ou qual item quer adicionar/remover.");
      return;
    }

    await reply(runtime, remoteJid, "So preciso da sua confirmacao: esta tudo certo para eu confirmar o pedido?");
    return;
  }

  pushRuntimeHandoff(runtime, {
    id: `${Date.now()}-handoff`,
    from: remoteJid,
    reason: "Mensagem fora do fluxo automatico",
    text,
    createdAt: new Date().toISOString()
  });

  await replyMany(runtime, remoteJid, [
    "Nao consegui entender isso com seguranca.",
    "Vou encaminhar seu atendimento para uma pessoa da equipe continuar com voce."
  ]);
}

async function destroySocket(runtime: WhatsAppRuntime) {
  clearReconnectTimer(runtime);
  clearQrHealthTimer(runtime);
  try {
    runtime.socket?.end(undefined);
  } catch {}
  runtime.socket = null;
}

function scheduleQrRecovery(barId: string, runtime: WhatsAppRuntime) {
  clearQrHealthTimer(runtime);
  runtime.qrHealthTimer = setTimeout(() => {
    if (runtime.manualDisconnect || runtime.status === "CONECTADO" || runtime.qrCodeDataUrl || runtime.lastQrText) {
      return;
    }

    if (runtime.qrRecoveryAttempts >= 2) {
      runtime.lastError = "Nao consegui gerar um QR valido automaticamente. Tente reconectar o WhatsApp novamente.";
      runtime.status = "DESCONECTADO";
      return;
    }

    runtime.qrRecoveryAttempts += 1;
    runtime.lastError = "Refazendo a sessao do WhatsApp para gerar um novo QR...";
    connectWhatsApp(barId, { forceFreshSession: true }).catch((error) => {
      runtime.lastError = `Falha ao recuperar o QR automaticamente. Motivo: ${String(error)}`;
      runtime.status = "DESCONECTADO";
    });
  }, 12000);
}

export async function connectWhatsApp(barId: string, options?: { forceFreshSession?: boolean }) {
  const runtime = getRuntime(barId);
  runtime.manualDisconnect = false;
  runtime.status = "AGUARDANDO_QR";
  runtime.qrCodeDataUrl = null;
  runtime.lastQrText = null;
  runtime.lastError = null;
  runtime.connectedAt = null;
  runtime.phoneNumber = null;

  clearReconnectTimer(runtime);
  clearQrHealthTimer(runtime);

  if (options?.forceFreshSession) {
    runtime.qrRecoveryAttempts = Math.max(runtime.qrRecoveryAttempts, 1);
    await destroySocket(runtime);
    clearAuthDir(barId);
  } else {
    runtime.qrRecoveryAttempts = 0;
    await destroySocket(runtime);
  }

  const authDir = getAuthDir(barId);
  fs.mkdirSync(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const resolvedVersion = await resolveBaileysVersion();
  if (resolvedVersion.warning) {
    runtime.lastError = resolvedVersion.warning;
  }

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    logger: pino({ level: "silent" }),
    browser: Browsers.appropriate("Chrome"),
    version: resolvedVersion.version,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    qrTimeout: 45_000,
    syncFullHistory: false,
    fireInitQueries: true
  });

  runtime.socket = sock;
  scheduleQrRecovery(barId, runtime);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    if (update.connection === "connecting") {
      runtime.status = "AGUARDANDO_QR";
    }

    if (update.qr) {
      runtime.status = "AGUARDANDO_QR";
      runtime.lastQrText = String(update.qr);
      runtime.qrRecoveryAttempts = 0;
      try {
        runtime.qrCodeDataUrl = await QRCode.toDataURL(String(update.qr), { margin: 1, width: 320 });
        runtime.lastError = null;
        clearQrHealthTimer(runtime);
      } catch (error) {
        runtime.qrCodeDataUrl = null;
        runtime.lastError = `Nao consegui converter o QR em imagem. Motivo: ${String(error)}`;
      }
    }

    if (update.connection === "open") {
      runtime.status = "CONECTADO";
      runtime.qrCodeDataUrl = null;
      runtime.lastQrText = null;
      runtime.qrRecoveryAttempts = 0;
      runtime.connectedAt = new Date().toISOString();
      runtime.phoneNumber = sock.user?.id ?? null;
      runtime.lastError = null;
      clearQrHealthTimer(runtime);
    }

    if (update.connection === "close") {
      runtime.socket = null;
      runtime.connectedAt = null;
      runtime.phoneNumber = null;
      clearQrHealthTimer(runtime);
      runtime.status = runtime.manualDisconnect ? "DESCONECTADO" : "AGUARDANDO_QR";
      if (runtime.manualDisconnect) {
        runtime.qrCodeDataUrl = null;
        runtime.lastQrText = null;
      }
      runtime.lastError = runtime.manualDisconnect
        ? (update.lastDisconnect?.error ? String(update.lastDisconnect.error) : null)
        : null;

      if (!runtime.manualDisconnect) {
        scheduleQrRecovery(barId, runtime);
        runtime.reconnectTimer = setTimeout(() => {
          connectWhatsApp(barId).catch((error) => console.error("Falha ao reconectar WhatsApp", error));
        }, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const entry of messages) {
      if (entry.key.fromMe) continue;
      const remoteJid = entry.key.remoteJid;
      if (!remoteJid || remoteJid.endsWith("@g.us")) continue;
      const text = extractMessageText(entry.message);
      await handleIncomingMessage(barId, remoteJid, entry.pushName ?? remoteJid, text);
    }
  });

  return getWhatsAppStatus(barId);
}

export async function disconnectWhatsApp(barId: string) {
  const runtime = getRuntime(barId);
  runtime.manualDisconnect = true;
  clearReconnectTimer(runtime);
  clearQrHealthTimer(runtime);

  try {
    await runtime.socket?.logout();
  } catch {}
  try {
    runtime.socket?.end(undefined);
  } catch {}

  runtime.socket = null;
  runtime.connectedAt = null;
  runtime.phoneNumber = null;
  runtime.status = "DESCONECTADO";
  runtime.qrCodeDataUrl = null;
  runtime.lastQrText = null;
  runtime.lastError = null;
  runtime.qrRecoveryAttempts = 0;

  clearAuthDir(barId);

  return getWhatsAppStatus(barId);
}

export function getWhatsAppStatus(barId: string) {
  const runtime = getRuntime(barId);
  return {
    status: runtime.status,
    qrCodeDataUrl: runtime.qrCodeDataUrl,
    lastQrText: runtime.lastQrText,
    connectedAt: runtime.connectedAt,
    phoneNumber: runtime.phoneNumber,
    lastError: runtime.lastError,
    recentMessages: runtime.recentMessages,
    handoffs: runtime.handoffs
  };
}

export async function bootstrapWhatsAppConnections() {
  const baseDir = path.join(appEnv.storageDir, "whatsapp-auth");
  if (!fs.existsSync(baseDir)) return;

  for (const dir of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const barId = dir.name;
    connectWhatsApp(barId).catch((error) => console.error(`Falha ao restaurar WhatsApp do bar ${barId}`, error));
  }
}
