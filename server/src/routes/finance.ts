import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { createFinanceTitle, getFinanceOverview, getFinanceTitles, updateFinanceTitle } from "../services/platform";

const router = Router();

router.get("/overview", requireAuth, requireBar, async (req, res) => {
  const result = await getFinanceOverview(
    req.query.period ? String(req.query.period) : undefined,
    req.query.start ? String(req.query.start) : undefined,
    req.query.end ? String(req.query.end) : undefined,
    req.barId
  );
  res.json(result);
});

router.get("/titles", requireAuth, async (_req, res) => {
  const titles = await getFinanceTitles();
  res.json(titles);
});

router.use(requireAuth, requireBar);

router.post("/titles", requireRole("ADMIN", "GERENTE", "FINANCEIRO"), async (req, res) => {
  const data = z.object({
    kind: z.enum(["PAGAR", "RECEBER"]),
    description: z.string().min(2),
    category: z.string().min(2),
    branchId: z.string().optional(),
    costCenter: z.string().default("OPERACAO"),
    amount: z.number().positive(),
    dueDate: z.string(),
    status: z.enum(["PENDENTE", "PAGO", "VENCIDO", "CANCELADO", "PARCIAL"]).default("PENDENTE"),
    counterparty: z.string().default(""),
    notes: z.string().default("")
  }).parse(req.body);

  const title = await createFinanceTitle({
    ...data,
    branchId: data.branchId ?? req.barId!
  });
  res.status(201).json(title);
});

router.patch("/titles/:id", requireRole("ADMIN", "GERENTE", "FINANCEIRO"), async (req, res) => {
  const data = z.object({
    status: z.enum(["PENDENTE", "PAGO", "VENCIDO", "CANCELADO", "PARCIAL"]).optional(),
    notes: z.string().optional(),
    dueDate: z.string().optional()
  }).parse(req.body);

  const title = await updateFinanceTitle(req.params.id, data);
  res.json(title);
});

export default router;
