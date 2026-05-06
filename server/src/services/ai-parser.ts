import OpenAI from "openai";
import { z } from "zod";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada. Adicione a chave no arquivo .env.");
  }
  return new OpenAI({ apiKey });
}

function getModel() {
  return process.env.OPENAI_MENU_IMPORT_MODEL ?? "gpt-4.1-mini";
}

function getVisionModel() {
  return process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
}

export const menuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  price: z.number().nonnegative()
});

export const invoiceItemSchema = z.object({
  product: z.string().min(1),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative(),
  total_cost: z.number().nonnegative().optional()
});

export type MenuItem = z.infer<typeof menuItemSchema>;
export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1] : raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)?.[0] ?? raw;
  return JSON.parse(jsonStr.trim());
}

async function callOpenAI(systemPrompt: string, userText: string): Promise<string> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  });

  return completion.choices[0]?.message?.content?.trim() ?? "{}";
}

async function callOpenAIList(systemPrompt: string, userText: string): Promise<unknown> {
  const client = getClient();
  // Use a wrapper so json_object mode works (it requires an object at top level)
  const completion = await client.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{"items":[]}';
  const parsed = JSON.parse(raw) as { items?: unknown[] } | unknown[];
  return Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] }).items ?? [];
}

export async function parseMenuImage(base64: string, mimeType: string): Promise<MenuItem[]> {
  const client = getClient();

  const prompt = `Você é um parser de cardápio. Analise a imagem e extraia todos os pratos/bebidas visíveis.
Retorne SOMENTE um JSON válido com a chave "items", sem texto adicional:
{"items":[{"name":"Nome do Prato","description":"Descrição breve","price":00.00}]}
Regras:
- name: nome normalizado (Title Case)
- description: descrição do prato ou string vazia ""
- price: preço como número decimal (ex: 39.90). Se não houver preço visível, use 0
- Não inclua categorias, apenas pratos/bebidas reais
- Leia todo o texto visível na imagem, incluindo preços`;

  const completion = await client.chat.completions.create({
    model: getVisionModel(),
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } }
        ]
      }
    ]
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{"items":[]}';

  let result: unknown[];
  try {
    const parsed = extractJson(raw) as { items?: unknown[] } | unknown[];
    result = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] }).items ?? [];
  } catch {
    console.error("[AI] Resposta bruta da visão:", raw);
    throw new Error("A IA não conseguiu estruturar os itens da imagem. Tente uma foto mais nítida ou use o modo texto.");
  }

  const items = z.array(menuItemSchema).parse(result);
  return items.map((item) => ({ ...item, name: normalizeName(item.name) }));
}

export async function parseMenuText(rawText: string): Promise<MenuItem[]> {
  const system = `Você é um parser de cardápio. Analise o texto e extraia todos os pratos/bebidas.
Retorne um objeto JSON com a chave "items" contendo um array no formato:
{"items":[{"name":"Nome do Prato","description":"Descrição breve","price":00.00}]}
Regras:
- name: nome normalizado (Title Case, sem caracteres especiais extras)
- description: descrição do prato ou string vazia ""
- price: preço como número decimal (ex: 39.90). Se não houver preço, use 0
- Não inclua categorias como itens, apenas pratos/bebidas reais`;

  const result = await callOpenAIList(system, rawText) as unknown[];
  const items = z.array(menuItemSchema).parse(result);
  return items.map((item) => ({ ...item, name: normalizeName(item.name) }));
}

export async function parseInvoiceText(rawText: string): Promise<InvoiceItem[]> {
  const system = `Você é um parser de nota fiscal / nota de compra. Analise o texto e extraia todos os produtos/insumos.
Retorne um objeto JSON com a chave "items" contendo um array no formato:
{"items":[{"product":"Nome do Produto","quantity":0,"unit_cost":0.00,"total_cost":0.00}]}
Regras:
- product: nome normalizado do insumo/produto (Title Case)
- quantity: quantidade numérica positiva
- unit_cost: custo unitário como número decimal
- total_cost: custo total (quantity * unit_cost). Se não disponível, calcule.
- Ignore linhas de totais gerais, impostos e cabeçalhos
- Extraia apenas itens de produto individuais`;

  const result = await callOpenAIList(system, rawText) as unknown[];
  const items = z.array(invoiceItemSchema).parse(result);
  return items.map((item) => ({
    ...item,
    product: normalizeName(item.product),
    total_cost: item.total_cost ?? item.quantity * item.unit_cost
  }));
}
