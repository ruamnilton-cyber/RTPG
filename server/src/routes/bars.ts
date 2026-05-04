import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { getEffectiveBarIds } from "../middleware/bar";
import { logAction } from "../services/logging";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const ids = await getEffectiveBarIds(req.user!.userId, req.user!.role);
  const bars = await prisma.bar.findMany({
    where: { id: { in: ids }, active: true },
    orderBy: { name: "asc" }
  });
  res.json(bars);
});

router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const data = z
    .object({
      name: z.string().min(2),
      code: z
        .string()
        .min(2)
        .max(32)
        .regex(/^[a-z0-9-]+$/i, "Use apenas letras, números e hífen."),
      city: z.string().default("")
    })
    .parse(req.body);

  const bar = await prisma.$transaction(async (tx) => {
    const created = await tx.bar.create({
      data: {
        name: data.name.trim(),
        slug: data.code.trim().toLowerCase(),
        address: data.city.trim()
      }
    });

    await tx.userBar.upsert({
      where: { userId_barId: { userId: req.user!.userId, barId: created.id } },
      update: {},
      create: { userId: req.user!.userId, barId: created.id }
    });

    return created;
  });

  await logAction({
    userId: req.user!.userId,
    action: "CREATE",
    entityType: "Bar",
    entityId: bar.id,
    description: `Bar ${bar.name} criado`
  });

  res.status(201).json(bar);
});

router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const data = z
    .object({
      name: z.string().min(2).optional(),
      active: z.boolean().optional(),
      city: z.string().optional()
    })
    .parse(req.body);

  const isPlatformAdmin = req.user!.email === "admin@rtpg.local";
  const allowedBars = isPlatformAdmin ? [req.params.id] : await getEffectiveBarIds(req.user!.userId, req.user!.role, req.user!.email);
  if (!allowedBars.includes(req.params.id)) {
    return res.status(404).json({ message: "Restaurante nÃ£o encontrado para este usuÃ¡rio." });
  }

  const bar = await prisma.bar.update({
    where: { id: req.params.id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.city !== undefined ? { address: data.city.trim() } : {})
    }
  });

  await logAction({
    userId: req.user!.userId,
    action: "UPDATE",
    entityType: "Bar",
    entityId: bar.id,
    description: `Bar ${bar.name} atualizado`
  });

  res.json(bar);
});

export default router;
