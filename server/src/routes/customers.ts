import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { createCustomer, deleteCustomer, getCustomerInsights, getCustomers, updateCustomer } from "../services/platform";

const router = Router();
router.use(requireAuth, requireBar);

router.get("/", async (req, res) => {
  const customers = await getCustomers(req.barId!, req.query.search ? String(req.query.search) : undefined);
  res.json(customers);
});

router.get("/insights", async (req, res) => {
  const insights = await getCustomerInsights(req.barId!);
  res.json(insights);
});

router.post("/", requireRole("ADMIN", "GERENTE", "CAIXA", "GARCOM", "OPERADOR"), async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    phone: z.string().default(""),
    email: z.string().default(""),
    instagram: z.string().default(""),
    city: z.string().default(""),
    birthDate: z.string().default(""),
    preferredChannel: z.enum(["WHATSAPP", "INSTAGRAM", "QR", "BALCAO", "SALAO", "DELIVERY"]).default("WHATSAPP"),
    origin: z.enum(["WHATSAPP", "INSTAGRAM", "QR", "BALCAO", "SALAO", "DELIVERY", "MANUAL"]).default("MANUAL"),
    status: z.enum(["ATIVO", "INATIVO", "VIP"]).default("ATIVO"),
    averageTicket: z.number().min(0).default(0),
    visitCount: z.number().int().min(0).default(0),
    lastOrderAt: z.string().default(""),
    notes: z.string().default(""),
    tags: z.array(z.string()).default([])
  }).parse(req.body);

  const customer = await createCustomer(req.barId!, data);
  res.status(201).json(customer);
});

router.put("/:id", requireRole("ADMIN", "GERENTE", "CAIXA", "GARCOM", "OPERADOR"), async (req, res) => {
  const data = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    instagram: z.string().optional(),
    city: z.string().optional(),
    birthDate: z.string().optional(),
    preferredChannel: z.enum(["WHATSAPP", "INSTAGRAM", "QR", "BALCAO", "SALAO", "DELIVERY"]).optional(),
    origin: z.enum(["WHATSAPP", "INSTAGRAM", "QR", "BALCAO", "SALAO", "DELIVERY", "MANUAL"]).optional(),
    status: z.enum(["ATIVO", "INATIVO", "VIP"]).optional(),
    averageTicket: z.number().min(0).optional(),
    visitCount: z.number().int().min(0).optional(),
    lastOrderAt: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).parse(req.body);

  const customer = await updateCustomer(req.barId!, req.params.id, data);
  res.json(customer);
});

router.delete("/:id", requireRole("ADMIN", "GERENTE"), async (req, res) => {
  const result = await deleteCustomer(req.barId!, req.params.id);
  res.json(result);
});

export default router;
