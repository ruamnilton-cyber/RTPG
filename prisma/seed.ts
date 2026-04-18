import crypto from "node:crypto";
import "../server/src/env";
import { prisma } from "../server/src/lib/prisma";
import { hashPassword } from "../server/src/lib/auth";

async function main() {
  // Bar principal (multi-tenant base)
  const bar = await prisma.bar.upsert({
    where: { slug: "principal" },
    update: {},
    create: {
      name: "Bar principal",
      slug: "principal"
    }
  });

  // Usuário admin
  const adminEmail = "admin@rtpg.local";
  const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminExists) {
    const admin = await prisma.user.create({
      data: {
        name: "Administrador RTPG",
        email: adminEmail,
        role: "ADMIN",
        passwordHash: await hashPassword("admin123")
      }
    });
    await prisma.userBar.upsert({
      where: { userId_barId: { userId: admin.id, barId: bar.id } },
      update: {},
      create: { userId: admin.id, barId: bar.id }
    });
  }

  // Categorias de produtos
  const categories = ["Lanches", "Bebidas", "Porções"];
  for (const name of categories) {
    await prisma.productCategory.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  // Categorias de despesas
  const expenseCategories = ["Funcionário", "Água", "Luz", "Aluguel", "Internet", "Impostos", "Outras despesas"];
  for (const name of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  // Mesas
  for (let index = 1; index <= 12; index++) {
    await prisma.restaurantTable.upsert({
      where: { number: index },
      update: {},
      create: {
        number: index,
        name: `Mesa ${index}`,
        qrCodeToken: crypto.randomUUID()
      }
    });
  }

  // Insumos
  const supplyPao = await prisma.supply.upsert({
    where: { name: "Pão brioche" },
    update: {},
    create: { name: "Pão brioche", unit: "UNIDADE", averageCost: 1.5, stockCurrent: 80, stockMinimum: 20 }
  });

  const supplyCarne = await prisma.supply.upsert({
    where: { name: "Hambúrguer bovino" },
    update: {},
    create: { name: "Hambúrguer bovino", unit: "UNIDADE", averageCost: 4.8, stockCurrent: 60, stockMinimum: 15 }
  });

  const supplyQueijo = await prisma.supply.upsert({
    where: { name: "Queijo cheddar" },
    update: {},
    create: { name: "Queijo cheddar", unit: "UNIDADE", averageCost: 1.2, stockCurrent: 100, stockMinimum: 20 }
  });

  // Produtos
  const catLanches = await prisma.productCategory.findFirst({ where: { name: "Lanches" } });
  const catBebidas = await prisma.productCategory.findFirst({ where: { name: "Bebidas" } });

  const burger = await prisma.product.upsert({
    where: { id: "prod-burger-classico" },
    update: {},
    create: {
      id: "prod-burger-classico",
      name: "Hambúrguer Clássico",
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
    update: {},
    create: {
      id: "prod-refrigerante",
      name: "Refrigerante lata",
      categoryId: catBebidas?.id,
      salePrice: 8,
      saleUnit: "UNIDADE",
      description: "Lata 350ml"
    }
  });

  console.log("Seed concluído.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
