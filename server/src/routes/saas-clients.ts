import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePlatformAdmin } from "../middleware/auth";
import { createSaasClient, deleteSaasClient, getOwnerManagerDashboard, getSaasClients, getSaasOverview, registerSaasPayment, updateSaasClient } from "../services/platform";

const router = Router();

router.use(requireAuth, requirePlatformAdmin);

router.get("/", async (req, res) => {
  const clients = await getSaasClients(req.query.search ? String(req.query.search) : undefined);
  res.json(clients);
});

router.get("/overview", async (_req, res) => {
  const overview = await getSaasOverview();
  res.json(overview);
});

router.get("/owner-dashboard", async (_req, res) => {
  const dashboard = await getOwnerManagerDashboard();
  res.json(dashboard);
});

router.post("/", async (req, res) => {
  const data = z.object({
    businessName: z.string().optional().default(""),
    contactName: z.string().optional().default(""),
    accessLogin: z.string().min(2),
    temporaryPassword: z.string().min(5).default("12345"),
    phone: z.string().default(""),
    email: z.string().default(""),
    cpfCnpj: z.string().default(""),
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

router.put("/:id", async (req, res) => {
  const data = z.object({
    businessName: z.string().min(2).optional(),
    contactName: z.string().min(2).optional(),
    accessLogin: z.string().min(2).optional(),
    temporaryPassword: z.string().min(5).optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    cpfCnpj: z.string().optional(),
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

router.post("/:id/payments", async (req, res) => {
  const data = z.object({
    amount: z.number().min(0),
    paidAt: z.string(),
    referenceMonth: z.string().default(""),
    notes: z.string().default("")
  }).parse(req.body);

  const client = await registerSaasPayment(req.params.id, data);
  res.json(client);
});

router.delete("/:id", async (req, res) => {
  const result = await deleteSaasClient(req.params.id);
  res.json(result);
});

export default router;
