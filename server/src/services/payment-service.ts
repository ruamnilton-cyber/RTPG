/**
 * payment-service.ts
 *
 * Serviço de geração de links de pagamento.
 *
 * ARQUITETURA:
 *   - Interface `PaymentProvider` define o contrato de qualquer gateway.
 *   - `ManualPaymentProvider` é o provider padrão: gera um link interno de
 *     confirmação manual (sem gateway externo). Suficiente para a Fase 1.
 *   - Para integrar Stripe, Mercado Pago, PagSeguro etc., basta implementar
 *     a interface `PaymentProvider` e trocar `activeProvider` abaixo.
 *
 * VARIÁVEIS DE AMBIENTE (opcionais, para providers reais):
 *   PAYMENT_PROVIDER=manual | mercadopago | stripe
 *   MERCADO_PAGO_ACCESS_TOKEN=...
 *   STRIPE_SECRET_KEY=...
 *   APP_BASE_URL=https://seu-dominio.com  (para o link interno)
 */

import { prisma } from "../lib/prisma";
import { randomUUID } from "node:crypto";
import { appEnv } from "../env";

// ─── Interface do provider ────────────────────────────────────────────────────

interface PaymentLinkResult {
  id: string;
  url: string;
  amount: number;
  status: string;
}

interface PaymentProvider {
  generateLink(orderId: string, amount: number, description: string): Promise<PaymentLinkResult>;
}

// ─── Provider manual (padrão Fase 1) ─────────────────────────────────────────

class ManualPaymentProvider implements PaymentProvider {
  async generateLink(orderId: string, amount: number, _description: string): Promise<PaymentLinkResult> {
    const linkId = randomUUID();
    // Gera URL interna de confirmação. Em produção, este link pode apontar
    // para uma página pública do sistema ou chave PIX.
    const baseUrl = process.env.APP_BASE_URL ?? `http://localhost:${appEnv.port}`;
    const url = `${baseUrl}/public/pagamento/${linkId}?pedido=${orderId}&valor=${amount.toFixed(2)}`;
    return { id: linkId, url, amount, status: "PENDENTE" };
  }
}

// ─── Seleção de provider ──────────────────────────────────────────────────────
// Adicione novos providers aqui conforme necessário.

function resolveProvider(): PaymentProvider {
  const providerName = (process.env.PAYMENT_PROVIDER ?? "manual").toLowerCase();

  if (providerName === "manual") {
    return new ManualPaymentProvider();
  }

  // Fallback seguro — provider desconhecido usa manual
  console.warn(`[Payment] Provider "${providerName}" não reconhecido. Usando manual.`);
  return new ManualPaymentProvider();
}

const activeProvider = resolveProvider();

// ─── API pública ─────────────────────────────────────────────────────────────

export async function createPaymentLink(orderId: string, amount: number, phone?: string) {
  const description = `Pedido WhatsApp ${phone ?? orderId}`;
  const result = await activeProvider.generateLink(orderId, amount, description);

  // Persiste no banco
  const link = await prisma.paymentLink.create({
    data: {
      id: result.id,
      orderId,
      url: result.url,
      amount: result.amount,
      status: result.status,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    }
  });

  return link;
}

export async function getPaymentLinksByOrder(orderId: string) {
  return prisma.paymentLink.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" }
  });
}

export async function markPaymentLinkPaid(linkId: string) {
  return prisma.paymentLink.update({
    where: { id: linkId },
    data: { status: "PAGO", paidAt: new Date() }
  });
}
