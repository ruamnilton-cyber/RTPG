import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { createSaasClient, deleteSaasClient, getOwnerManagerDashboard, getSaasClients, getSaasOverview, registerSaasPayment, updateSaasClient } from "../services/platform";
import { createSaasClientCharge, isAsaasConfigured } from "../services/asaas";
import { sendAccessCredentialsEmail, isEmailConfigured } from "../services/email";

const router = Router();

router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const clients = await getSaasClients(req.query.search ? String(req.query.search) : undefined);
  res.json(clients);
});

router.get("/overview", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const overview = await getSaasOverview();
  res.json(overview);
});

router.get("/owner-dashboard", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const dashboard = await getOwnerManagerDashboard();
  res.json(dashboard);
});

router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    businessName: z.string().optional().default(""),
    contactName: z.string().optional().default(""),
    accessLogin: z.string().min(2),
    temporaryPassword: z.string().min(5).default("12345"),
    phone: z.string().default(""),
    email: z.string().default(""),
    planName: z.string().default("Plano Base"),
    monthlyFee: z.number().min(0).default(0),
    billingDay: z.number().int().min(1).max(31).default(10),
    nextDueDate: z.string(),
    lastPaymentDate: z.string().default(""),
    status: z.enum(["ATIVO", "TRIAL", "ATRASADO", "SUSPENSO", "CANCELADO"]).default("TRIAL"),
    accessStatus: z.enum(["LIBERADO", "BLOQUEIO_AVISO", "BLOQUEADO"]).default("LIBERADO"),
    notes: z.string().default(""),
    payments: z.array(z.object({
      id: z.string(),
      amount: z.number(),
      paidAt: z.string(),
      referenceMonth: z.string().default(""),
      notes: z.string().default("")
    })).default([])
  }).parse(req.body);

  const client = await createSaasClient(data);
  res.status(201).json(client);
});

router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    businessName: z.string().min(2).optional(),
    contactName: z.string().min(2).optional(),
    accessLogin: z.string().min(2).optional(),
    temporaryPassword: z.string().min(5).optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    planName: z.string().optional(),
    monthlyFee: z.number().min(0).optional(),
    billingDay: z.number().int().min(1).max(31).optional(),
    nextDueDate: z.string().optional(),
    lastPaymentDate: z.string().optional(),
    status: z.enum(["ATIVO", "TRIAL", "ATRASADO", "SUSPENSO", "CANCELADO"]).optional(),
    accessStatus: z.enum(["LIBERADO", "BLOQUEIO_AVISO", "BLOQUEADO"]).optional(),
    notes: z.string().optional()
  }).parse(req.body);

  const client = await updateSaasClient(req.params.id, data);
  res.json(client);
});

router.post("/:id/payments", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    amount: z.number().min(0),
    paidAt: z.string(),
    referenceMonth: z.string().default(""),
    notes: z.string().default("")
  }).parse(req.body);

  const client = await registerSaasPayment(req.params.id, data);
  res.json(client);
});

router.post("/:id/charge", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const configured = await isAsaasConfigured();
  if (!configured) {
    return res.status(400).json({ error: "Asaas não configurado. Adicione a API Key em Configurações → Pagamentos." });
  }

  const clients = await getSaasClients();
  const client = clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: "Cliente não encontrado." });
  if (!client.monthlyFee || client.monthlyFee <= 0) {
    return res.status(400).json({ error: "Mensalidade não definida para este cliente." });
  }

  const { dueDays, description, cpfCnpj } = z.object({
    dueDays: z.number().int().min(1).max(30).default(3),
    description: z.string().optional(),
    cpfCnpj: z.string().optional()
  }).parse(req.body);

  const charge = await createSaasClientCharge({
    clientName: client.contactName || client.businessName || "Cliente",
    cpfCnpj,
    email: client.email || undefined,
    phone: client.phone || undefined,
    amount: client.monthlyFee,
    description: description ?? `Mensalidade ${client.planName} — ${client.businessName || client.accessLogin}`,
    dueDays
  });

  res.json(charge);
});

router.post("/:id/send-credentials", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const configured = await isEmailConfigured();
  if (!configured) {
    return res.status(400).json({ error: "E-mail não configurado. Acesse Configurações → E-mail e SMTP." });
  }

  const clients = await getSaasClients();
  const client = clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: "Cliente não encontrado." });
  if (!client.email) return res.status(400).json({ error: "Este cliente não tem e-mail cadastrado." });

  const { senha } = z.object({ senha: z.string().min(1).default("12345") }).parse(req.body);

  await sendAccessCredentialsEmail({
    to: client.email,
    nome: client.contactName || client.businessName || "Cliente",
    restaurante: client.businessName || client.accessLogin,
    login: client.accessLogin,
    senha,
    planName: client.planName || "Plano Base"
  });

  res.json({ ok: true });
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const result = await deleteSaasClient(req.params.id);
  res.json(result);
});

export default router;
