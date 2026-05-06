import { z } from "zod";

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

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada no servidor. Adicione a variável de ambiente.");
  return key;
}

function getTextModel() {
  return process.env.OPENAI_MENU_IMPORT_MODEL ?? "gpt-4.1-mini";
}

function getVisionModel() {
  return process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
}

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

async function getOpenAI() {
  // Dynamic import avoids breaking catalog routes at startup if the package is missing
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: getApiKey() });
}

async function chatComplete(model: string, messages: object[], useJsonMode = true): Promise<string> {
  const client = await getOpenAI();
  const params: Record<string, unknown> = { model, max_tokens: 2048, messages, temperature: 0 };
  if (useJsonMode) params.response_format = { type: "json_object" };
  const completion = await (client.chat.completions.create as (p: Record<string, unknown>) => Promise<{ choices: Array<{ message: { content: string | null } }> }>)(params);
  return completion.choices[0]?.message?.content?.trim() ?? '{"items":[]}';
}

export async function parseMenuText(rawText: string): Promise<MenuItem[]> {
  const system = `Você é um parser de cardápio. Analise o texto e extraia todos os pratos/bebidas.
Retorne um objeto JSON com a chave "items":
{"items":[{"name":"Nome","description":"Descrição","price":0.00}]}
- name: Title Case, sem caracteres extras
- description: descrição ou ""
- price: número decimal (0 se não houver)
- Ignore linhas de categoria, só extraia itens reais`;

  const raw = await chatComplete(getTextModel(), [
    { role: "system", content: system },
    { role: "user", content: rawText }
  ]);

  const parsed = JSON.parse(raw) as { items?: unknown[] };
  const result = parsed.items ?? [];
  const items = z.array(menuItemSchema).parse(result);
  return items.map((item) => ({ ...item, name: normalizeName(item.name) }));
}

export async function parseMenuImage(base64: string, mimeType: string): Promise<MenuItem[]> {
  const prompt = `Você é um parser de cardápio. Analise a imagem e extraia todos os pratos/bebidas visíveis.
Retorne SOMENTE JSON válido, sem texto extra:
{"items":[{"name":"Nome","description":"Descrição","price":0.00}]}
- name: Title Case
- description: descrição ou ""
- price: número decimal. Se não visível, use 0
- Leia todo texto da imagem incluindo preços`;

  const client = await getOpenAI();
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
    console.error("[AI Vision] Resposta bruta:", raw);
    throw new Error("A IA não conseguiu estruturar os itens da imagem. Tente foto mais nítida ou use o modo texto.");
  }

  const items = z.array(menuItemSchema).parse(result);
  return items.map((item) => ({ ...item, name: normalizeName(item.name) }));
}

export async function parseInvoiceText(rawText: string): Promise<InvoiceItem[]> {
  const system = `Você é um parser de nota fiscal. Analise o texto e extraia todos os produtos/insumos.
Retorne um objeto JSON com a chave "items":
{"items":[{"product":"Nome","quantity":0,"unit_cost":0.00,"total_cost":0.00}]}
- product: Title Case
- quantity: número positivo
- unit_cost: custo unitário decimal
- total_cost: quantity * unit_cost
- Ignore totais gerais, impostos e cabeçalhos`;

  const raw = await chatComplete(getTextModel(), [
    { role: "system", content: system },
    { role: "user", content: rawText }
  ]);

  const parsed = JSON.parse(raw) as { items?: unknown[] };
  const result = parsed.items ?? [];
  const items = z.array(invoiceItemSchema).parse(result);
  return items.map((item) => ({
    ...item,
    product: normalizeName(item.product),
    total_cost: item.total_cost ?? item.quantity * item.unit_cost
  }));
}
