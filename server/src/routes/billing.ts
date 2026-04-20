import { Router } from "express";
import { handleSaasAsaasWebhook } from "../services/platform";
import { isPlatformAsaasWebhookAuthorized } from "../services/platform-asaas";

const router = Router();

router.post("/webhook/asaas", async (req, res) => {
  if (!isPlatformAsaasWebhookAuthorized(req.headers["asaas-access-token"])) {
    return res.status(401).json({ message: "Webhook Asaas nao autorizado." });
  }

  try {
    const body = req.body as { event?: string; payment?: { id?: string; status?: string } };
    if (body.payment?.id) {
      await handleSaasAsaasWebhook(body.payment.id, body.payment.status);
    }
  } catch (err) {
    console.error("[billing] Falha ao processar webhook Asaas da plataforma.", err);
  }

  res.sendStatus(200);
});

export default router;
