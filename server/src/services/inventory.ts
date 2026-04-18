import { prisma } from "../lib/prisma";
import { toMoney } from "../lib/utils";

export async function addInventoryPurchase(input: {
  supplyId: string;
  quantity: number;
  totalCost: number;
  purchasedAt: Date;
  supplierName?: string;
  notes?: string;
  expectedBarId?: string;
}) {
  if (input.quantity <= 0) {
    throw new Error("A quantidade da compra deve ser maior que zero.");
  }

  const supply = await prisma.supply.findUnique({ where: { id: input.supplyId } });
  if (!supply) {
    throw new Error("Insumo não encontrado.");
  }
  if (input.expectedBarId && supply.barId !== input.expectedBarId) {
    throw new Error("Insumo não pertence ao bar selecionado.");
  }

  const currentStock = Number(supply.stockCurrent);
  const currentCost = Number(supply.averageCost);
  const entryUnitCost = input.totalCost / input.quantity;
  const newStock = currentStock + input.quantity;
  const newAverageCost =
    newStock === 0 ? entryUnitCost : ((currentStock * currentCost) + input.totalCost) / newStock;

  const previousStock = currentStock;

  return prisma.$transaction(async (tx) => {
    const entry = await tx.inventoryEntry.create({
      data: {
        supplyId: input.supplyId,
        quantity: input.quantity,
        totalCost: input.totalCost,
        unitCost: entryUnitCost,
        purchasedAt: input.purchasedAt,
        supplierName: input.supplierName,
        notes: input.notes
      }
    });

    await tx.supply.update({
      where: { id: input.supplyId },
      data: {
        stockCurrent: newStock,
        averageCost: newAverageCost
      }
    });

    await tx.inventoryMovement.create({
      data: {
        supplyId: input.supplyId,
        type: "COMPRA",
        quantity: input.quantity,
        previousStock,
        currentStock: newStock,
        reason: `Compra registrada com custo total de R$ ${toMoney(input.totalCost).toFixed(2)}`,
        referenceId: entry.id
      }
    });

    return entry;
  });
}

export async function adjustInventory(input: {
  supplyId: string;
  quantity: number;
  reason: string;
  expectedBarId?: string;
}) {
  const supply = await prisma.supply.findUnique({ where: { id: input.supplyId } });
  if (!supply) {
    throw new Error("Insumo não encontrado.");
  }
  if (input.expectedBarId && supply.barId !== input.expectedBarId) {
    throw new Error("Insumo não pertence ao bar selecionado.");
  }

  const previousStock = Number(supply.stockCurrent);
  const newStock = previousStock + input.quantity;

  if (newStock < 0) {
    throw new Error("Ajuste resultaria em estoque negativo.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.supply.update({
      where: { id: input.supplyId },
      data: { stockCurrent: newStock }
    });

    return tx.inventoryMovement.create({
      data: {
        supplyId: input.supplyId,
        type: "AJUSTE",
        quantity: input.quantity,
        previousStock,
        currentStock: newStock,
        reason: input.reason
      }
    });
  });
}

export async function consumeInventoryForSale(items: Array<{ productId: string; quantity: number }>, referenceId: string) {
  const recipeByProduct = await prisma.productRecipe.findMany({
    where: { productId: { in: items.map((item) => item.productId) } },
    include: { supply: true }
  });

  const needs = new Map<string, { quantity: number; supplyName: string }>();

  for (const item of items) {
    const recipes = recipeByProduct.filter((recipe) => recipe.productId === item.productId);
    for (const recipe of recipes) {
      const totalQty = Number(recipe.quantityRequired) * item.quantity;
      const current = needs.get(recipe.supplyId);
      needs.set(recipe.supplyId, {
        quantity: (current?.quantity ?? 0) + totalQty,
        supplyName: recipe.supply.name
      });
    }
  }

  const supplyIds = Array.from(needs.keys());
  const supplies = await prisma.supply.findMany({ where: { id: { in: supplyIds } } });
  const supplyMap = new Map(supplies.map((item) => [item.id, item]));

  for (const [supplyId, need] of needs.entries()) {
    const supply = supplyMap.get(supplyId);
    if (!supply) {
      throw new Error(`Insumo não encontrado para baixa: ${need.supplyName}.`);
    }
    if (Number(supply.stockCurrent) < need.quantity) {
      throw new Error(`Estoque insuficiente para ${need.supplyName}.`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const [supplyId, need] of needs.entries()) {
      const supply = supplyMap.get(supplyId)!;
      const previousStock = Number(supply.stockCurrent);
      const newStock = previousStock - need.quantity;

      await tx.supply.update({
        where: { id: supplyId },
          data: { stockCurrent: newStock }
      });

      await tx.inventoryMovement.create({
        data: {
          supplyId,
          type: "BAIXA_VENDA",
          quantity: -need.quantity,
          previousStock,
          currentStock: newStock,
          reason: "Baixa automática por fechamento de mesa",
          referenceId
        }
      });
    }
  });

  return recipeByProduct;
}

export function calculateProductCost(recipeItems: Array<{ quantityRequired: number; supply: { averageCost: number } }>) {
  return recipeItems.reduce((total, item) => {
    return total + Number(item.quantityRequired) * Number(item.supply.averageCost);
  }, 0);
}
