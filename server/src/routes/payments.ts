import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { createPixPayment, getPaymentStatus, isMercadoPagoConfigured } from "../services/mercadopago";
import { getStoredSetting, setStoredSetting } from "../services/system-settings";

const router = Router();

// Status da configuração de pagamentos
router.get("/config", requireAuth, async (_req, res) => {
  const mpConfigured = await isMercadoPagoConfigured();
  const mpAccessToken = await getStoredSetting<string | null>("mp_access_token", null);
  res.json({
    mercadoPago: {
      configured: mpConfigured,
      accessTokenHint: mpAccessToken ? `...${mpAccessToken.slice(-6)}` : null
    }
  });
});

// Salvar credenciais do Mercado Pago
router.put("/config/mercadopago", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { accessToken } = z.object({ accessToken: z.string().min(10) }).parse(req.body);
  await setStoredSetting("mp_access_token", accessToken);
  res.json({ ok: true });
});

// Remover credenciais do Mercado Pago
router.delete("/config/mercadopago", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  await setStoredSetting("mp_access_token", null);
  res.json({ ok: true });
});

// Gerar cobrança Pix
router.post("/pix", requireAuth, async (req, res) => {
  const { saleId, amount, description } = z.object({
    saleId: z.string().optional(),
    amount: z.number().positive(),
    description: z.string().default("Pagamento RTPG Gestão")
  }).parse(req.body);

  const mpPayment = await createPixPayment({ amount, description }) as {
    id: number;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
  };

  const payment = await prisma.tablePayment.create({
    data: {
      id: crypto.randomUUID(),
      saleId: saleId ?? null,
      provider: "MERCADOPAGO",
      externalId: String(mpPayment.id),
      amount,
      status: "PENDENTE",
      pixQrCode: mpPayment.point_of_interaction?.transaction_data?.qr_code ?? null,
      pixQrCodeBase64: mpPayment.point_of_interaction?.transaction_data?.qr_code_base64 ?? null
    }
  });

  res.json({
    id: payment.id,
    pixQrCode: payment.pixQrCode,
    pixQrCodeBase64: payment.pixQrCodeBase64,
    amount: payment.amount,
    status: payment.status
  });
});

// Verificar status de um pagamento
router.get("/:id/status", requireAuth, async (req, res) => {
  const payment = await prisma.tablePayment.findUniqueOrThrow({ where: { id: req.params.id } });

  if (payment.status === "PAGO") {
    return res.json({ status: "PAGO", paidAt: payment.paidAt });
  }

  if (payment.externalId) {
    const mpData = await getPaymentStatus(payment.externalId);
    if (mpData.status === "approved") {
      const updated = await prisma.tablePayment.update({
        where: { id: payment.id },
        data: { status: "PAGO", paidAt: new Date() }
      });
      return res.json({ status: "PAGO", paidAt: updated.paidAt });
    }
  }

  res.json({ status: payment.status });
});

// Webhook do Mercado Pago
router.post("/webhook/mercadopago", async (req, res) => {
  try {
    const body = req.body as { type?: string; data?: { id?: string | number } };
    if (body.type === "payment" && body.data?.id) {
      const mpData = await getPaymentStatus(String(body.data.id));
      if (mpData.status === "approved") {
        await prisma.tablePayment.updateMany({
          where: { externalId: String(body.data.id), status: { not: "PAGO" } },
          data: { status: "PAGO", paidAt: new Date() }
        });
      }
    }
  } catch (_) {}
  res.sendStatus(200);
});

export default router;
