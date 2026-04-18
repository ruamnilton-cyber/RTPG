import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";

const router = Router();

function serializeTitle(item: {
  id: string;
  kind: "PAGAR" | "RECEBER";
  description: string;
  category: string;
  costCenter: string;
  amount: number;
  dueDate: Date;
  status: "PENDENTE" | "PAGO" | "VENCIDO" | "CANCELADO" | "PARCIAL";
  counterparty: string;
  notes: string;
  createdAt: Date;
}) {
  return {
    ...item,
    branchId: "branch-main",
    dueDate: item.dueDate.toISOString(),
    createdAt: item.createdAt.toISOString()
  };
}

router.get("/overview", requireAuth, requireBar, async (req, res) => {
  const [sales, expenses, payables, receivables] = await Promise.all([
    prisma.sale.findMany({ where: { barId: req.barId! } }),
    prisma.expense.findMany({ where: { barId: req.barId! }, include: { category: true } }),
    prisma.payable.findMany({ where: { barId: req.barId! }, orderBy: { dueDate: "asc" } }),
    prisma.receivable.findMany({ where: { barId: req.barId! }, orderBy: { dueDate: "asc" } })
  ]);

  const revenue = sales.reduce((sum, item) => sum + Number(item.finalAmount), 0);
  const cost = sales.reduce((sum, item) => sum + Number(item.costAmount), 0);
  const grossProfit = revenue - cost;
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const payableOpen = payables.filter((item) => item.status !== "PAGO" && item.status !== "CANCELADO").reduce((sum, item) => sum + Number(item.amount), 0);
  const receivableOpen = receivables.filter((item) => item.status !== "PAGO" && item.status !== "CANCELADO").reduce((sum, item) => sum + Number(item.amount), 0);
  const cashProjection = revenue + receivableOpen - expenseTotal - payableOpen;

  res.json({
    cards: [
      { label: "Receita no periodo", value: revenue },
      { label: "CMV estimado", value: cost },
      { label: "Despesas no periodo", value: expenseTotal },
      { label: "Fluxo projetado", value: cashProjection }
    ],
    statement: {
      revenue,
      cost,
      grossProfit,
      expenseTotal,
      payableOpen,
      receivableOpen,
      cashProjection
    },
    payables: payables.map((item) => serializeTitle({ ...item, kind: "PAGAR" })),
    receivables: receivables.map((item) => serializeTitle({ ...item, kind: "RECEBER" })),
    expensesByCategory: expenses.reduce<Record<string, number>>((acc, item) => {
      acc[item.category.name] = (acc[item.category.name] ?? 0) + Number(item.amount);
      return acc;
    }, {})
  });
});

router.get("/titles", requireAuth, requireBar, async (req, res) => {
  const [payables, receivables] = await Promise.all([
    prisma.payable.findMany({ where: { barId: req.barId! } }),
    prisma.receivable.findMany({ where: { barId: req.barId! } })
  ]);

  res.json([
    ...payables.map((item) => serializeTitle({ ...item, kind: "PAGAR" })),
    ...receivables.map((item) => serializeTitle({ ...item, kind: "RECEBER" }))
  ]);
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

  const commonData = {
    barId: req.barId!,
    description: data.description,
    category: data.category,
    costCenter: data.costCenter,
    amount: data.amount,
    dueDate: new Date(data.dueDate),
    status: data.status,
    counterparty: data.counterparty,
    notes: data.notes,
    ...(data.status === "PAGO" ? { paidAt: new Date() } : {})
  };

  if (data.kind === "PAGAR") {
    const title = await prisma.payable.create({ data: commonData });
    return res.status(201).json(serializeTitle({ ...title, kind: "PAGAR" }));
  }

  const title = await prisma.receivable.create({ data: commonData });
  return res.status(201).json(serializeTitle({ ...title, kind: "RECEBER" }));
});

router.patch("/titles/:id", requireRole("ADMIN", "GERENTE", "FINANCEIRO"), async (req, res) => {
  const data = z.object({
    status: z.enum(["PENDENTE", "PAGO", "VENCIDO", "CANCELADO", "PARCIAL"]).optional(),
    notes: z.string().optional(),
    dueDate: z.string().optional()
  }).parse(req.body);

  const payable = await prisma.payable.findFirst({ where: { id: req.params.id, barId: req.barId! } });
  if (payable) {
    const updated = await prisma.payable.update({
      where: { id: req.params.id },
      data: {
        ...(data.status ? { status: data.status, paidAt: data.status === "PAGO" ? new Date() : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {})
      }
    });
    return res.json(serializeTitle({ ...updated, kind: "PAGAR" }));
  }

  const receivable = await prisma.receivable.findFirst({ where: { id: req.params.id, barId: req.barId! } });
  if (!receivable) {
    throw new Error("Titulo financeiro nao encontrado.");
  }

  const updated = await prisma.receivable.update({
    where: { id: req.params.id },
    data: {
      ...(data.status ? { status: data.status, paidAt: data.status === "PAGO" ? new Date() : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {})
    }
  });

  res.json(serializeTitle({ ...updated, kind: "RECEBER" }));
});

export default router;
