import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAiPanelSetting, getOrganizationSetting, saveAiPanelSetting } from "../services/platform";

const router = Router();

router.get("/panel", requireAuth, async (_req, res) => {
  const [panel, organization] = await Promise.all([getAiPanelSetting(), getOrganizationSetting()]);
  res.json({
    panel,
    operations: {
      channelsEnabled: organization.channelsEnabled,
      whatsappAutomationEnabled: organization.whatsappAutomationEnabled,
      recommendedActions: [
        "Ativar canal de WhatsApp com handoff supervisionado",
        "Usar resumo automatico antes da transferencia para humano",
        "Ligar upsell automatico para combos e adicionais",
        "Monitorar taxa de abandono por canal"
      ],
      metrics: [
        { label: "Automacao estimada", value: `${panel.estimatedAutomationRate}%` },
        { label: "Limite de handoff", value: `${panel.handoffThreshold}%` },
        { label: "Canais ativos", value: String(panel.channels.length) }
      ]
    }
  });
});

router.put("/panel", requireAuth, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  const payload = z.object({
    assistantName: z.string().optional(),
    channels: z.array(z.enum(["WHATSAPP", "INSTAGRAM", "QR"])).optional(),
    autoReplyEnabled: z.boolean().optional(),
    audioTranscriptionEnabled: z.boolean().optional(),
    handoffThreshold: z.number().min(0).max(100).optional(),
    upsellEnabled: z.boolean().optional(),
    estimatedAutomationRate: z.number().min(0).max(100).optional(),
    handoffReasons: z.array(z.string()).optional()
  }).parse(req.body);

  const result = await saveAiPanelSetting(payload);
  res.json(result);
});

router.post("/handoff", requireAuth, async (req, res) => {
  const data = z.object({
    channel: z.enum(["WHATSAPP", "INSTAGRAM", "QR"]),
    customerName: z.string().min(2),
    reason: z.string().min(3),
    summary: z.string().min(3)
  }).parse(req.body);

  res.status(201).json({
    ok: true,
    handoffTicket: `handoff-${Date.now()}`,
    nextAction: "Encaminhar para operador humano com contexto completo",
    payload: data
  });
});

export default router;
