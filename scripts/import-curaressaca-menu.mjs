import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./data-dir.mjs";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolveDatabaseUrl(process.cwd());
}

const prisma = new PrismaClient();

const userConfig = {
  name: "curaressaca",
  email: "curaressaca@rtpg.local",
  password: "cura12345",
  role: "ADMIN"
};

const categories = [
  "Petiscos",
  "Caldos",
  "Escondidinhos",
  "Pratos para Duas Pessoas",
  "Prato Individual",
  "Sobremesas"
];

const products = [
  { id: "cura-petisco-001", name: "Batata Frita Classica", price: 39.99, category: "Petiscos" },
  { id: "cura-petisco-002", name: "Batata com Cheddar e Bacon", price: 55.0, category: "Petiscos" },
  { id: "cura-petisco-003", name: "Batata com Cheddar e Costela Desfiada", price: 69.0, category: "Petiscos" },
  { id: "cura-petisco-004", name: "Batata com Queijo Calabresa e Oregano", price: 55.0, category: "Petiscos" },
  { id: "cura-petisco-005", name: "Batata com Cream Cheese Calabresa e Alho Crocante", price: 55.0, category: "Petiscos" },
  { id: "cura-petisco-006", name: "Frango a Passarinho", price: 39.0, category: "Petiscos" },
  { id: "cura-petisco-007", name: "Isca de Frango Crocante", price: 59.0, category: "Petiscos" },
  { id: "cura-petisco-008", name: "Isca de Frango a Parmegiana", price: 69.0, category: "Petiscos" },
  { id: "cura-petisco-009", name: "Isca de Frango com Cream Cheese e Alho", price: 69.0, category: "Petiscos" },
  { id: "cura-petisco-010", name: "Isca de Frango com Cheddar e Bacon", price: 69.0, category: "Petiscos" },
  { id: "cura-petisco-011", name: "Isca de Frango ao Molho de Queijo e Oregano", price: 69.0, category: "Petiscos" },
  { id: "cura-petisco-012", name: "File Aperitivo", price: 110.0, category: "Petiscos" },
  { id: "cura-petisco-013", name: "File Aperitivo com Molho de Queijo", price: 120.0, category: "Petiscos" },
  { id: "cura-petisco-014", name: "Mix Aperitivo da Casa", price: 99.0, category: "Petiscos" },
  { id: "cura-petisco-015", name: "Bolinho de Costela (4 unidades)", price: 39.0, category: "Petiscos" },
  { id: "cura-petisco-016", name: "Bolinho de Cupim (4 unidades)", price: 39.0, category: "Petiscos" },
  { id: "cura-petisco-017", name: "Bolinho de Bacalhau (8 unidades)", price: 39.0, category: "Petiscos" },
  { id: "cura-petisco-018", name: "Os Queridinhos do Mar", price: 130.0, category: "Petiscos" },
  { id: "cura-petisco-019", name: "Isca de Peixe Crocante", price: 89.0, category: "Petiscos" },
  { id: "cura-petisco-020", name: "Camarao Crocante", price: 130.0, category: "Petiscos" },
  { id: "cura-petisco-021", name: "Camarao ao Alho e Oleo", price: 130.0, category: "Petiscos" },
  { id: "cura-petisco-022", name: "Lula a Milanesa", price: 79.0, category: "Petiscos" },
  { id: "cura-petisco-023", name: "Sardinha Frita (6 unidades)", price: 39.0, category: "Petiscos" },
  { id: "cura-petisco-024", name: "Manjubinha Frita", price: 49.0, category: "Petiscos" },
  { id: "cura-petisco-025", name: "Vinagrete de Polvo", price: 69.0, category: "Petiscos" },
  { id: "cura-petisco-026", name: "Mexilhao ao Vinagrete (quente ou frio)", price: 49.0, category: "Petiscos" },
  { id: "cura-petisco-027", name: "Casquinha de Siri", price: 29.0, category: "Petiscos" },
  { id: "cura-petisco-028", name: "Casquinha de Frutos do Mar", price: 29.0, category: "Petiscos" },
  { id: "cura-petisco-029", name: "Pastel Chiclete de Camarao (6 unidades)", price: 42.0, category: "Petiscos" },
  { id: "cura-petisco-030", name: "Pastel Camarao na Moranga (6 unidades)", price: 42.0, category: "Petiscos" },
  { id: "cura-petisco-031", name: "Pastel Camarao (6 unidades)", price: 42.0, category: "Petiscos" },
  { id: "cura-petisco-032", name: "Pastel Camarao com Catupiry (6 unidades)", price: 42.0, category: "Petiscos" },
  { id: "cura-petisco-033", name: "Pastel Frutos do Mar (6 unidades)", price: 42.0, category: "Petiscos" },
  { id: "cura-petisco-034", name: "Pastel Carne (6 unidades)", price: 42.0, category: "Petiscos" },
  { id: "cura-petisco-035", name: "Pastel Queijo (6 unidades)", price: 42.0, category: "Petiscos" },
  { id: "cura-petisco-036", name: "Pastel Costela com Queijo (6 unidades)", price: 42.0, category: "Petiscos" },

  { id: "cura-caldo-001", name: "Caldo de Frutos do Mar", price: 49.0, category: "Caldos" },
  { id: "cura-caldo-002", name: "Caldo de Camarao", price: 49.0, category: "Caldos" },
  { id: "cura-caldo-003", name: "Caldo de Feijao", price: 25.0, category: "Caldos" },

  { id: "cura-escondido-001", name: "Escondidinho de Carne", price: 35.0, category: "Escondidinhos" },
  { id: "cura-escondido-002", name: "Escondidinho de Camarao", price: 45.0, category: "Escondidinhos" },
  { id: "cura-escondido-003", name: "Escondidinho de Frutos do Mar", price: 45.0, category: "Escondidinhos" },

  { id: "cura-dupla-001", name: "Bobo de Camarao", price: 199.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-002", name: "Camarao ao Catupiry", price: 199.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-003", name: "Camarao Crocante ao Molho de Queijo", price: 209.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-004", name: "Camarao Internacional", price: 199.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-005", name: "Camarao no Cocos", price: 199.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-006", name: "Camarao na Moranga", price: 215.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-007", name: "Camarao Tropical", price: 199.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-008", name: "Chiclete de Camarao", price: 199.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-009", name: "Paella a Moda do Cura", price: 299.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-010", name: "File de Peixe ao Molho de Camarao (2 pessoas)", price: 189.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-011", name: "File de Peixe ao Molho Branco com Camarao", price: 189.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-012", name: "File de Peixe a Parmegiana", price: 189.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-013", name: "Risoto de Camarao", price: 189.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-014", name: "Risoto de Frutos do Mar", price: 189.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-015", name: "Peixe Completo (Corvina Dourado ou Anchova)", price: 199.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-016", name: "Peixe Completo (Robalo ou Pescada Amarela)", price: 230.0, category: "Pratos para Duas Pessoas" },
  { id: "cura-dupla-017", name: "Churrasco Misto", price: 220.0, category: "Pratos para Duas Pessoas" },

  { id: "cura-ind-001", name: "Bife com Fritas ou Pure", price: 45.0, category: "Prato Individual" },
  { id: "cura-ind-002", name: "Frango com Fritas ou Pure", price: 39.0, category: "Prato Individual" },
  { id: "cura-ind-003", name: "File de Peixe ao Molho de Camarao (individual)", price: 59.0, category: "Prato Individual" },
  { id: "cura-ind-004", name: "Espaguete a Bolonhesa", price: 39.0, category: "Prato Individual" },
  { id: "cura-ind-005", name: "Espaguete ao Molho Branco com Camarao Crocante", price: 55.0, category: "Prato Individual" },
  { id: "cura-ind-006", name: "Espaguete Internacional", price: 55.0, category: "Prato Individual" },
  { id: "cura-ind-007", name: "Espaguete ao Sugo com Camarao", price: 55.0, category: "Prato Individual" },
  { id: "cura-ind-008", name: "Espaguete ao Mar", price: 55.0, category: "Prato Individual" },

  { id: "cura-sob-001", name: "Big Avalanche de Sorvete", price: 45.0, category: "Sobremesas" },
  { id: "cura-sob-002", name: "Avalanche de Sorvete", price: 39.0, category: "Sobremesas" },
  { id: "cura-sob-003", name: "Taca de Sorvete (3 bolas)", price: 18.0, category: "Sobremesas" },
  { id: "cura-sob-004", name: "Brownie Artesanal com Sorvete", price: 35.0, category: "Sobremesas" },
  { id: "cura-sob-005", name: "Petit Gateau com Sorvete", price: 35.0, category: "Sobremesas" },
  { id: "cura-sob-006", name: "Pudim de Leite Condensado com Calda", price: 15.0, category: "Sobremesas" },
  { id: "cura-sob-007", name: "Crumble de Banana com Doce de Leite e Sorvete", price: 35.0, category: "Sobremesas" }
];

const supplies = [
  { name: "Batata", unit: "KG", averageCost: 8.5, stockCurrent: 120, stockMinimum: 35 },
  { name: "Cheddar", unit: "KG", averageCost: 34, stockCurrent: 18, stockMinimum: 5 },
  { name: "Mussarela", unit: "KG", averageCost: 39, stockCurrent: 16, stockMinimum: 5 },
  { name: "Bacon", unit: "KG", averageCost: 33, stockCurrent: 14, stockMinimum: 4 },
  { name: "Costela bovina desfiada", unit: "KG", averageCost: 42, stockCurrent: 18, stockMinimum: 5 },
  { name: "Cupim", unit: "KG", averageCost: 41, stockCurrent: 15, stockMinimum: 4 },
  { name: "Calabresa", unit: "KG", averageCost: 24, stockCurrent: 20, stockMinimum: 6 },
  { name: "Cream cheese", unit: "KG", averageCost: 29, stockCurrent: 10, stockMinimum: 3 },
  { name: "Catupiry", unit: "KG", averageCost: 32, stockCurrent: 9, stockMinimum: 3 },
  { name: "Frango file", unit: "KG", averageCost: 18, stockCurrent: 30, stockMinimum: 8 },
  { name: "Carne bovina", unit: "KG", averageCost: 38, stockCurrent: 28, stockMinimum: 8 },
  { name: "Camarao", unit: "KG", averageCost: 68, stockCurrent: 24, stockMinimum: 8 },
  { name: "File de peixe", unit: "KG", averageCost: 46, stockCurrent: 22, stockMinimum: 7 },
  { name: "Lula", unit: "KG", averageCost: 35, stockCurrent: 12, stockMinimum: 4 },
  { name: "Polvo", unit: "KG", averageCost: 74, stockCurrent: 8, stockMinimum: 3 },
  { name: "Mexilhao", unit: "KG", averageCost: 24, stockCurrent: 12, stockMinimum: 4 },
  { name: "Siri", unit: "KG", averageCost: 39, stockCurrent: 10, stockMinimum: 3 },
  { name: "Sardinha", unit: "KG", averageCost: 19, stockCurrent: 16, stockMinimum: 5 },
  { name: "Manjubinha", unit: "KG", averageCost: 17, stockCurrent: 12, stockMinimum: 4 },
  { name: "Bacalhau", unit: "KG", averageCost: 72, stockCurrent: 8, stockMinimum: 3 },
  { name: "Arroz", unit: "KG", averageCost: 6.5, stockCurrent: 60, stockMinimum: 15 },
  { name: "Feijao", unit: "KG", averageCost: 8.2, stockCurrent: 40, stockMinimum: 10 },
  { name: "Farinha de mandioca", unit: "KG", averageCost: 7.5, stockCurrent: 30, stockMinimum: 8 },
  { name: "Mandioca aipim", unit: "KG", averageCost: 7.8, stockCurrent: 45, stockMinimum: 12 },
  { name: "Moranga", unit: "KG", averageCost: 6.8, stockCurrent: 24, stockMinimum: 8 },
  { name: "Massa espaguete", unit: "KG", averageCost: 8.9, stockCurrent: 35, stockMinimum: 10 },
  { name: "Molho de tomate", unit: "L", averageCost: 12.5, stockCurrent: 18, stockMinimum: 5 },
  { name: "Leite de coco", unit: "L", averageCost: 14.8, stockCurrent: 16, stockMinimum: 5 },
  { name: "Azeite de dende", unit: "L", averageCost: 22, stockCurrent: 10, stockMinimum: 3 },
  { name: "Oleo vegetal", unit: "L", averageCost: 7.2, stockCurrent: 25, stockMinimum: 8 },
  { name: "Oregano", unit: "G", averageCost: 0.06, stockCurrent: 1500, stockMinimum: 300 },
  { name: "Alho", unit: "KG", averageCost: 18, stockCurrent: 10, stockMinimum: 3 },
  { name: "Sorvete", unit: "KG", averageCost: 26, stockCurrent: 30, stockMinimum: 10 },
  { name: "Chocolate cobertura", unit: "KG", averageCost: 24, stockCurrent: 15, stockMinimum: 5 },
  { name: "Doce de leite", unit: "KG", averageCost: 18, stockCurrent: 14, stockMinimum: 4 },
  { name: "Banana", unit: "KG", averageCost: 6.2, stockCurrent: 20, stockMinimum: 6 },
  { name: "Leite condensado", unit: "KG", averageCost: 11.5, stockCurrent: 12, stockMinimum: 4 }
];

async function main() {
  const passwordHash = await bcrypt.hash(userConfig.password, 10);
  const user = await prisma.user.upsert({
    where: { email: userConfig.email },
    update: {
      name: userConfig.name,
      role: userConfig.role,
      active: true,
      passwordHash
    },
    create: {
      name: userConfig.name,
      email: userConfig.email,
      role: userConfig.role,
      active: true,
      passwordHash
    }
  });

  for (const categoryName of categories) {
    await prisma.productCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName }
    });
  }

  const categoryRows = await prisma.productCategory.findMany({
    where: { name: { in: categories } }
  });
  const categoryMap = new Map(categoryRows.map((row) => [row.name, row.id]));

  for (const item of products) {
    const categoryId = categoryMap.get(item.category);
    await prisma.product.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        categoryId,
        salePrice: item.price,
        saleUnit: "PORCAO",
        active: true
      },
      create: {
        id: item.id,
        name: item.name,
        categoryId,
        salePrice: item.price,
        saleUnit: "PORCAO",
        active: true
      }
    });
  }

  for (const supply of supplies) {
    await prisma.supply.upsert({
      where: { name: supply.name },
      update: {
        unit: supply.unit,
        averageCost: supply.averageCost,
        stockCurrent: supply.stockCurrent,
        stockMinimum: supply.stockMinimum,
        active: true
      },
      create: {
        name: supply.name,
        unit: supply.unit,
        averageCost: supply.averageCost,
        stockCurrent: supply.stockCurrent,
        stockMinimum: supply.stockMinimum,
        active: true
      }
    });
  }

  console.log("Usuario criado/atualizado:", user.email);
  console.log("Produtos importados:", products.length);
  console.log("Insumos importados:", supplies.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
