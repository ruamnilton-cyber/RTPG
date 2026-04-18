import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { getAgentCenter, getCommercialPlatformPositioning } from "../services/agents";
import { getAiPanelSetting, getOrganizationSetting, saveAiPanelSetting } from "../services/platform";
import { connectWhatsApp, disconnectWhatsApp, getWhatsAppStatus } from "../services/whatsapp";

const router = Router();

router.get("/panel", requireAuth, requireBar, async (req, res) => {
  const [panel, organization, agentCenter] = await Promise.all([
    getAiPanelSetting(req.barId!),
    getOrganizationSetting(),
    getAgentCenter(req.barId!)
  ]);
  res.json({
    panel,
    operations: {
      channelsEnabled: organization.channelsEnabled,
      whatsappAutomationEnabled: organization.whatsappAutomationEnabled,
      whatsapp: getWhatsAppStatus(req.barId!),
      recommendedActions: [
        "Conectar o WhatsApp do restaurante e validar o QR na propria tela",
        "Acompanhar handoffs para humano quando o bot nao entender a mensagem",
        "Usar o cardapio do restaurante como base da resposta automatica",
        "Confirmar manualmente tudo que envolver cobranca ou cancelamento"
      ],
      metrics: [
        { label: "Automacao estimada", value: `${panel.estimatedAutomationRate}%` },
        { label: "Limite de handoff", value: `${panel.handoffThreshold}%` },
        { label: "Canais ativos", value: String(panel.channels.length) },
        { label: "Status WhatsApp", value: getWhatsAppStatus(req.barId!).status }
      ]
    },
    agentCenter,
    platformPositioning: getCommercialPlatformPositioning()
  });
});

router.get("/agents", requireAuth, requireBar, async (req, res) => {
  res.json({
    agentCenter: await getAgentCenter(req.barId!),
    platformPositioning: getCommercialPlatformPositioning()
  });
});

router.put("/panel", requireAuth, requireBar, requireRole("ADMIN", "GERENTE"), async (req, res) => {
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

  const result = await saveAiPanelSetting(payload, req.barId!);
  res.json(result);
});

router.get("/whatsapp/status", requireAuth, requireBar, async (req, res) => {
  res.json(getWhatsAppStatus(req.barId!));
});

router.post("/whatsapp/connect", requireAuth, requireBar, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  const currentStatus = getWhatsAppStatus(req.barId!);
  const result = await connectWhatsApp(req.barId!, {
    forceFreshSession: currentStatus.status !== "CONECTADO"
  });
  res.json(result);
});

router.post("/whatsapp/disconnect", requireAuth, requireBar, requireRole("ADMIN", "GERENTE"), async (req, res) => {
  const result = await disconnectWhatsApp(req.barId!);
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
