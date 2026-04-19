import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { addCashierMovement, closeCashierSession, getCashierSessions, openCashierSession } from "../services/platform";

const router = Router();
router.use(requireAuth, requireBar);

router.get("/sessions", async (req, res) => {
  const sessions = await getCashierSessions(req.barId!);
  res.json(sessions);
});

router.post("/sessions/open", requireRole("ADMIN", "GERENTE", "CAIXA", "FINANCEIRO"), async (req, res) => {
  const data = z.object({
    openingAmount: z.number().min(0),
    branchId: z.string().optional()
  }).parse(req.body);

  const session = await openCashierSession(req.barId!, {
    userId: req.user!.userId,
    userName: req.user!.name,
    branchId: data.branchId,
    openingAmount: data.openingAmount
  });

  res.status(201).json(session);
});

router.post("/sessions/:id/movements", requireRole("ADMIN", "GERENTE", "CAIXA", "FINANCEIRO"), async (req, res) => {
  const data = z.object({
    type: z.enum(["SANGRIA", "REFORCO", "AJUSTE"]),
    amount: z.number().positive(),
    reason: z.string().min(2)
  }).parse(req.body);

  const session = await addCashierMovement(req.barId!, req.params.id, data);
  res.json(session);
});

router.post("/sessions/:id/close", requireRole("ADMIN", "GERENTE", "CAIXA", "FINANCEIRO"), async (req, res) => {
  const data = z.object({
    closingAmount: z.number().min(0),
    justification: z.string().optional()
  }).parse(req.body);

  const session = await closeCashierSession(req.barId!, req.params.id, data);
  res.json(session);
});

export default router;
