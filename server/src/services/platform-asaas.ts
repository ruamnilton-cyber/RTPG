import { appEnv } from "../env";
import type { SaasClientRecord } from "../contracts/platform";

const ASAAS_PROD = "https://api.asaas.com/v3";
const ASAAS_SANDBOX = "https://api-sandbox.asaas.com/v3";

type AsaasErrorResponse = {
  errors?: Array<{ description?: string }>;
};

type AsaasCustomer = {
  id: string;
};

type AsaasPayment = {
  id: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate?: string;
};

export type PlatformAsaasPixCharge = {
  externalId: string;
  status: string;
  invoiceUrl: string;
  bankSlipUrl: string;
  pixQrCode: string;
  pixQrCodeBase64: string;
};

function getConfig() {
  const apiKey = appEnv.platformAsaas.apiKey.trim();
  if (!apiKey) {
    throw new Error("Asaas da plataforma nao configurado. Preencha PLATFORM_ASAAS_API_KEY no .env do servidor.");
  }

  return {
    apiKey,
    baseUrl: appEnv.platformAsaas.sandbox ? ASAAS_SANDBOX : ASAAS_PROD
  };
}

function makeHeaders(apiKey: string) {
  return { access_token: apiKey, "Content-Type": "application/json" };
}

async function readAsaasError(response: Response, fallback: string) {
  const parsed = await response.json().catch(() => ({})) as AsaasErrorResponse;
  return parsed.errors?.[0]?.description ?? fallback;
}

export function isPlatformAsaasConfigured() {
  return Boolean(appEnv.platformAsaas.apiKey.trim());
}

export function normalizeCpfCnpj(value: string) {
  return value.replace(/\D/g, "");
}

export function assertCpfCnpj(value: string) {
  const digits = normalizeCpfCnpj(value);
  if (![11, 14].includes(digits.length)) {
    throw new Error("Informe um CPF ou CNPJ valido do restaurante antes de gerar cobranca Asaas.");
  }
  return digits;
}

export function mapAsaasChargeStatus(status: string) {
  if (status === "RECEIVED" || status === "CONFIRMED" || status === "RECEIVED_IN_CASH") return "PAGO" as const;
  if (status === "OVERDUE") return "VENCIDO" as const;
  if (status === "DELETED" || status === "REFUNDED" || status === "REFUND_REQUESTED") return "CANCELADO" as const;
  if (status === "PAYMENT_REPROVED_BY_RISK_ANALYSIS" || status === "CHARGEBACK_REQUESTED") return "FALHOU" as const;
  return "PENDENTE" as const;
}

export function isAsaasChargePaid(status: string) {
  return mapAsaasChargeStatus(status) === "PAGO";
}

export function isPlatformAsaasWebhookAuthorized(headerValue: string | string[] | undefined) {
  const expected = appEnv.platformAsaas.webhookToken.trim();
  if (!expected) return true;
  const received = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return received === expected;
}

export async function findPlatformAsaasCustomer(client: SaasClientRecord) {
  const { apiKey, baseUrl } = getConfig();
  const url = `${baseUrl}/customers?externalReference=${encodeURIComponent(client.id)}`;
  const response = await fetch(url, { headers: makeHeaders(apiKey) });
  if (!response.ok) return null;

  const parsed = await response.json().catch(() => ({})) as { data?: AsaasCustomer[] };
  return parsed.data?.[0]?.id ?? null;
}

export async function createPlatformAsaasCustomer(client: SaasClientRecord) {
  const { apiKey, baseUrl } = getConfig();
  const cpfCnpj = assertCpfCnpj(client.cpfCnpj);

  const response = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      name: client.contactName || client.businessName,
      cpfCnpj,
      email: client.email || undefined,
      mobilePhone: normalizeCpfCnpj(client.phone) || undefined,
      externalReference: client.id,
      notificationDisabled: false,
      observations: `Cliente SaaS RTPG - ${client.businessName}`
    })
  });

  if (!response.ok) {
    const message = await readAsaasError(response, "Erro ao criar cliente no Asaas.");
    throw new Error(`Asaas plataforma: ${message}`);
  }

  const customer = await response.json() as AsaasCustomer;
  return customer.id;
}

export async function createPlatformAsaasPixCharge(params: {
  customerId: string;
  amount: number;
  dueDate: string;
  description: string;
  externalReference: string;
}) {
  const { apiKey, baseUrl } = getConfig();
  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      customer: params.customerId,
      billingType: "PIX",
      value: params.amount,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.externalReference
    })
  });

  if (!response.ok) {
    const message = await readAsaasError(response, "Erro ao criar cobranca Pix no Asaas.");
    throw new Error(`Asaas plataforma: ${message}`);
  }

  const payment = await response.json() as AsaasPayment;
  const qrResponse = await fetch(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
    headers: makeHeaders(apiKey)
  });

  if (!qrResponse.ok) {
    const message = await readAsaasError(qrResponse, "Erro ao obter QR Code Pix.");
    throw new Error(`Asaas plataforma: ${message}`);
  }

  const qr = await qrResponse.json() as AsaasPixQrCode;

  return {
    externalId: payment.id,
    status: payment.status,
    invoiceUrl: payment.invoiceUrl ?? "",
    bankSlipUrl: payment.bankSlipUrl ?? "",
    pixQrCode: qr.payload,
    pixQrCodeBase64: qr.encodedImage
  } satisfies PlatformAsaasPixCharge;
}

export async function getPlatformAsaasPaymentStatus(externalId: string) {
  const { apiKey, baseUrl } = getConfig();
  const response = await fetch(`${baseUrl}/payments/${externalId}`, {
    headers: makeHeaders(apiKey)
  });

  if (!response.ok) {
    const message = await readAsaasError(response, "Erro ao consultar pagamento no Asaas.");
    throw new Error(`Asaas plataforma: ${message}`);
  }

  return response.json() as Promise<AsaasPayment>;
}
