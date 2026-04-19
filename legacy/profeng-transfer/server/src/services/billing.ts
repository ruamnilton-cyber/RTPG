import crypto from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { getStoredSetting, setStoredSetting } from "./system-settings";
import { getSaasClients, registerSaasPayment, updateSaasClient } from "./platform";

const DEFAULT_PIX_RECIPIENT = "RTPG GESTAO";
const DEFAULT_PIX_CITY = "RIO DE JANEIRO";

const billingConfigSchema = z.object({
  pixKey: z.string().default(""),
  pixRecipientName: z.string().default(DEFAULT_PIX_RECIPIENT),
  pixCity: z.string().default(DEFAULT_PIX_CITY),
  creditCardCheckoutUrl: z.string().default(""),
  appBaseUrl: z.string().default(""),
  webhookSecret: z.string().default(""),
  asaasApiKeyConfigured: z.boolean().default(false),
  asaasEnvironment: z.enum(["sandbox", "production"]).default("sandbox"),
  asaasWebhookTokenConfigured: z.boolean().default(false)
});

type BillingConfig = z.infer<typeof billingConfigSchema>;
type BillingMethod = "pix" | "credit_card" | "play_store";

type CreateCheckoutInput = {
  clientId: string;
  method: BillingMethod;
};

type AsaasCustomerResponse = {
  id: string;
};

type AsaasPaymentResponse = {
  id: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  value?: number;
  dueDate?: string;
  status?: string;
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

function onlyDigits(input: string) {
  return input.replace(/\D/g, "");
}

function getAsaasRuntimeConfig() {
  const apiKey = process.env.ASAAS_API_KEY ?? "";
  const environment = process.env.ASAAS_ENV === "production" ? "production" : "sandbox";
  return {
    apiKey,
    environment,
    baseUrl: environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3",
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ?? ""
  };
}

async function asaasRequest<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  const config = getAsaasRuntimeConfig();
  if (!config.apiKey) {
    throw new Error("ASAAS_API_KEY nao configurada.");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "rtpg-gestao",
      access_token: config.apiKey
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = Array.isArray(payload?.errors)
      ? payload.errors.map((item: { description?: string }) => item.description).filter(Boolean).join(" ")
      : payload?.message;
    throw new Error(detail || `Falha na API Asaas (${response.status}).`);
  }

  return payload as T;
}

function toDateOnly(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

async function ensureAsaasCustomer(client: Awaited<ReturnType<typeof getSaasClients>>[number]) {
  if (client.asaasCustomerId) {
    return client.asaasCustomerId;
  }

  const cpfCnpj = onlyDigits(client.cpfCnpj ?? "");
  if (!cpfCnpj) {
    throw new Error("Informe CPF/CNPJ no cadastro do cliente antes de gerar cobranca Asaas.");
  }

  const created = await asaasRequest<AsaasCustomerResponse>("/customers", {
    method: "POST",
    body: {
      name: client.contactName || client.businessName,
      cpfCnpj,
      email: client.email || undefined,
      mobilePhone: onlyDigits(client.phone || ""),
      externalReference: client.id,
      notificationDisabled: false
    }
  });

  await updateSaasClient(client.id, { asaasCustomerId: created.id });
  return created.id;
}

async function createAsaasCheckout(input: {
  client: Awaited<ReturnType<typeof getSaasClients>>[number];
  method: Exclude<BillingMethod, "play_store">;
  amount: number;
  referenceMonth: string;
}) {
  const config = getAsaasRuntimeConfig();
  if (!config.apiKey) {
    return null;
  }

  const customer = await ensureAsaasCustomer(input.client);
  const billingType = input.method === "pix" ? "PIX" : "CREDIT_CARD";
  const payment = await asaasRequest<AsaasPaymentResponse>("/payments", {
    method: "POST",
    body: {
      customer,
      billingType,
      value: input.amount,
      dueDate: toDateOnly(input.client.nextDueDate),
      description: `Assinatura ${input.client.planName} - ${input.client.businessName}`,
      externalReference: `rtpg_saas:${input.client.id}:${input.referenceMonth}`
    }
  });

  return {
    status: "aguardando_pagamento",
    method: input.method,
    amount: payment.value ?? input.amount,
    dueDate: payment.dueDate ?? input.client.nextDueDate,
    referenceMonth: input.referenceMonth,
    checkoutUrl: payment.invoiceUrl ?? payment.bankSlipUrl,
    message: input.method === "pix"
      ? "Cobranca Pix criada no Asaas. Abra a fatura para pagar e o webhook confirmara automaticamente."
      : "Cobranca por cartao criada no Asaas. Abra o checkout seguro e o webhook confirmara automaticamente."
  } as const;
}

export async function getBillingConfig() {
  const envConfig: BillingConfig = {
    pixKey: process.env.SAAS_PIX_KEY ?? "",
    pixRecipientName: process.env.SAAS_PIX_RECIPIENT_NAME ?? DEFAULT_PIX_RECIPIENT,
    pixCity: process.env.SAAS_PIX_CITY ?? DEFAULT_PIX_CITY,
    creditCardCheckoutUrl: process.env.SAAS_CARD_CHECKOUT_URL ?? "",
    appBaseUrl: process.env.APP_BASE_URL ?? "",
    webhookSecret: process.env.SAAS_BILLING_WEBHOOK_SECRET ?? "",
    asaasApiKeyConfigured: Boolean(process.env.ASAAS_API_KEY),
    asaasEnvironment: process.env.ASAAS_ENV === "production" ? "production" : "sandbox",
    asaasWebhookTokenConfigured: Boolean(process.env.ASAAS_WEBHOOK_TOKEN)
  };

  const stored = await getStoredSetting<Partial<BillingConfig>>("saas-billing-config", {});
  return billingConfigSchema.parse({
    ...envConfig,
    ...stored,
    asaasApiKeyConfigured: Boolean(process.env.ASAAS_API_KEY),
    asaasEnvironment: process.env.ASAAS_ENV === "production" ? "production" : "sandbox",
    asaasWebhookTokenConfigured: Boolean(process.env.ASAAS_WEBHOOK_TOKEN)
  });
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
    asaasConfigured: config.asaasApiKeyConfigured,
    asaasEnvironment: config.asaasEnvironment,
    asaasWebhookConfigured: config.asaasWebhookTokenConfigured,
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
    try {
      const asaasCheckout = await createAsaasCheckout({ client, method: "pix", amount, referenceMonth });
      if (asaasCheckout) {
        return asaasCheckout;
      }
    } catch (error) {
      return {
        status: "pendente_configuracao",
        method: "pix",
        message: error instanceof Error ? error.message : "Nao foi possivel criar a cobranca Pix no Asaas."
      } as const;
    }

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
    try {
      const asaasCheckout = await createAsaasCheckout({ client, method: "credit_card", amount, referenceMonth });
      if (asaasCheckout) {
        return asaasCheckout;
      }
    } catch (error) {
      return {
        status: "pendente_configuracao",
        method: "credit_card",
        message: error instanceof Error ? error.message : "Nao foi possivel criar a cobranca por cartao no Asaas."
      } as const;
    }

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
  providerPaymentId?: string;
}) {
  if (input.providerPaymentId) {
    const clients = await getSaasClients();
    const client = clients.find((item) => item.id === input.clientId);
    if (client?.payments.some((payment) => payment.notes?.includes(input.providerPaymentId!))) {
      return client;
    }
  }

  const paidAt = input.paidAt ?? new Date().toISOString();
  const client = await registerSaasPayment(input.clientId, {
    amount: input.amount,
    paidAt,
    referenceMonth: input.referenceMonth ?? paidAt.slice(0, 7),
    notes: input.notes ?? "Pagamento confirmado por webhook"
  });
  return client;
}

export function validateAsaasWebhookToken(tokenHeader: string | undefined) {
  const expected = getAsaasRuntimeConfig().webhookToken;
  if (!expected || !tokenHeader) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(tokenHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function confirmAsaasWebhookPayment(body: unknown) {
  const data = z.object({
    event: z.string(),
    payment: z.object({
      id: z.string(),
      externalReference: z.string().optional().default(""),
      value: z.number().optional(),
      netValue: z.number().optional(),
      paymentDate: z.string().optional(),
      clientPaymentDate: z.string().optional(),
      confirmedDate: z.string().optional(),
      dateCreated: z.string().optional()
    }).passthrough()
  }).passthrough().parse(body);

  if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(data.event)) {
    return { ok: true, ignored: true, event: data.event };
  }

  const [, clientId, referenceMonth] = data.payment.externalReference.split(":");
  if (!clientId) {
    return { ok: true, ignored: true, event: data.event, reason: "externalReference ausente" };
  }

  const paidAt = data.payment.paymentDate ?? data.payment.clientPaymentDate ?? data.payment.confirmedDate ?? data.payment.dateCreated;
  const client = await confirmSaasCheckoutPayment({
    clientId,
    amount: Number(data.payment.value ?? data.payment.netValue ?? 0),
    paidAt,
    referenceMonth,
    providerPaymentId: data.payment.id,
    notes: `Pagamento ${data.event} confirmado via Asaas (${data.payment.id})`
  });

  return { ok: true, clientId: client?.id ?? clientId, event: data.event };
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
