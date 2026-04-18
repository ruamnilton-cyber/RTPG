import crypto from "node:crypto";
import "../server/src/env";
import { prisma } from "../server/src/lib/prisma";
import { hashPassword } from "../server/src/lib/auth";

async function main() {
  const bar = await prisma.bar.upsert({
    where: { code: "principal" },
    update: {},
    create: {
      name: "Bar principal",
      code: "principal",
      city: ""
    }
  });

  const adminEmail = "admin@rtpg.local";
  const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!adminExists) {
    await prisma.user.create({
      data: {
        name: "Administrador RTPG",
        email: adminEmail,
        role: "ADMIN",
        passwordHash: await hashPassword("admin123")
      }
    });
  }

  const categories = ["Lanches", "Bebidas", "Porções"];
  for (const name of categories) {
    await prisma.productCategory.upsert({
      where: { barId_name: { barId: bar.id, name } },
      update: {},
      create: { name, barId: bar.id }
    });
  }

  const expenseCategories = ["Funcionário", "Água", "Luz", "Aluguel", "Internet", "Impostos", "Outras despesas"];
  for (const name of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { barId_name: { barId: bar.id, name } },
      update: {},
      create: { name, barId: bar.id }
    });
  }

  for (let index = 1; index <= 12; index++) {
    await prisma.restaurantTable.upsert({
      where: { barId_number: { barId: bar.id, number: index } },
      update: {},
      create: {
        number: index,
        name: `Mesa ${index}`,
        barId: bar.id,
        qrCodeToken: crypto.randomUUID()
      }
    });
  }

  const supplyPao = await prisma.supply.upsert({
    where: { barId_name: { barId: bar.id, name: "Pão brioche" } },
    update: {},
    create: {
      name: "Pão brioche",
      barId: bar.id,
      unit: "UNIDADE",
      averageCost: 1.5,
      stockCurrent: 80,
      stockMinimum: 20
    }
  });

  const supplyCarne = await prisma.supply.upsert({
    where: { barId_name: { barId: bar.id, name: "Hambúrguer bovino" } },
    update: {},
    create: {
      name: "Hambúrguer bovino",
      barId: bar.id,
      unit: "UNIDADE",
      averageCost: 4.8,
      stockCurrent: 60,
      stockMinimum: 15
    }
  });

  const supplyQueijo = await prisma.supply.upsert({
    where: { barId_name: { barId: bar.id, name: "Queijo cheddar" } },
    update: {},
    create: {
      name: "Queijo cheddar",
      barId: bar.id,
      unit: "UNIDADE",
      averageCost: 1.2,
      stockCurrent: 100,
      stockMinimum: 20
    }
  });

  const catLanches = await prisma.productCategory.findFirst({ where: { barId: bar.id, name: "Lanches" } });
  const catBebidas = await prisma.productCategory.findFirst({ where: { barId: bar.id, name: "Bebidas" } });

  const burger = await prisma.product.upsert({
    where: { id: "prod-burger-classico" },
    update: { barId: bar.id },
    create: {
      id: "prod-burger-classico",
      name: "Hambúrguer Clássico",
      barId: bar.id,
      categoryId: catLanches?.id,
      salePrice: 28,
      saleUnit: "UNIDADE",
      description: "Pão brioche, hambúrguer e cheddar."
    }
  });

  await prisma.productRecipe.upsert({
    where: { productId_supplyId: { productId: burger.id, supplyId: supplyPao.id } },
    update: { quantityRequired: 1 },
    create: { productId: burger.id, supplyId: supplyPao.id, quantityRequired: 1 }
  });

  await prisma.productRecipe.upsert({
    where: { productId_supplyId: { productId: burger.id, supplyId: supplyCarne.id } },
    update: { quantityRequired: 1 },
    create: { productId: burger.id, supplyId: supplyCarne.id, quantityRequired: 1 }
  });

  await prisma.productRecipe.upsert({
    where: { productId_supplyId: { productId: burger.id, supplyId: supplyQueijo.id } },
    update: { quantityRequired: 2 },
    create: { productId: burger.id, supplyId: supplyQueijo.id, quantityRequired: 2 }
  });

  await prisma.product.upsert({
    where: { id: "prod-refrigerante" },
    update: { barId: bar.id },
    create: {
      id: "prod-refrigerante",
      name: "Refrigerante lata",
      barId: bar.id,
      categoryId: catBebidas?.id,
      salePrice: 8,
      saleUnit: "UNIDADE",
      description: "Lata 350ml"
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
