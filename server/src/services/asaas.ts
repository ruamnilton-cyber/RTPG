import { getStoredSetting, setStoredSetting } from "./system-settings";

const ASAAS_PROD    = "https://api.asaas.com/api/v3";
const ASAAS_SANDBOX = "https://sandbox.asaas.com/api/v3";

async function getConfig() {
  const apiKey = await getStoredSetting<string | null>("asaas_api_key", null);
  if (!apiKey) throw new Error("Asaas não configurado. Adicione a API Key em Configurações → Pagamentos.");
  const sandbox = await getStoredSetting<string | null>("asaas_sandbox", "true");
  const baseUrl = sandbox === "false" ? ASAAS_PROD : ASAAS_SANDBOX;
  return { apiKey, baseUrl };
}

function makeHeaders(apiKey: string) {
  return { "access_token": apiKey, "Content-Type": "application/json" };
}

export async function isAsaasConfigured(): Promise<boolean> {
  const key = await getStoredSetting<string | null>("asaas_api_key", null);
  return Boolean(key);
}

async function ensureCustomer(): Promise<string> {
  // Reuse cached customer if available
  const cached = await getStoredSetting<string | null>("asaas_customer_id", null);
  if (cached) return cached;

  const { apiKey, baseUrl } = await getConfig();
  const cpfCnpj = await getStoredSetting<string | null>("asaas_cpf_cnpj", null) ?? "00003128290";

  // Try to find existing customer by cpfCnpj
  const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cpfCnpj}`, {
    headers: makeHeaders(apiKey)
  });
  if (searchRes.ok) {
    const searched = await searchRes.json() as { data?: Array<{ id: string }> };
    if (searched.data && searched.data.length > 0) {
      await setStoredSetting("asaas_customer_id", searched.data[0].id);
      return searched.data[0].id;
    }
  }

  // Create new customer
  const res = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      name: "Cliente RTPG Gestão",
      cpfCnpj,
      notificationDisabled: true
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { errors?: Array<{ description?: string }> };
    const msg = err.errors?.[0]?.description ?? "Erro ao criar cliente no Asaas";
    throw new Error(`Asaas: ${msg}`);
  }

  const customer = await res.json() as { id: string };
  await setStoredSetting("asaas_customer_id", customer.id);
  return customer.id;
}

export async function createAsaasPixPayment(params: { amount: number; description: string }) {
  const { apiKey, baseUrl } = await getConfig();
  const customerId = await ensureCustomer();

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  const res = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value: params.amount,
      dueDate: dueDateStr,
      description: params.description
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { errors?: Array<{ description?: string }> };
    const msg = err.errors?.[0]?.description ?? "Erro ao criar cobrança Pix no Asaas";
    throw new Error(`Asaas: ${msg}`);
  }

  const payment = await res.json() as { id: string; status: string };

  // Get QR code immediately after creation
  const qrRes = await fetch(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
    headers: makeHeaders(apiKey)
  });

  if (!qrRes.ok) throw new Error("Asaas: Erro ao obter QR Code Pix");

  const qr = await qrRes.json() as {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  };

  return {
    id: payment.id,
    pixQrCode: qr.payload,
    pixQrCodeBase64: qr.encodedImage
  };
}

export async function getAsaasPaymentStatus(externalId: string): Promise<{ status: string }> {
  const { apiKey, baseUrl } = await getConfig();

  const res = await fetch(`${baseUrl}/payments/${externalId}`, {
    headers: makeHeaders(apiKey)
  });

  if (!res.ok) throw new Error("Asaas: Erro ao consultar pagamento");

  const data = await res.json() as { id: string; status: string };
  return data;
}

export function isAsaasPaid(status: string): boolean {
  return status === "RECEIVED" || status === "CONFIRMED" || status === "RECEIVED_IN_CASH";
}
