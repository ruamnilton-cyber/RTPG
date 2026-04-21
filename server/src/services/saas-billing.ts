import { getSaasClients, registerSaasPayment } from "./platform";
import { getSecretSetting, getStoredSetting, setStoredSetting } from "./system-settings";

const ASAAS_PROD    = "https://api.asaas.com/api/v3";
const ASAAS_SANDBOX = "https://sandbox.asaas.com/api/v3";
const FETCH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function getPlatformConfig() {
  // API key Ã© um secret â€” sempre decriptado via getSecretSetting
  const apiKey = await getSecretSetting("platform_asaas_api_key");
  if (!apiKey) throw new Error("Asaas nÃ£o configurado. Configure em Meu Gestor > Carteira.");
  const sandbox = await getStoredSetting<string>("platform_asaas_sandbox", "true");
  return { apiKey, baseUrl: sandbox === "false" ? ASAAS_PROD : ASAAS_SANDBOX };
}

function makeHeaders(apiKey: string) {
  return { "access_token": apiKey, "Content-Type": "application/json" };
}

async function getOrCreateCustomer(
  apiKey: string,
  baseUrl: string,
  client: { id: string; contactName: string; email: string; phone: string }
) {
  const cacheKey = `platform_asaas_cid_${client.id}`;
  const cached = await getStoredSetting<string | null>(cacheKey, null);
  if (cached) return cached;

  const searchRes = await fetchWithTimeout(`${baseUrl}/customers?email=${encodeURIComponent(client.email)}`, {
    headers: makeHeaders(apiKey)
  });
  if (searchRes.ok) {
    const data = await searchRes.json() as { data?: Array<{ id: string }> };
    if (data.data?.length) {
      await setStoredSetting(cacheKey, data.data[0].id);
      return data.data[0].id;
    }
  }

  const createRes = await fetchWithTimeout(`${baseUrl}/customers`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      name: client.contactName,
      email: client.email,
      mobilePhone: client.phone.replace(/\D/g, "").slice(0, 11),
      notificationDisabled: false
    })
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as { errors?: Array<{ description?: string }> };
    throw new Error(err.errors?.[0]?.description ?? "Erro ao criar cliente no Asaas");
  }
  const customer = await createRes.json() as { id: string };
  await setStoredSetting(cacheKey, customer.id);
  return customer.id;
}

export async function isPlatformAsaasConfigured() {
  const key = await getSecretSetting("platform_asaas_api_key");
  return Boolean(key);
}

type PendingCharge = {
  externalId: string;
  pixQrCode: string;
  pixQrCodeBase64: string;
  amount: number;
  expiresAt: string;
};

export async function getOrCreateSubscriptionCharge(saasClientId: string) {
  const pendingKey = `platform_asaas_pending_${saasClientId}`;
  const existing = await getStoredSetting<PendingCharge | null>(pendingKey, null);
  if (existing && new Date(existing.expiresAt) > new Date()) {
    return existing;
  }

  const clients = await getSaasClients();
  const client = clients.find(c => c.id === saasClientId);
  if (!client) throw new Error("Cliente SaaS nao encontrado.");

  const { apiKey, baseUrl } = await getPlatformConfig();
  const customerId = await getOrCreateCustomer(apiKey, baseUrl, client);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  const payRes = await fetchWithTimeout(`${baseUrl}/payments`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value: client.monthlyFee || 1,
      dueDate: dueDateStr,
      description: `Assinatura ${client.planName} - ${client.businessName}`,
      externalReference: `saas_${saasClientId}`
    })
  });
  if (!payRes.ok) {
    const err = await payRes.json().catch(() => ({})) as { errors?: Array<{ description?: string }> };
    throw new Error(err.errors?.[0]?.description ?? "Erro ao criar cobranca");
  }
  const payment = await payRes.json() as { id: string };

  const qrRes = await fetchWithTimeout(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
    headers: makeHeaders(apiKey)
  });
  if (!qrRes.ok) throw new Error("Erro ao obter QR Code PIX");
  const qr = await qrRes.json() as { encodedImage: string; payload: string };

  const result: PendingCharge = {
    externalId: payment.id,
    pixQrCode: qr.payload,
    pixQrCodeBase64: qr.encodedImage,
    amount: client.monthlyFee || 1,
    expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
  };
  await setStoredSetting(pendingKey, result);
  return result;
}

export async function checkAndConfirmPayment(externalId: string, saasClientId: string): Promise<boolean> {
  const { apiKey, baseUrl } = await getPlatformConfig();
  const res = await fetchWithTimeout(`${baseUrl}/payments/${externalId}`, { headers: makeHeaders(apiKey) });
  if (!res.ok) return false;
  const data = await res.json() as { status: string; value?: number };
  const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(data.status);
  if (paid) {
    const now = new Date().toISOString();
    await registerSaasPayment(saasClientId, {
      amount: data.value ?? 0,
      paidAt: now,
      referenceMonth: now.slice(0, 7),
      notes: `PIX Asaas (${externalId})`
    });
    await setStoredSetting(`platform_asaas_pending_${saasClientId}`, null);
  }
  return paid;
}

export async function handleWebhook(body: {
  payment?: { id?: string; status?: string; externalReference?: string; value?: number }
}) {
  const p = body.payment;
  if (!p?.id || !p.status) return;
  const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status);
  if (!paid || !p.externalReference?.startsWith("saas_")) return;
  const clientId = p.externalReference.replace("saas_", "");

  // IdempotÃªncia: ignora se este pagamento Asaas jÃ¡ foi processado
  const processedKey = `platform_asaas_processed_${p.id}`;
  const alreadyProcessed = await getStoredSetting<boolean>(processedKey, false);
  if (alreadyProcessed) {
    console.log(`[webhook] Pagamento ${p.id} jÃ¡ processado, ignorando duplicata.`);
    return;
  }

  const now = new Date().toISOString();
  await registerSaasPayment(clientId, {
    amount: p.value ?? 0,
    paidAt: now,
    referenceMonth: now.slice(0, 7),
    notes: `Webhook Asaas PIX (${p.id})`
  });
  await Promise.all([
    setStoredSetting(`platform_asaas_pending_${clientId}`, null),
    setStoredSetting(processedKey, true),
  ]);
}
