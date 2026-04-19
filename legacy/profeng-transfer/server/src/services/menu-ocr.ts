type ExtractMenuTextInput = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

function getModel() {
  return process.env.OPENAI_MENU_IMPORT_MODEL?.trim() || "gpt-4.1-mini";
}

function dataUrlToText(dataUrl: string) {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",").at(-1) ?? "" : dataUrl;
  return Buffer.from(base64, "base64").toString("utf8");
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const chunks: string[] = [];
  for (const output of payload?.output ?? []) {
    for (const content of output?.content ?? []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAiForExtraction(input: ExtractMenuTextInput) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    throw new Error("OCR automatico precisa da variavel OPENAI_API_KEY configurada no servidor.");
  }

  const isPdf = input.mimeType.includes("pdf") || input.fileName.toLowerCase().endsWith(".pdf");
  const isImage = input.mimeType.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new Error("Formato nao suportado para OCR automatico. Envie imagem, PDF ou texto.");
  }

  const prompt = [
    "Extraia fielmente o texto deste cardapio brasileiro.",
    "Nao invente produtos, precos, categorias ou descricoes.",
    "Preserve quebras de linha, categorias e precos do jeito mais proximo possivel.",
    "Retorne apenas texto puro, sem JSON e sem comentarios."
  ].join("\n");

  const content = isPdf
    ? [
        { type: "input_text", text: prompt },
        { type: "input_file", filename: input.fileName || "cardapio.pdf", file_data: input.dataUrl }
      ]
    : [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: input.dataUrl }
      ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getModel(),
      input: [
        {
          role: "user",
          content
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha ao extrair texto com IA (${response.status}). ${detail.slice(0, 400)}`);
  }

  const payload = await response.json();
  const text = extractResponseText(payload);
  if (!text) {
    throw new Error("A IA nao retornou texto util do cardapio. Tente uma imagem mais nitida ou um PDF com melhor qualidade.");
  }
  return text;
}

export async function extractMenuTextFromUpload(input: ExtractMenuTextInput) {
  if (input.mimeType.startsWith("text/") || input.fileName.toLowerCase().endsWith(".txt")) {
    return dataUrlToText(input.dataUrl);
  }

  return callOpenAiForExtraction(input);
}
