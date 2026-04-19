import { prisma } from "../lib/prisma";

type Confidence = "alta" | "media" | "baixa";
type ValidationStatus = "ok" | "pendente_revisao";

export type ParsedMenuAddon = {
  nome: string;
  preco: number | null;
};

export type ParsedMenuVariation = {
  nome: string;
  preco: number | null;
};

export type ParsedMenuItem = {
  nome: string;
  descricao: string | null;
  preco: number | null;
  preco_promocional: number | null;
  categoria: string;
  variacoes: ParsedMenuVariation[];
  sabores: string[];
  adicionais: ParsedMenuAddon[];
  observacoes: string | null;
  disponibilidade: "disponivel" | "indisponivel" | "temporario" | "pendente_revisao";
  status_validacao: ValidationStatus;
  confianca_extracao: Confidence;
  linha_original: string;
};

export type ParsedMenuResult = {
  importacao_id: string;
  origem: "cardapio_colado";
  moeda: "BRL";
  categorias: Array<{ nome: string; itens: ParsedMenuItem[] }>;
  itens_pendentes_revisao: Array<{ linha_original: string; motivo: string }>;
  erros_encontrados: string[];
  resumo_importacao: {
    categorias_encontradas: number;
    itens_encontrados: number;
    itens_criados: number;
    itens_atualizados: number;
    itens_pendentes_revisao: number;
    erros: number;
  };
};

type ImportAction = "criado" | "atualizado" | "pendente_revisao";

const CATEGORY_HINTS = [
  "hamburguer",
  "hamburgueres",
  "pizza",
  "pizzas",
  "bebida",
  "bebidas",
  "sobremesa",
  "sobremesas",
  "combo",
  "combos",
  "petisco",
  "petiscos",
  "porcao",
  "porcoes",
  "caldo",
  "caldos",
  "prato",
  "pratos",
  "executivo",
  "executivos",
  "entrada",
  "entradas",
  "promocao",
  "promocoes"
];

const VARIATION_WORDS = ["p", "pequena", "pequeno", "m", "media", "medio", "g", "grande", "tradicional", "especial", "300ml", "500ml", "600ml", "1l", "2l"];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanLine(line: string) {
  return line
    .replace(/[•●▪]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

function parseMoney(value: string) {
  const cleaned = value
    .replace(/r\$/i, "")
    .replace(/\+/g, "")
    .trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function findMoneyTokens(line: string) {
  const matches = [...line.matchAll(/(?:r\$\s*)?\+?\d{1,4}(?:[.,]\d{2})?/gi)];
  return matches
    .map((match) => ({ raw: match[0], value: parseMoney(match[0]), index: match.index ?? 0 }))
    .filter((match): match is { raw: string; value: number; index: number } => match.value !== null);
}

function stripPriceAtEnd(line: string) {
  return line
    .replace(/\s*(?:-|–)?\s*(?:r\$\s*)?\d{1,4}(?:[.,]\d{2})?\s*$/i, "")
    .trim();
}

function isCategoryLine(line: string) {
  const normalized = normalizeText(line.replace(/[^\p{L}\p{N}\s]/gu, " "));
  if (!normalized || findMoneyTokens(line).length > 0) return false;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  const upperRatio = line.replace(/[^A-Za-zÀ-ÿ]/g, "").split("").filter((char) => char === char.toUpperCase()).length / Math.max(line.replace(/[^A-Za-zÀ-ÿ]/g, "").length, 1);
  return upperRatio > 0.75 || words.some((word) => CATEGORY_HINTS.includes(word));
}

function isAddonLine(line: string) {
  const normalized = normalizeText(line);
  return normalized.includes("adicional") || normalized.includes("adicionais") || normalized.includes("acrescimo") || normalized.includes("borda recheada");
}

function parseAddons(line: string): ParsedMenuAddon[] {
  const withoutPrefix = line.replace(/adicionais?:?/i, "").replace(/acrescimos?:?/i, "");
  return withoutPrefix
    .split(/,|;/)
    .map((part) => cleanLine(part))
    .filter(Boolean)
    .map((part) => {
      const price = findMoneyTokens(part).at(-1)?.value ?? null;
      const name = stripPriceAtEnd(part).replace(/\+$/, "").trim();
      return name ? { nome: name, preco: price } : null;
    })
    .filter((item): item is ParsedMenuAddon => Boolean(item));
}

function parseFlavors(line: string) {
  return line
    .replace(/sabores?:?/i, "")
    .split(/,|;/)
    .map((part) => cleanLine(part))
    .filter(Boolean);
}

function parseVariationsFromSingleLine(line: string) {
  const variations: ParsedMenuVariation[] = [];
  const regex = /\b(pequena|pequeno|m[eé]dia|m[eé]dio|grande|tradicional|especial|p|m|g|300ml|500ml|600ml|1l|2l)\b\s*(?:-|:)?\s*(?:r\$\s*)?(\d{1,4}(?:[.,]\d{2})?)/gi;
  for (const match of line.matchAll(regex)) {
    const price = parseMoney(match[2] ?? "");
    if (price !== null) {
      variations.push({ nome: titleCase(match[1] ?? ""), preco: price });
    }
  }
  return variations;
}

function isVariationOnlyLine(line: string) {
  const normalized = normalizeText(line);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.length <= 3 && tokens.some((token) => VARIATION_WORDS.includes(token)) && findMoneyTokens(line).length > 0;
}

function detectAvailability(line: string): ParsedMenuItem["disponibilidade"] {
  const normalized = normalizeText(line);
  if (normalized.includes("indisponivel") || normalized.includes("esgotado")) return "indisponivel";
  if (normalized.includes("somente hoje") || normalized.includes("tempo limitado") || normalized.includes("por tempo limitado")) return "temporario";
  return "disponivel";
}

function parsePromo(line: string) {
  const normalized = normalizeText(line);
  const values = findMoneyTokens(line).map((item) => item.value);
  if ((normalized.includes("promocao") || normalized.includes("oferta") || normalized.includes(" de ") || normalized.includes("por")) && values.length >= 2) {
    return { preco: values[0] ?? null, preco_promocional: values[1] ?? null };
  }
  return { preco: values.at(-1) ?? null, preco_promocional: null };
}

function buildItem(line: string, category: string): ParsedMenuItem {
  const original = line;
  const promo = parsePromo(line);
  const variations = parseVariationsFromSingleLine(line);
  const baseWithoutPrice = stripPriceAtEnd(line.replace(/promo[cç][aã]o|oferta/gi, "").trim());
  const parts = baseWithoutPrice.split(/\s+-\s+/).map((part) => cleanLine(part)).filter(Boolean);
  const name = parts[0] ?? baseWithoutPrice;
  const description = parts.slice(1).join(" - ") || null;
  const availability = detectAvailability(line);
  const hasClearPrice = promo.preco !== null || variations.length > 0;
  const status: ValidationStatus = name && hasClearPrice ? "ok" : "pendente_revisao";
  const confidence: Confidence = name && promo.preco !== null ? "alta" : name && hasClearPrice ? "media" : "baixa";

  return {
    nome: name || "pendente_revisao",
    descricao: description,
    preco: variations.length ? null : promo.preco,
    preco_promocional: promo.preco_promocional,
    categoria: category,
    variacoes: variations,
    sabores: [],
    adicionais: [],
    observacoes: null,
    disponibilidade: availability,
    status_validacao: status,
    confianca_extracao: confidence,
    linha_original: original
  };
}

function addItem(resultMap: Map<string, ParsedMenuItem[]>, item: ParsedMenuItem) {
  const current = resultMap.get(item.categoria) ?? [];
  current.push(item);
  resultMap.set(item.categoria, current);
}

export function parseMenuText(rawText: string): ParsedMenuResult {
  const importId = `imp_${Date.now()}`;
  const errors: string[] = [];
  const pending: Array<{ linha_original: string; motivo: string }> = [];
  const categories = new Map<string, ParsedMenuItem[]>();
  let currentCategory = "Geral";
  let lastItem: ParsedMenuItem | null = null;

  const lines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  if (!lines.length) {
    errors.push("Nenhum texto de cardapio foi informado.");
  }

  for (const line of lines) {
    try {
      if (isCategoryLine(line)) {
        currentCategory = titleCase(line.replace(/[:\-]+$/g, ""));
        if (!categories.has(currentCategory)) categories.set(currentCategory, []);
        lastItem = null;
        continue;
      }

      if (isAddonLine(line)) {
        const addons = parseAddons(line);
        if (lastItem) {
          lastItem.adicionais.push(...addons);
        } else {
          pending.push({ linha_original: line, motivo: "Adicionais encontrados sem produto claro para vincular." });
        }
        continue;
      }

      if (normalizeText(line).startsWith("sabores")) {
        const flavors = parseFlavors(line);
        if (lastItem) {
          lastItem.sabores.push(...flavors);
        } else {
          pending.push({ linha_original: line, motivo: "Sabores encontrados sem produto claro para vincular." });
        }
        continue;
      }

      if (isVariationOnlyLine(line) && lastItem) {
        const money = findMoneyTokens(line).at(-1)?.value ?? null;
        const variationName = stripPriceAtEnd(line);
        lastItem.variacoes.push({ nome: titleCase(variationName), preco: money });
        lastItem.preco = null;
        lastItem.status_validacao = "ok";
        lastItem.confianca_extracao = lastItem.nome ? "alta" : "media";
        continue;
      }

      const item = buildItem(line, currentCategory);
      addItem(categories, item);
      lastItem = item;
      if (item.status_validacao !== "ok") {
        pending.push({ linha_original: line, motivo: "Nao foi possivel identificar nome e preco com seguranca." });
      }
      if (currentCategory === "Geral") {
        pending.push({ linha_original: line, motivo: "Categoria nao identificada explicitamente; item colocado em Geral." });
      }
    } catch (error) {
      errors.push(`Erro ao interpretar linha "${line}": ${String(error)}`);
    }
  }

  const grouped = Array.from(categories.entries())
    .filter(([, items]) => items.length > 0)
    .map(([nome, itens]) => ({ nome, itens }));

  const itemCount = grouped.reduce((sum, category) => sum + category.itens.length, 0);

  return {
    importacao_id: importId,
    origem: "cardapio_colado",
    moeda: "BRL",
    categorias: grouped,
    itens_pendentes_revisao: pending,
    erros_encontrados: errors,
    resumo_importacao: {
      categorias_encontradas: grouped.length,
      itens_encontrados: itemCount,
      itens_criados: 0,
      itens_atualizados: 0,
      itens_pendentes_revisao: pending.length,
      erros: errors.length
    }
  };
}

function normalizedSimilarity(a: string, b: string) {
  const tokensA = new Set(normalizeText(a).split(/\s+/).filter(Boolean));
  const tokensB = new Set(normalizeText(b).split(/\s+/).filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  return intersection / Math.max(tokensA.size, tokensB.size);
}

function buildDescription(item: ParsedMenuItem) {
  const details = [item.descricao].filter(Boolean) as string[];
  if (item.variacoes.length) {
    details.push(`Variacoes importadas: ${item.variacoes.map((variation) => `${variation.nome}${variation.preco !== null ? ` ${variation.preco}` : ""}`).join(", ")}`);
  }
  if (item.sabores.length) {
    details.push(`Sabores importados: ${item.sabores.join(", ")}`);
  }
  if (item.adicionais.length) {
    details.push(`Adicionais importados: ${item.adicionais.map((addon) => `${addon.nome}${addon.preco !== null ? ` +${addon.preco}` : ""}`).join(", ")}`);
  }
  if (item.observacoes) details.push(item.observacoes);
  return details.join("\n") || null;
}

function getImportableProducts(item: ParsedMenuItem) {
  if (item.variacoes.length) {
    return item.variacoes
      .filter((variation) => variation.preco !== null)
      .map((variation) => ({
        name: `${item.nome} - ${variation.nome}`,
        price: variation.preco as number,
        description: buildDescription({
          ...item,
          observacoes: [item.observacoes, `Item importado como variacao: ${variation.nome}`].filter(Boolean).join("\n") || null
        })
      }));
  }

  const price = item.preco_promocional !== null ? item.preco_promocional : item.preco;
  if (price === null) return [];
  return [{
    name: item.nome,
    price,
    description: buildDescription(item)
  }];
}

export async function applyMenuImport(barId: string, parsed: ParsedMenuResult, userId?: string | null) {
  let created = 0;
  let updated = 0;
  let review = 0;

  await prisma.$transaction(async (tx) => {
    for (const category of parsed.categorias) {
      let dbCategory = await tx.productCategory.findFirst({
        where: { barId, name: { equals: category.nome } }
      });

      if (!dbCategory) {
        const maxSortOrder = await tx.productCategory.aggregate({
          where: { barId },
          _max: { sortOrder: true }
        });
        dbCategory = await tx.productCategory.create({
          data: {
            barId,
            name: category.nome,
            sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1
          }
        });
      }

      const existingProducts = await tx.product.findMany({
        where: { barId, categoryId: dbCategory.id }
      });

      for (const item of category.itens) {
        const importableProducts = getImportableProducts(item);
        if (item.status_validacao !== "ok" || !importableProducts.length) {
          review += 1;
          continue;
        }

        for (const importableProduct of importableProducts) {
          const existing = existingProducts.find((product) => {
            const exact = normalizeText(product.name) === normalizeText(importableProduct.name);
            return exact || normalizedSimilarity(product.name, importableProduct.name) >= 0.78;
          });

          const data = {
            name: importableProduct.name,
            categoryId: dbCategory.id,
            salePrice: importableProduct.price,
            saleUnit: "UNIDADE" as const,
            active: item.disponibilidade !== "indisponivel",
            description: importableProduct.description
          };

          if (existing) {
            await tx.product.update({
              where: { id: existing.id },
              data
            });
            updated += 1;
          } else {
            await tx.product.create({
              data: {
                ...data,
                barId
              }
            });
            created += 1;
          }
        }
      }
    }

    await tx.actionLog.create({
      data: {
        userId: userId ?? null,
        action: "IMPORT",
        entityType: "Menu",
        description: `Importacao de cardapio ${parsed.importacao_id}: ${created} criado(s), ${updated} atualizado(s), ${review} pendente(s).`
      }
    });
  });

  return {
    ...parsed,
    resumo_importacao: {
      ...parsed.resumo_importacao,
      itens_criados: created,
      itens_atualizados: updated,
      itens_pendentes_revisao: parsed.resumo_importacao.itens_pendentes_revisao + review,
      erros: parsed.erros_encontrados.length
    },
    importacao: {
      acoes: [
        { tipo: "criado" as ImportAction, quantidade: created },
        { tipo: "atualizado" as ImportAction, quantidade: updated },
        { tipo: "pendente_revisao" as ImportAction, quantidade: review }
      ]
    }
  };
}
