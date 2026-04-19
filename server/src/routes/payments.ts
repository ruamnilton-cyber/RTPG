import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { prisma } from "../lib/prisma";
import { createPixPayment, getPaymentStatus, isMercadoPagoConfigured } from "../services/mercadopago";
import { createAsaasPixPayment, getAsaasPaymentStatus, isAsaasConfigured, isAsaasPaid } from "../services/asaas";
import { getBarStoredSetting, setBarStoredSetting } from "../services/system-settings";

const router = Router();

// Status da configuração de pagamentos
router.get("/config", requireAuth, requireBar, async (req, res) => {
  const [mpConfigured, asaasConfigured] = await Promise.all([
    isMercadoPagoConfigured(req.barId!),
    isAsaasConfigured(req.barId!)
  ]);

  const mpAccessToken = mpConfigured
    ? await getBarStoredSetting<string | null>(req.barId!, "mp_access_token", null)
    : null;

  const asaasApiKey = asaasConfigured
    ? await getBarStoredSetting<string | null>(req.barId!, "asaas_api_key", null)
    : null;

  const asaasSandbox = await getBarStoredSetting<string | null>(req.barId!, "asaas_sandbox", "true");

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

router.put("/config/mercadopago", requireAuth, requireBar, requireRole("ADMIN"), async (req, res) => {
  const { accessToken } = z.object({ accessToken: z.string().min(10) }).parse(req.body);
  await setBarStoredSetting(req.barId!, "mp_access_token", accessToken);
  res.json({ ok: true });
});

router.delete("/config/mercadopago", requireAuth, requireBar, requireRole("ADMIN"), async (req, res) => {
  await setBarStoredSetting(req.barId!, "mp_access_token", null);
  res.json({ ok: true });
});

// ── Asaas ────────────────────────────────────────────────────────────────────

router.put("/config/asaas", requireAuth, requireBar, requireRole("ADMIN"), async (req, res) => {
  const { apiKey, sandbox, cpfCnpj } = z.object({
    apiKey:   z.string().min(10),
    sandbox:  z.boolean().optional(),
    cpfCnpj: z.string().min(11).max(14).optional()
  }).parse(req.body);

  await setBarStoredSetting(req.barId!, "asaas_api_key", apiKey);
  await setBarStoredSetting(req.barId!, "asaas_sandbox", sandbox === false ? "false" : "true");
  if (cpfCnpj) await setBarStoredSetting(req.barId!, "asaas_cpf_cnpj", cpfCnpj.replace(/\D/g, ""));
  // Invalidate cached customer so a new one is created with updated settings
  await setBarStoredSetting(req.barId!, "asaas_customer_id", null);
  res.json({ ok: true });
});

router.delete("/config/asaas", requireAuth, requireBar, requireRole("ADMIN"), async (req, res) => {
  await setBarStoredSetting(req.barId!, "asaas_api_key", null);
  await setBarStoredSetting(req.barId!, "asaas_customer_id", null);
  res.json({ ok: true });
});

// ── Gerar cobrança Pix ────────────────────────────────────────────────────────

router.post("/pix", requireAuth, requireBar, async (req, res) => {
  const { saleId, amount, description, provider } = z.object({
    saleId:      z.string().optional(),
    amount:      z.number().positive(),
    description: z.string().default("Pagamento RTPG Gestão"),
    provider:    z.enum(["MERCADOPAGO", "ASAAS"]).optional()
  }).parse(req.body);

  if (saleId) {
    const sale = await prisma.sale.findFirst({ where: { id: saleId, barId: req.barId! } });
    if (!sale) {
      return res.status(404).json({ message: "Venda nÃ£o encontrada para este restaurante." });
    }
  }

  // Auto-detect provider if not specified
  const resolvedProvider = provider ?? await (async () => {
    if (await isAsaasConfigured(req.barId!)) return "ASAAS";
    return "MERCADOPAGO";
  })();

  if (resolvedProvider === "ASAAS") {
    const pix = await createAsaasPixPayment(req.barId!, { amount, description });

    const payment = await prisma.tablePayment.create({
      data: {
        id: crypto.randomUUID(),
        barId: req.barId!,
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
  const mpPayment = await createPixPayment(req.barId!, { amount, description }) as {
    id: number;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
  };

  const payment = await prisma.tablePayment.create({
    data: {
      id: crypto.randomUUID(),
      barId: req.barId!,
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

router.get("/:id/status", requireAuth, requireBar, async (req, res) => {
  const payment = await prisma.tablePayment.findFirst({ where: { id: req.params.id, barId: req.barId! } });
  if (!payment) {
    return res.status(404).json({ message: "Pagamento nÃ£o encontrado para este restaurante." });
  }

  if (payment.status === "PAGO") {
    return res.json({ status: "PAGO", paidAt: payment.paidAt });
  }

  if (payment.externalId) {
    if (payment.provider === "ASAAS") {
      const data = await getAsaasPaymentStatus(req.barId!, payment.externalId);
      if (isAsaasPaid(data.status)) {
        const updated = await prisma.tablePayment.update({
          where: { id: payment.id },
          data: { status: "PAGO", paidAt: new Date() }
        });
        return res.json({ status: "PAGO", paidAt: updated.paidAt });
      }
    } else {
      const mpData = await getPaymentStatus(req.barId!, payment.externalId);
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
      const externalId = String(body.data.id);
      const payments = await prisma.tablePayment.findMany({
        where: { externalId, provider: "MERCADOPAGO", status: { not: "PAGO" } }
      });

      for (const payment of payments) {
        const mpData = await getPaymentStatus(payment.barId, externalId);
        if (mpData.status === "approved") {
          await prisma.tablePayment.update({
            where: { id: payment.id },
            data: { status: "PAGO", paidAt: new Date() }
          });
        }
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
      const payments = await prisma.tablePayment.findMany({
        where: { externalId: body.payment.id, provider: "ASAAS", status: { not: "PAGO" } }
      });

      for (const payment of payments) {
        const status = await getAsaasPaymentStatus(payment.barId, body.payment.id);
        if (isAsaasPaid(status.status)) {
          await prisma.tablePayment.update({
            where: { id: payment.id },
            data: { status: "PAGO", paidAt: new Date() }
          });
        }
      }
    }
  } catch (_) {}
  res.sendStatus(200);
});

export default router;
