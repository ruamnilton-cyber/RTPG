/**
 * routes/whatsapp.ts
 *
 * Endpoints da aba WhatsApp — agora multi-tenant via requireBar.
 * Cada endpoint opera isolado pelo barId do restaurante autenticado.
 *
 *  GET  /whatsapp/status          → estado da conexão + QR code (polling)
 *  POST /whatsapp/connect         → inicia conexão
 *  POST /whatsapp/disconnect      → encerra sessão
 *  POST /whatsapp/reset-retries   → reseta contador de reconexões
 *  GET  /whatsapp/health          → healthcheck da conexão
 *  GET  /whatsapp/orders          → lista pedidos (query: status)
 *  GET  /whatsapp/orders/:id      → detalhe de um pedido
 *  POST /whatsapp/orders/:id/confirm-payment
 *  POST /whatsapp/orders/:id/cancel
 *  GET  /whatsapp/menu-preview    → visualizar cardápio formatado
 *  POST /whatsapp/test-message    → enviar msg de teste (admin)
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import {
  getWppState,
  initWpp,
  disconnectWpp,
  reconnectWpp,
  sendWppMessage,
  setMessageHandler,
  getHealthcheck,
  getAllHealthchecks,
  resetRetries,
} from "../services/whatsapp-service";
import {
  handleIncomingMessage,
  listOrders,
  getOrder,
  confirmOrderPayment,
  cancelOrder,
  getFormattedMenu,
} from "../services/whatsapp-orders";

const router = Router();

// Registra o handler de mensagens (agora recebe barId)
setMessageHandler(handleIncomingMessage);

// Todas as rotas exigem autenticação + resolução do bar
router.use(requireAuth);
router.use(requireBar);

// ─── Conexão ─────────────────────────────────────────────────────────────────

router.get("/status", (req, res) => {
  res.json(getWppState(req.barId!));
});

router.post("/connect", requireRole("ADMIN", "GERENTE"), async (req, res) => {
  await initWpp(req.barId!);
  res.json({ ok: true, message: "Iniciando conexão...", state: getWppState(req.barId!) });
});

router.post("/disconnect", requireRole("ADMIN", "GERENTE"), async (req, res) => {
  await disconnectWpp(req.barId!);
  res.json({ ok: true, message: "Sessão encerrada.", state: getWppState(req.barId!) });
});

router.post("/reconnect", requireRole("ADMIN", "GERENTE"), async (req, res) => {
  await reconnectWpp(req.barId!);
  res.json({ ok: true, message: "Reconectando... Aguarde o QR Code.", state: getWppState(req.barId!) });
});

router.post("/reset-retries", requireRole("ADMIN", "GERENTE"), (req, res) => {
  resetRetries(req.barId!);
  res.json({ ok: true, message: "Contador de reconexões resetado." });
});

// ─── Healthcheck ─────────────────────────────────────────────────────────────

router.get("/health", (req, res) => {
  res.json(getHealthcheck(req.barId!));
});

router.get("/health/all", requireRole("ADMIN"), (_req, res) => {
  res.json(getAllHealthchecks());
});

// ─── Cardápio (preview) ───────────────────────────────────────────────────────

router.get("/menu-preview", async (req, res) => {
  const menu = await getFormattedMenu(req.barId!);
  res.json({ menu });
});

// ─── Pedidos ──────────────────────────────────────────────────────────────────

router.get("/orders", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const orders = await listOrders(req.barId!, status);
  res.json(orders);
});

router.get("/orders/:id", async (req, res) => {
  const order = await getOrder(req.barId!, req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Pedido não encontrado." });
  }
  res.json(order);
});

router.post(
  "/orders/:id/confirm-payment",
  requireRole("ADMIN", "GERENTE", "CAIXA", "OPERADOR"),
  async (req, res) => {
    const order = await getOrder(req.barId!, req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }
    if (!["AGUARDANDO_PAGAMENTO", "AGUARDANDO_CONFERENCIA", "NOVO"].includes(order.status)) {
      return res.status(400).json({ message: `Pedido não pode ser confirmado no status "${order.status}".` });
    }

    await confirmOrderPayment(req.barId!, req.params.id, req.user!.userId);
    res.json({ ok: true, message: "Pagamento confirmado. Pedido atualizado." });
  }
);

router.post(
  "/orders/:id/cancel",
  requireRole("ADMIN", "GERENTE", "CAIXA", "OPERADOR"),
  async (req, res) => {
    const order = await getOrder(req.barId!, req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }
    if (["CONFIRMADO", "CANCELADO"].includes(order.status)) {
      return res.status(400).json({ message: `Pedido já está com status "${order.status}".` });
    }

    await cancelOrder(req.barId!, req.params.id);
    res.json({ ok: true, message: "Pedido cancelado." });
  }
);

// ─── Mensagem de teste ────────────────────────────────────────────────────────

router.post("/test-message", requireRole("ADMIN"), async (req, res) => {
  const { phone, message } = z
    .object({
      phone: z.string().min(8),
      message: z.string().min(1),
    })
    .parse(req.body);

  await sendWppMessage(req.barId!, phone, message);
  res.json({ ok: true });
});

export default router;
