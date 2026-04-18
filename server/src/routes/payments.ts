import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { createPixPayment, getPaymentStatus, isMercadoPagoConfigured } from "../services/mercadopago";
import { createAsaasPixPayment, getAsaasPaymentStatus, isAsaasConfigured, isAsaasPaid } from "../services/asaas";
import { getStoredSetting, setStoredSetting } from "../services/system-settings";

const router = Router();

// Status da configuração de pagamentos
router.get("/config", requireAuth, async (_req, res) => {
  const [mpConfigured, asaasConfigured] = await Promise.all([
    isMercadoPagoConfigured(),
    isAsaasConfigured()
  ]);

  const mpAccessToken = mpConfigured
    ? await getStoredSetting<string | null>("mp_access_token", null)
    : null;

  const asaasApiKey = asaasConfigured
    ? await getStoredSetting<string | null>("asaas_api_key", null)
    : null;

  const asaasSandbox = await getStoredSetting<string | null>("asaas_sandbox", "true");

  res.json({
    mercadoPago: {
      configured: mpConfigured,
      accessTokenHint: mpAccessToken ? `...${mpAccessToken.slice(-6)}` : null
    },
    asaas: {
      configured: asaasConfigured,
      apiKeyHint: asaasApiKey ? `...${asaasApiKey.slice(-6)}` : null,
      sandbox: asaasSandbox !== "false"
    }
  });
});

// ── Mercado Pago ─────────────────────────────────────────────────────────────

router.put("/config/mercadopago", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { accessToken } = z.object({ accessToken: z.string().min(10) }).parse(req.body);
  await setStoredSetting("mp_access_token", accessToken);
  res.json({ ok: true });
});

router.delete("/config/mercadopago", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  await setStoredSetting("mp_access_token", null);
  res.json({ ok: true });
});

// ── Asaas ────────────────────────────────────────────────────────────────────

router.put("/config/asaas", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { apiKey, sandbox, cpfCnpj } = z.object({
    apiKey:   z.string().min(10),
    sandbox:  z.boolean().optional(),
    cpfCnpj: z.string().min(11).max(14).optional()
  }).parse(req.body);

  await setStoredSetting("asaas_api_key", apiKey);
  await setStoredSetting("asaas_sandbox", sandbox === false ? "false" : "true");
  if (cpfCnpj) await setStoredSetting("asaas_cpf_cnpj", cpfCnpj.replace(/\D/g, ""));
  // Invalidate cached customer so a new one is created with updated settings
  await setStoredSetting("asaas_customer_id", null);
  res.json({ ok: true });
});

router.delete("/config/asaas", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  await setStoredSetting("asaas_api_key", null);
  await setStoredSetting("asaas_customer_id", null);
  res.json({ ok: true });
});

// ── Gerar cobrança Pix ────────────────────────────────────────────────────────

router.post("/pix", requireAuth, async (req, res) => {
  const { saleId, amount, description, provider } = z.object({
    saleId:      z.string().optional(),
    amount:      z.number().positive(),
    description: z.string().default("Pagamento RTPG Gestão"),
    provider:    z.enum(["MERCADOPAGO", "ASAAS"]).optional()
  }).parse(req.body);

  // Auto-detect provider if not specified
  const resolvedProvider = provider ?? await (async () => {
    if (await isAsaasConfigured()) return "ASAAS";
    return "MERCADOPAGO";
  })();

  if (resolvedProvider === "ASAAS") {
    const pix = await createAsaasPixPayment({ amount, description });

    const payment = await prisma.tablePayment.create({
      data: {
        id: crypto.randomUUID(),
        saleId: saleId ?? null,
        provider: "ASAAS",
        externalId: String(pix.id),
        amount,
        status: "PENDENTE",
        pixQrCode: pix.pixQrCode ?? null,
        pixQrCodeBase64: pix.pixQrCodeBase64 ?? null
      }
    });

    return res.json({
      id: payment.id,
      pixQrCode: payment.pixQrCode,
      pixQrCodeBase64: payment.pixQrCodeBase64,
      amount: payment.amount,
      status: payment.status,
      provider: payment.provider
    });
  }

  // Mercado Pago
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
    status: payment.status,
    provider: payment.provider
  });
});

// ── Verificar status de um pagamento ─────────────────────────────────────────

router.get("/:id/status", requireAuth, async (req, res) => {
  const payment = await prisma.tablePayment.findUniqueOrThrow({ where: { id: req.params.id } });

  if (payment.status === "PAGO") {
    return res.json({ status: "PAGO", paidAt: payment.paidAt });
  }

  if (payment.externalId) {
    if (payment.provider === "ASAAS") {
      const data = await getAsaasPaymentStatus(payment.externalId);
      if (isAsaasPaid(data.status)) {
        const updated = await prisma.tablePayment.update({
          where: { id: payment.id },
          data: { status: "PAGO", paidAt: new Date() }
        });
        return res.json({ status: "PAGO", paidAt: updated.paidAt });
      }
    } else {
      const mpData = await getPaymentStatus(payment.externalId);
      if (mpData.status === "approved") {
        const updated = await prisma.tablePayment.update({
          where: { id: payment.id },
          data: { status: "PAGO", paidAt: new Date() }
        });
        return res.json({ status: "PAGO", paidAt: updated.paidAt });
      }
    }
  }

  res.json({ status: payment.status });
});

// ── Webhooks ──────────────────────────────────────────────────────────────────

router.post("/webhook/mercadopago", async (req, res) => {
  try {
    const body = req.body as { type?: string; data?: { id?: string | number } };
    if (body.type === "payment" && body.data?.id) {
      const mpData = await getPaymentStatus(String(body.data.id));
      if (mpData.status === "approved") {
        await prisma.tablePayment.updateMany({
          where: { externalId: String(body.data.id), provider: "MERCADOPAGO", status: { not: "PAGO" } },
          data: { status: "PAGO", paidAt: new Date() }
        });
      }
    }
  } catch (_) {}
  res.sendStatus(200);
});

router.post("/webhook/asaas", async (req, res) => {
  try {
    const body = req.body as { event?: string; payment?: { id?: string; status?: string } };
    const paid = body.payment?.status && isAsaasPaid(body.payment.status);
    if (paid && body.payment?.id) {
      await prisma.tablePayment.updateMany({
        where: { externalId: body.payment.id, provider: "ASAAS", status: { not: "PAGO" } },
        data: { status: "PAGO", paidAt: new Date() }
      });
    }
  } catch (_) {}
  res.sendStatus(200);
});

export default router;
