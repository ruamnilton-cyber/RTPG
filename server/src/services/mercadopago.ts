import { getBarStoredSetting } from "./system-settings";

const MP_API = "https://api.mercadopago.com";

async function getAccessToken(barId: string): Promise<string> {
  const token = await getBarStoredSetting<string | null>(barId, "mp_access_token", null);
  if (!token) throw new Error("Mercado Pago não configurado. Adicione o Access Token em Configurações → Pagamentos.");
  return token;
}

export async function createPixPayment(barId: string, params: {
  amount: number;
  description: string;
  payerEmail?: string;
}) {
  const accessToken = await getAccessToken(barId);

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

export async function getPaymentStatus(barId: string, externalId: string) {
  const accessToken = await getAccessToken(barId);

  const response = await fetch(`${MP_API}/v1/payments/${externalId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error("Erro ao consultar pagamento no Mercado Pago");
  return response.json() as Promise<{ id: number; status: string }>;
}

export async function isMercadoPagoConfigured(barId: string): Promise<boolean> {
  const token = await getBarStoredSetting<string | null>(barId, "mp_access_token", null);
  return Boolean(token);
}
