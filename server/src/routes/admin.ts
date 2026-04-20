import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePlatformAdmin } from "../middleware/auth";
import { emailService } from "../services/email";

const router = Router();

router.use(requireAuth, requirePlatformAdmin);

router.post("/test-email", async (req, res) => {
  const data = z.object({
    email: z.string().email("Informe um e-mail valido."),
    name: z.string().min(2).optional()
  }).parse(req.body);

  if (!emailService.isConfigured()) {
    return res.status(503).json({
      ok: false,
      message: "SES SMTP nao configurado. Preencha SES_SMTP_USER, SES_SMTP_PASS e SES_FROM_EMAIL no .env."
    });
  }

  await emailService.sendWelcomeEmail({
    name: data.name ?? "Cliente RTPG",
    email: data.email,
    login: data.email,
    password: "senha-temporaria-teste",
    businessName: "Restaurante de teste"
  });

  res.json({ ok: true });
});

export default router;
