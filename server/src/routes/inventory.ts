import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { addInventoryPurchase, adjustInventory } from "../services/inventory";
import { parseInvoiceText } from "../services/ai-parser";

const router = Router();
router.use(requireAuth, requireBar);

router.get("/entries", async (req, res) => {
  const supplyId = req.query.supplyId ? String(req.query.supplyId) : undefined;
  const entries = await prisma.inventoryEntry.findMany({
    where: {
      supply: { barId: req.barId! },
      ...(supplyId ? { supplyId } : {})
    },
    include: { supply: true },
    orderBy: { purchasedAt: "desc" }
  });
  res.json(entries);
});

router.post("/entries", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    supplyId: z.string(),
    quantity: z.number().positive(),
    totalCost: z.number().positive(),
    purchasedAt: z.string(),
    supplierName: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  }).parse(req.body);

  const entry = await addInventoryPurchase({
    supplyId: data.supplyId,
    quantity: data.quantity,
    totalCost: data.totalCost,
    purchasedAt: new Date(data.purchasedAt),
    supplierName: data.supplierName || undefined,
    notes: data.notes || undefined,
    expectedBarId: req.barId!
  });
  res.status(201).json(entry);
});

router.post("/adjustments", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    supplyId: z.string(),
    quantity: z.number(),
    reason: z.string().min(3)
  }).parse(req.body);

  const movement = await adjustInventory({ ...data, expectedBarId: req.barId! });
  res.status(201).json(movement);
});

router.get("/movements", async (req, res) => {
  const supplyId = req.query.supplyId ? String(req.query.supplyId) : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      supply: { barId: req.barId! },
      ...(supplyId ? { supplyId } : {}),
      ...(type ? { type: type as never } : {})
    },
    include: { supply: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(movements);
});

// ── AI Invoice Import ─────────────────────────────────────────────────────────
router.post("/import-invoice", requireRole("ADMIN"), async (req, res) => {
  const { text, supplierName, dryRun } = z.object({
    text: z.string().min(10, "Texto da nota fiscal muito curto"),
    supplierName: z.string().optional(),
    dryRun: z.boolean().default(false)
  }).parse(req.body);

  const parsed = await parseInvoiceText(text);

  if (dryRun) {
    return res.json({ items: parsed, saved: 0, created: 0, skipped: 0 });
  }

  const purchasedAt = new Date();
  let created = 0;
  let saved = 0;
  let skipped = 0;
  const results: Array<{ product: string; action: "purchase_added" | "supply_created_and_purchased" | "skipped"; supplyId: string }> = [];

  for (const item of parsed) {
    if (item.quantity <= 0 || item.unit_cost < 0) {
      skipped++;
      continue;
    }

    let supply = await prisma.supply.findFirst({
      where: {
        barId: req.barId!,
        name: { equals: item.product, mode: "insensitive" }
      }
    });

    if (!supply) {
      supply = await prisma.supply.create({
        data: {
          barId: req.barId!,
          name: item.product,
          unit: "UNIDADE",
          averageCost: item.unit_cost,
          stockCurrent: 0,
          stockMinimum: 0,
          active: true
        }
      });
      created++;
    }

    const totalCost = item.total_cost ?? item.quantity * item.unit_cost;

    await addInventoryPurchase({
      supplyId: supply.id,
      quantity: item.quantity,
      totalCost,
      purchasedAt,
      supplierName: supplierName || undefined,
      notes: "Importado via leitura de nota fiscal por IA",
      expectedBarId: req.barId!
    });

    saved++;
    results.push({
      product: item.product,
      action: created > 0 && results.length === created - 1 ? "supply_created_and_purchased" : "purchase_added",
      supplyId: supply.id
    });
  }

  res.status(201).json({ items: parsed, results, created, saved, skipped });
});

export default router;
