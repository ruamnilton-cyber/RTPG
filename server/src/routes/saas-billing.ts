import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { requireAuth, requirePlatformAdmin } from "../middleware/auth";
import { getSaasClients } from "../services/platform";
import {
  checkAndConfirmPayment,
  getOrCreateSubscriptionCharge,
  handleWebhook,
  isPlatformAsaasConfigured
} from "../services/saas-billing";
import { getStoredSetting, setSecretSetting, setStoredSetting } from "../services/system-settings";

const router = Router();

const billingRateMap = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of billingRateMap) {
    if (entry.resetAt < now) billingRateMap.delete(key);
  }
}, 15 * 60 * 1000).unref();

function billingRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress ?? "unknown";
  const key = `billing:${ip}`;
  const now = Date.now();
  const entry = billingRateMap.get(key);
  if (!entry || entry.resetAt < now) {
    billingRateMap.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  entry.count++;
  if (entry.count > 30) {
    return res.status(429).json({ message: "Muitas requisiÃ§Ãµes. Aguarde um momento." });
  }
  next();
}

// Platform admin: configure platform-level Asaas key
router.put("/platform-config", requireAuth, requirePlatformAdmin, async (req, res) => {
  const { apiKey, sandbox, webhookToken } = z.object({
    apiKey: z.string().min(10),
    sandbox: z.boolean().default(true),
    webhookToken: z.string().min(8).optional()
  }).parse(req.body);
  // API key e webhook token sÃ£o secrets â€” armazenados criptografados
  await setSecretSetting("platform_asaas_api_key", apiKey);
  await setStoredSetting("platform_asaas_sandbox", sandbox ? "true" : "false");
  if (webhookToken) {
    await setSecretSetting("platform_asaas_webhook_token", webhookToken);
  }
  res.json({ ok: true });
});

// Restaurant owner: get billing status and PIX QR code if blocked
router.get("/checkout", requireAuth, billingRateLimit, async (req, res) => {
  const userId = req.user!.userId;
  const clients = await getSaasClients();
  const client = clients.find(c => c.linkedUserId === userId);

  if (!client) {
    return res.json({ accessStatus: "LIBERADO", blocked: false });
  }

  if (client.accessStatus !== "BLOQUEADO") {
    return res.json({ accessStatus: client.accessStatus, blocked: false });
  }

  const configured = await isPlatformAsaasConfigured();
  if (!configured) {
    return res.json({ accessStatus: "BLOQUEADO", blocked: true, configMissing: true });
  }

  const charge = await getOrCreateSubscriptionCharge(client.id);
  // Never expose the full charge object â€” only what the frontend needs
  return res.json({
    accessStatus: "BLOQUEADO",
    blocked: true,
    businessName: client.businessName,
    planName: client.planName,
    monthlyFee: client.monthlyFee,
    externalId: charge.externalId,
    pixQrCode: charge.pixQrCode,
    pixQrCodeBase64: charge.pixQrCodeBase64,
    amount: charge.amount
  });
});

// Restaurant owner: poll whether a payment was received
router.get("/check/:externalId", requireAuth, billingRateLimit, async (req, res) => {
  const userId = req.user!.userId;
  const clients = await getSaasClients();
  const client = clients.find(c => c.linkedUserId === userId);
  if (!client) return res.json({ paid: false });

  // Validate the externalId belongs to this client's pending charge
  const pendingKey = `platform_asaas_pending_${client.id}`;
  const pending = await getStoredSetting<{ externalId: string } | null>(pendingKey, null);
  if (!pending || pending.externalId !== req.params.externalId) {
    return res.json({ paid: false });
  }

  const paid = await checkAndConfirmPayment(req.params.externalId, client.id);
  res.json({ paid });
});

// Asaas webhook â€” validates token before processing
router.post("/webhook", async (req, res) => {
  // Responde 200 imediatamente para o Asaas nÃ£o retentar; erros sÃ£o logados internamente
  res.sendStatus(200);
  try {
    const expectedToken = await getStoredSetting<string | null>("platform_asaas_webhook_token", null);
    if (expectedToken) {
      const receivedToken = req.headers["asaastoken"] as string | undefined;
      if (!receivedToken || receivedToken !== expectedToken) {
        console.warn("[webhook] Token invÃ¡lido recebido. IP:", req.socket?.remoteAddress);
        return;
      }
    }
    await handleWebhook(req.body as {
      payment?: { id?: string; status?: string; externalReference?: string; value?: number }
    });
  } catch (err) {
    console.error("[webhook] Erro ao processar webhook:", err);
  }
});

export default router;
