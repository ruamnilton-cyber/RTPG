import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { addInventoryPurchase, adjustInventory } from "../services/inventory";

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

export default router;
