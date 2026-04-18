import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBar } from "../middleware/bar";
import { logAction } from "../services/logging";
import { calculateProductCost } from "../services/inventory";

const router = Router();
router.use(requireAuth, requireBar);

router.get("/categories", async (req, res) => {
  const categories = await prisma.productCategory.findMany({
    where: { barId: req.barId! },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  res.json(categories);
});

router.post("/categories", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({ name: z.string().min(2) }).parse(req.body);
  const maxSortOrder = await prisma.productCategory.aggregate({
    where: { barId: req.barId! },
    _max: { sortOrder: true }
  });
  const category = await prisma.productCategory.create({
    data: {
      name: data.name,
      barId: req.barId!,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1
    }
  });
  res.status(201).json(category);
});

router.put("/categories/:id", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({ name: z.string().min(2) }).parse(req.body);
  const category = await prisma.productCategory.update({
    where: { id: req.params.id, barId: req.barId! },
    data
  });
  res.json(category);
});

router.put("/categories/reorder", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({ orderedIds: z.array(z.string()) }).parse(req.body);
  await prisma.$transaction(
    data.orderedIds.map((id, index) =>
      prisma.productCategory.update({
        where: { id, barId: req.barId! },
        data: { sortOrder: index }
      })
    )
  );
  res.json({ ok: true });
});

router.delete("/categories/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.productCategory.delete({ where: { id: req.params.id, barId: req.barId! } });
  res.status(204).send();
});

router.get("/products", async (req, res) => {
  const search = String(req.query.search ?? "");
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
  const products = await prisma.product.findMany({
    where: {
      barId: req.barId!,
      ...(search ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status === "ativos" ? { active: true } : {}),
      ...(status === "inativos" ? { active: false } : {}),
      ...((minPrice !== undefined || maxPrice !== undefined)
        ? {
            salePrice: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {})
            }
          }
        : {})
    },
    include: {
      category: true,
      recipeItems: { include: { supply: true } }
    },
    orderBy: { name: "asc" }
  });

  res.json(products.map((product) => ({ ...product, recipeCost: calculateProductCost(product.recipeItems) })));
});

router.post("/products", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    categoryId: z.string().nullable().optional(),
    salePrice: z.number().nonnegative(),
    saleUnit: z.enum(["UNIDADE", "PORCAO", "COPO", "GARRAFA"]),
    active: z.boolean().default(true),
    description: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable()
  }).parse(req.body);

  if (data.categoryId) {
    const cat = await prisma.productCategory.findFirst({
      where: { id: data.categoryId, barId: req.barId! }
    });
    if (!cat) {
      throw new Error("Categoria não pertence a este bar.");
    }
  }

  const product = await prisma.product.create({
    data: {
      ...data,
      barId: req.barId!,
      categoryId: data.categoryId || null,
      salePrice: data.salePrice,
      imageUrl: data.imageUrl || null
    }
  });
  await logAction({ userId: req.user!.userId, action: "CREATE", entityType: "Product", entityId: product.id });
  res.status(201).json(product);
});

router.put("/products/:id", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    categoryId: z.string().nullable().optional(),
    salePrice: z.number().nonnegative(),
    saleUnit: z.enum(["UNIDADE", "PORCAO", "COPO", "GARRAFA"]),
    active: z.boolean(),
    description: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable()
  }).parse(req.body);

  if (data.categoryId) {
    const cat = await prisma.productCategory.findFirst({
      where: { id: data.categoryId, barId: req.barId! }
    });
    if (!cat) {
      throw new Error("Categoria não pertence a este bar.");
    }
  }

  const product = await prisma.product.update({
    where: { id: req.params.id, barId: req.barId! },
    data: {
      ...data,
      categoryId: data.categoryId || null,
      salePrice: data.salePrice,
      imageUrl: data.imageUrl || null
    }
  });
  await logAction({ userId: req.user!.userId, action: "UPDATE", entityType: "Product", entityId: product.id });
  res.json(product);
});

router.delete("/products/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id, barId: req.barId! } });
  await logAction({ userId: req.user!.userId, action: "DELETE", entityType: "Product", entityId: req.params.id });
  res.status(204).send();
});

router.post("/products/:id/duplicate", requireRole("ADMIN"), async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, barId: req.barId! },
    include: { recipeItems: true }
  });
  if (!product) {
    throw new Error("Produto não encontrado.");
  }

  const duplicated = await prisma.product.create({
    data: {
      barId: req.barId!,
      name: `${product.name} (cópia)`,
      categoryId: product.categoryId,
      salePrice: product.salePrice,
      saleUnit: product.saleUnit,
      active: product.active,
      description: product.description,
      imageUrl: product.imageUrl,
      recipeItems: {
        create: product.recipeItems.map((item) => ({
          supplyId: item.supplyId,
          quantityRequired: item.quantityRequired
        }))
      }
    }
  });

  res.status(201).json(duplicated);
});

router.post("/products/:id/toggle-active", requireRole("ADMIN"), async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.id, barId: req.barId! } });
  if (!product) {
    throw new Error("Produto não encontrado.");
  }

  const updated = await prisma.product.update({
    where: { id: req.params.id, barId: req.barId! },
    data: { active: !product.active }
  });

  res.json(updated);
});

router.get("/supplies", async (req, res) => {
  const search = String(req.query.search ?? "");
  const items = await prisma.supply.findMany({
    where: {
      barId: req.barId!,
      ...(search ? { name: { contains: search } } : {})
    },
    orderBy: { name: "asc" }
  });
  res.json(items);
});

router.post("/supplies", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    unit: z.enum(["UNIDADE", "KG", "G", "L", "ML"]),
    averageCost: z.number().nonnegative(),
    stockCurrent: z.number().nonnegative(),
    stockMinimum: z.number().nonnegative(),
    active: z.boolean().default(true)
  }).parse(req.body);

  const supply = await prisma.supply.create({
    data: {
      ...data,
      barId: req.barId!,
      averageCost: data.averageCost,
      stockCurrent: data.stockCurrent,
      stockMinimum: data.stockMinimum
    }
  });
  res.status(201).json(supply);
});

router.put("/supplies/:id", requireRole("ADMIN"), async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    unit: z.enum(["UNIDADE", "KG", "G", "L", "ML"]),
    averageCost: z.number().nonnegative(),
    stockCurrent: z.number().nonnegative(),
    stockMinimum: z.number().nonnegative(),
    active: z.boolean()
  }).parse(req.body);

  const supply = await prisma.supply.update({
    where: { id: req.params.id, barId: req.barId! },
    data: {
      ...data,
      averageCost: data.averageCost,
      stockCurrent: data.stockCurrent,
      stockMinimum: data.stockMinimum
    }
  });
  res.json(supply);
});

router.delete("/supplies/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.supply.delete({ where: { id: req.params.id, barId: req.barId! } });
  res.status(204).send();
});

router.get("/recipes", async (req, res) => {
  const recipes = await prisma.product.findMany({
    where: { barId: req.barId! },
    include: {
      recipeItems: { include: { supply: true } },
      category: true
    },
    orderBy: { name: "asc" }
  });
  res.json(recipes.map((product) => ({ ...product, recipeCost: calculateProductCost(product.recipeItems) })));
});

router.put("/products/:id/recipe", requireRole("ADMIN"), async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.id, barId: req.barId! } });
  if (!product) {
    throw new Error("Produto não encontrado.");
  }

  const data = z.object({
    items: z.array(z.object({ supplyId: z.string(), quantityRequired: z.number().positive() }))
  }).parse(req.body);

  const supplyIds = data.items.map((i) => i.supplyId);
  const supplies = await prisma.supply.findMany({ where: { id: { in: supplyIds }, barId: req.barId! } });
  if (supplies.length !== new Set(supplyIds).size) {
    throw new Error("Insumo inválido para este bar.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.productRecipe.deleteMany({ where: { productId: req.params.id } });
    if (data.items.length) {
      await tx.productRecipe.createMany({
        data: data.items.map((item) => ({
          productId: req.params.id,
          supplyId: item.supplyId,
          quantityRequired: item.quantityRequired
        }))
      });
    }
  });

  const recipe = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { recipeItems: { include: { supply: true } } }
  });

  res.json({ ...recipe, recipeCost: recipe ? calculateProductCost(recipe.recipeItems) : 0 });
});

export default router;
