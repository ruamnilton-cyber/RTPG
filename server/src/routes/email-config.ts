import { Router } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import { requireAuth, requireRole } from "../middleware/auth";
import { getStoredSetting, setStoredSetting } from "../services/system-settings";

const router = Router();

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
};

router.get("/config", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const config = await getStoredSetting<SmtpConfig | null>("smtp_config", null);
  res.json({
    configured: Boolean(config?.host && config?.user && config?.pass),
    host: config?.host ?? "",
    port: config?.port ?? 587,
    secure: config?.secure ?? false,
    user: config?.user ?? "",
    fromName: config?.fromName ?? "RTPG Gestão",
    passHint: config?.pass ? `...${config.pass.slice(-4)}` : null
  });
});

router.put("/config", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    host: z.string().min(3),
    port: z.number().int().min(1).max(65535).default(587),
    secure: z.boolean().default(false),
    user: z.string().email(),
    pass: z.string().min(4),
    fromName: z.string().default("RTPG Gestão")
  }).parse(req.body);

  await setStoredSetting("smtp_config", data as unknown as string);
  res.json({ ok: true });
});

router.delete("/config", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  await setStoredSetting("smtp_config", null as unknown as string);
  res.json({ ok: true });
});

router.post("/test", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { to } = z.object({ to: z.string().email() }).parse(req.body);
  const config = await getStoredSetting<SmtpConfig | null>("smtp_config", null);
  if (!config?.host || !config?.user || !config?.pass) {
    return res.status(400).json({ error: "SMTP não configurado." });
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass }
  });

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.user}>`,
    to,
    subject: "Teste de e-mail — RTPG Gestão",
    html: "<p>E-mail de teste enviado com sucesso pelo RTPG Gestão.</p>"
  });

  res.json({ ok: true });
});

export default router;
