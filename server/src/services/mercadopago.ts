import { getStoredSetting } from "./system-settings";

const MP_API = "https://api.mercadopago.com";

async function getAccessToken(): Promise<string> {
  const token = await getStoredSetting<string | null>("mp_access_token", null);
  if (!token) throw new Error("Mercado Pago não configurado. Adicione o Access Token em Configurações → Pagamentos.");
  return token;
}

export async function createPixPayment(params: {
  amount: number;
  description: string;
  payerEmail?: string;
}) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `rtpg-${Date.now()}-${Math.random().toString(36).slice(2)}`
    },
    body: JSON.stringify({
      transaction_amount: params.amount,
      description: params.description,
      payment_method_id: "pix",
      payer: { email: params.payerEmail || "cliente@rtpg.local" }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(`Mercado Pago: ${err.message ?? "Erro ao criar cobrança Pix"}`);
  }

  return response.json();
}

export async function getPaymentStatus(externalId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${MP_API}/v1/payments/${externalId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error("Erro ao consultar pagamento no Mercado Pago");
  return response.json() as Promise<{ id: number; status: string }>;
}

export async function isMercadoPagoConfigured(): Promise<boolean> {
  const token = await getStoredSetting<string | null>("mp_access_token", null);
  return Boolean(token);
}
