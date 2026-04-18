import crypto from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { getStoredSetting, setStoredSetting } from "./system-settings";
import { getSaasClients, registerSaasPayment } from "./platform";

const DEFAULT_PIX_RECIPIENT = "RTPG GESTAO";
const DEFAULT_PIX_CITY = "RIO DE JANEIRO";

const billingConfigSchema = z.object({
  pixKey: z.string().default(""),
  pixRecipientName: z.string().default(DEFAULT_PIX_RECIPIENT),
  pixCity: z.string().default(DEFAULT_PIX_CITY),
  creditCardCheckoutUrl: z.string().default(""),
  appBaseUrl: z.string().default(""),
  webhookSecret: z.string().default("")
});

type BillingConfig = z.infer<typeof billingConfigSchema>;
type BillingMethod = "pix" | "credit_card" | "play_store";

type CreateCheckoutInput = {
  clientId: string;
  method: BillingMethod;
};

function sanitizePixText(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .slice(0, 25);
}

function emvField(id: string, value: string) {
  const length = value.length.toString().padStart(2, "0");
  return `${id}${length}${value}`;
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function buildPixPayload(input: {
  pixKey: string;
  recipientName: string;
  city: string;
  amount: number;
  txid: string;
  description: string;
}) {
  const merchantAccountInformation = emvField(
    "26",
    `${emvField("00", "BR.GOV.BCB.PIX")}${emvField("01", input.pixKey)}${emvField("02", input.description.slice(0, 40))}`
  );

  const amount = input.amount.toFixed(2);
  const payloadWithoutCrc = [
    emvField("00", "01"),
    emvField("01", "12"),
    merchantAccountInformation,
    emvField("52", "0000"),
    emvField("53", "986"),
    emvField("54", amount),
    emvField("58", "BR"),
    emvField("59", sanitizePixText(input.recipientName)),
    emvField("60", sanitizePixText(input.city)),
    emvField("62", emvField("05", input.txid.slice(0, 25))),
    "6304"
  ].join("");

  return `${payloadWithoutCrc}${crc16Ccitt(payloadWithoutCrc)}`;
}

function resolveTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => variables[key] ?? "");
}

export async function getBillingConfig() {
  const envConfig: BillingConfig = {
    pixKey: process.env.SAAS_PIX_KEY ?? "",
    pixRecipientName: process.env.SAAS_PIX_RECIPIENT_NAME ?? DEFAULT_PIX_RECIPIENT,
    pixCity: process.env.SAAS_PIX_CITY ?? DEFAULT_PIX_CITY,
    creditCardCheckoutUrl: process.env.SAAS_CARD_CHECKOUT_URL ?? "",
    appBaseUrl: process.env.APP_BASE_URL ?? "",
    webhookSecret: process.env.SAAS_BILLING_WEBHOOK_SECRET ?? ""
  };

  const stored = await getStoredSetting("saas-billing-config", envConfig);
  return billingConfigSchema.parse(stored);
}

export async function saveBillingConfig(input: Partial<BillingConfig>) {
  const current = await getBillingConfig();
  const next = billingConfigSchema.parse({ ...current, ...input });
  await setStoredSetting("saas-billing-config", next);
  return next;
}

export function billingConfigPublicView(config: BillingConfig) {
  return {
    pixConfigured: Boolean(config.pixKey),
    cardCheckoutConfigured: Boolean(config.creditCardCheckoutUrl),
    appBaseUrlConfigured: Boolean(config.appBaseUrl),
    webhookConfigured: Boolean(config.webhookSecret),
    pixRecipientName: config.pixRecipientName,
    pixCity: config.pixCity
  };
}

export async function createSaasCheckout(input: CreateCheckoutInput) {
  const clients = await getSaasClients();
  const client = clients.find((item) => item.id === input.clientId);
  if (!client) {
    throw new Error("Cliente SaaS nao encontrado para checkout.");
  }

  const config = await getBillingConfig();
  const amount = Number(client.monthlyFee || 0);
  const referenceMonth = new Date().toISOString().slice(0, 7);
  const txid = crypto.randomUUID().replace(/-/g, "").slice(0, 25);

  if (input.method === "pix") {
    if (!config.pixKey) {
      return {
        status: "pendente_configuracao",
        method: "pix",
        message: "Chave Pix ainda nao configurada no Meu Gestor."
      } as const;
    }

    const pixCode = buildPixPayload({
      pixKey: config.pixKey,
      recipientName: config.pixRecipientName,
      city: config.pixCity,
      amount,
      txid,
      description: `ASSINATURA ${client.accessLogin}`
    });
    const qrCodeDataUrl = await QRCode.toDataURL(pixCode, { margin: 1, width: 300 });

    return {
      status: "aguardando_pagamento",
      method: "pix",
      amount,
      dueDate: client.nextDueDate,
      referenceMonth,
      qrCodeDataUrl,
      copyPasteCode: pixCode,
      message: "Use o QR Code Pix para pagar a assinatura e liberar o plano."
    } as const;
  }

  if (input.method === "credit_card") {
    if (!config.creditCardCheckoutUrl) {
      return {
        status: "pendente_configuracao",
        method: "credit_card",
        message: "Checkout de cartao ainda nao configurado no Meu Gestor."
      } as const;
    }

    const checkoutUrl = resolveTemplate(config.creditCardCheckoutUrl, {
      amount: amount.toFixed(2),
      client_id: client.id,
      restaurant: encodeURIComponent(client.businessName),
      access_login: client.accessLogin,
      due_date: client.nextDueDate,
      reference_month: referenceMonth
    });

    return {
      status: "aguardando_pagamento",
      method: "credit_card",
      amount,
      dueDate: client.nextDueDate,
      referenceMonth,
      checkoutUrl,
      message: "Finalize o pagamento no checkout de cartao."
    } as const;
  }

  return {
    status: "futuro",
    method: "play_store",
    message: "Play Store fica disponivel apos publicar o app mobile com assinatura in-app."
  } as const;
}

export async function confirmSaasCheckoutPayment(input: {
  clientId: string;
  amount: number;
  paidAt?: string;
  referenceMonth?: string;
  notes?: string;
}) {
  const paidAt = input.paidAt ?? new Date().toISOString();
  const client = await registerSaasPayment(input.clientId, {
    amount: input.amount,
    paidAt,
    referenceMonth: input.referenceMonth ?? paidAt.slice(0, 7),
    notes: input.notes ?? "Pagamento confirmado por webhook"
  });
  return client;
}

export async function validateBillingWebhookSignature(signatureHeader: string | undefined, rawToken: string) {
  const config = await getBillingConfig();
  if (!config.webhookSecret) {
    return false;
  }
  if (!signatureHeader) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", config.webhookSecret)
    .update(rawToken)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}
