import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { parseDateRange } from "../lib/utils";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";

const router = Router();
router.use(requireAuth, requireBar);

router.get("/dashboard", async (req, res) => {
  const today = parseDateRange("dia");
  const [salesToday, supplies, products, openTables, receivablesToday] = await Promise.all([
    prisma.sale.findMany({
      where: { barId: req.barId!, soldAt: { gte: today.start, lte: today.end } }
    }),
    prisma.supply.aggregate({ where: { barId: req.barId! }, _sum: { stockCurrent: true } }),
    prisma.product.count({ where: { barId: req.barId! } }),
    prisma.restaurantTable.count({ where: { barId: req.barId!, status: { not: "LIVRE" } } }),
    prisma.receivable.findMany({
      where: {
        barId: req.barId!,
        dueDate: { gte: today.start, lte: today.end },
        status: { not: "CANCELADO" },
        saleId: null
      }
    })
  ]);

  const manualRevenue = receivablesToday.reduce((sum, title) => sum + Number(title.amount), 0);

  const salesRevenue = salesToday.reduce((sum, sale) => sum + Number(sale.netAmount), 0);
  const productCost = salesToday.reduce((sum, sale) => sum + Number(sale.costAmount), 0);
  const revenueTotal = salesRevenue + manualRevenue;
  const grossProfit = revenueTotal - productCost;

  res.json({
    salesToday: revenueTotal,
    salesRevenue,
    manualRevenue,
    productCost,
    totalStock: Number(supplies._sum.stockCurrent ?? 0),
    totalProducts: products,
    openTables,
    estimatedGrossProfit: grossProfit
  });
});

router.get("/dre", async (req, res) => {
  const range = parseDateRange(
    req.query.period ? String(req.query.period) : undefined,
    req.query.start ? String(req.query.start) : undefined,
    req.query.end ? String(req.query.end) : undefined
  );

  const previousRange = (() => {
    const duration = range.end.getTime() - range.start.getTime();
    const previousEnd = new Date(range.start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    return { start: previousStart, end: previousEnd };
  })();

  const barWhere = { barId: req.barId! };

  const [sales, expenses, previousSales, previousExpenses, manualReceivables, previousManualReceivables] = await Promise.all([
    prisma.sale.findMany({
      where: { ...barWhere, soldAt: { gte: range.start, lte: range.end } },
      include: { items: { include: { product: true } } },
      orderBy: { soldAt: "desc" }
    }),
    prisma.expense.findMany({
      where: { ...barWhere, expenseDate: { gte: range.start, lte: range.end } },
      include: { category: true }
    }),
    prisma.sale.findMany({
      where: { ...barWhere, soldAt: { gte: previousRange.start, lte: previousRange.end } }
    }),
    prisma.expense.findMany({
      where: { ...barWhere, expenseDate: { gte: previousRange.start, lte: previousRange.end } },
      include: { category: true }
    }),
    prisma.receivable.findMany({
      where: {
        barId: req.barId!,
        dueDate: { gte: range.start, lte: range.end },
        status: { not: "CANCELADO" },
        saleId: null
      }
    }),
    prisma.receivable.findMany({
      where: {
        barId: req.barId!,
        dueDate: { gte: previousRange.start, lte: previousRange.end },
        status: { not: "CANCELADO" },
        saleId: null
      }
    })
  ]);

  const manualRevenue = manualReceivables.reduce((sum, title) => sum + Number(title.amount), 0);
  const previousManualRevenue = previousManualReceivables.reduce((sum, title) => sum + Number(title.amount), 0);

  const salesRevenue = sales.reduce((sum, sale) => sum + Number(sale.grossAmount), 0);
  const revenue = salesRevenue + manualRevenue;
  const deductions = sales.reduce((sum, sale) => sum + Number(sale.deductionsAmount), 0);
  const netRevenue = sales.reduce((sum, sale) => sum + Number(sale.netAmount), 0) + manualRevenue;
  const productCost = sales.reduce((sum, sale) => sum + Number(sale.costAmount), 0);
  const grossProfit = netRevenue - productCost;
  const operationalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const operationalResult = grossProfit - operationalExpenses;

  const perProductMap = new Map<string, {
    productId: string;
    productName: string;
    revenue: number;
    quantity: number;
    cost: number;
  }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const current = perProductMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.product.name,
        revenue: 0,
        quantity: 0,
        cost: 0
      };
      current.revenue += Number(item.totalPrice);
      current.quantity += item.quantity;
      current.cost += Number(item.costAmount);
      perProductMap.set(item.productId, current);
    }
  }

  const previousRevenue = previousSales.reduce((sum, sale) => sum + Number(sale.grossAmount), 0) + previousManualRevenue;
  const previousExpensesTotal = previousExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const expensesByGroup = {
    operacional: expenses.filter((item) => item.category.groupType === "OPERACIONAL").reduce((sum, item) => sum + Number(item.amount), 0),
    administrativa: expenses.filter((item) => item.category.groupType === "ADMINISTRATIVA").reduce((sum, item) => sum + Number(item.amount), 0),
    comercial: expenses.filter((item) => item.category.groupType === "COMERCIAL").reduce((sum, item) => sum + Number(item.amount), 0),
    outras: expenses.filter((item) => item.category.groupType === "OUTRAS").reduce((sum, item) => sum + Number(item.amount), 0)
  };
  const ebitda = grossProfit - (expensesByGroup.operacional + expensesByGroup.administrativa + expensesByGroup.comercial);

  res.json({
    period: {
      type: req.query.period ? String(req.query.period) : "dia",
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      previousStart: previousRange.start.toISOString(),
      previousEnd: previousRange.end.toISOString()
    },
    productSummary: {
      totalProducts: perProductMap.size,
      totalRevenue: revenue,
      totalCost: productCost,
      totalGrossProfit: grossProfit
    },
    storeSummary: {
      revenue,
      salesRevenue,
      manualRevenue,
      deductions,
      netRevenue,
      productCost,
      grossProfit,
      operationalExpenses,
      operationalResult,
      previousRevenue,
      previousExpensesTotal,
      expensesByGroup,
      ebitda,
      lines: [
        { label: "Receita Bruta", value: salesRevenue, percentage: revenue ? (salesRevenue / revenue) * 100 : 0, kind: "main" },
        { label: "Receitas manuais/financeiras", value: manualRevenue, percentage: revenue ? (manualRevenue / revenue) * 100 : 0, kind: "detail" },
        { label: "Deduções", value: deductions, percentage: revenue ? (deductions / revenue) * 100 : 0, kind: "detail" },
        { label: "Receita Líquida", value: netRevenue, percentage: revenue ? (netRevenue / revenue) * 100 : 0, kind: "subtotal" },
        { label: "CMV / Custo dos produtos vendidos", value: productCost, percentage: revenue ? (productCost / revenue) * 100 : 0, kind: "detail" },
        { label: "Lucro Bruto", value: grossProfit, percentage: revenue ? (grossProfit / revenue) * 100 : 0, kind: "subtotal" },
        { label: "Despesas Operacionais", value: expensesByGroup.operacional, percentage: revenue ? (expensesByGroup.operacional / revenue) * 100 : 0, kind: "detail" },
        { label: "Despesas Administrativas", value: expensesByGroup.administrativa, percentage: revenue ? (expensesByGroup.administrativa / revenue) * 100 : 0, kind: "detail" },
        { label: "Despesas Comerciais", value: expensesByGroup.comercial, percentage: revenue ? (expensesByGroup.comercial / revenue) * 100 : 0, kind: "detail" },
        { label: "Outras Receitas/Despesas", value: expensesByGroup.outras, percentage: revenue ? (expensesByGroup.outras / revenue) * 100 : 0, kind: "detail" },
        { label: "EBITDA", value: ebitda, percentage: revenue ? (ebitda / revenue) * 100 : 0, kind: "subtotal" },
        { label: "Resultado Operacional", value: operationalResult, percentage: revenue ? (operationalResult / revenue) * 100 : 0, kind: "result" },
        { label: "Resultado Líquido", value: operationalResult, percentage: revenue ? (operationalResult / revenue) * 100 : 0, kind: "result" }
      ]
    },
    perProduct: Array.from(perProductMap.values()).map((item) => ({
      ...item,
      grossProfit: item.revenue - item.cost,
      grossMargin: item.revenue ? ((item.revenue - item.cost) / item.revenue) * 100 : 0,
      averageTicket: item.quantity ? item.revenue / item.quantity : 0
    })),
    expenses
  });
});

router.get("/expenses/categories", async (req, res) => {
  const categories = await prisma.expenseCategory.findMany({
    where: { barId: req.barId! },
    orderBy: { name: "asc" }
  });
  res.json(categories);
});

router.post("/expenses/categories", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    groupType: z.enum(["OPERACIONAL", "ADMINISTRATIVA", "COMERCIAL", "OUTRAS"]).default("OPERACIONAL")
  }).parse(req.body);
  const category = await prisma.expenseCategory.create({
    data: { ...data, barId: req.barId! }
  });
  res.status(201).json(category);
});

router.get("/expenses", async (req, res) => {
  const expenses = await prisma.expense.findMany({
    where: { barId: req.barId! },
    include: { category: true },
    orderBy: { expenseDate: "desc" }
  });
  res.json(expenses);
});

router.post("/expenses", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    categoryId: z.string(),
    description: z.string().min(2),
    amount: z.number().positive(),
    expenseDate: z.string(),
    notes: z.string().optional().nullable()
  }).parse(req.body);

  const category = await prisma.expenseCategory.findFirst({
    where: { id: data.categoryId, barId: req.barId! }
  });
  if (!category) {
    throw new Error("Categoria de despesa inválida para este bar.");
  }

  const expense = await prisma.$transaction(async (tx) => {
    const createdExpense = await tx.expense.create({
      data: {
        barId: req.barId!,
        categoryId: data.categoryId,
        description: data.description,
        amount: data.amount,
        expenseDate: new Date(data.expenseDate),
        notes: data.notes ?? null
      },
      include: { category: true }
    });

    await tx.payable.upsert({
      where: { expenseId: createdExpense.id },
      update: {
        description: createdExpense.description,
        category: createdExpense.category.name,
        amount: createdExpense.amount,
        dueDate: createdExpense.expenseDate,
        notes: createdExpense.notes ?? ""
      },
      create: {
        barId: req.barId!,
        expenseId: createdExpense.id,
        description: createdExpense.description,
        category: createdExpense.category.name,
        costCenter: createdExpense.category.groupType,
        amount: createdExpense.amount,
        dueDate: createdExpense.expenseDate,
        status: "PENDENTE",
        notes: createdExpense.notes ?? ""
      }
    });

    return createdExpense;
  });
  res.status(201).json(expense);
});

export default router;
