import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";
import { useBar } from "../state/bar";

type DashboardData = {
  salesToday: number;
  totalStock: number;
  totalProducts: number;
  openTables: number;
  estimatedGrossProfit: number;
};

type DreResponse = {
  productSummary: {
    totalProducts: number;
    totalRevenue: number;
    totalCost: number;
    totalGrossProfit: number;
  };
  storeSummary: {
    revenue: number;
    netRevenue: number;
    productCost: number;
    grossProfit: number;
    operationalResult: number;
    lines: Array<{ label: string; value: number; kind: string }>;
  };
};

type AgentCenterResponse = {
  agentCenter: {
    recommendations: Array<{
      id: string;
      severity: "ALTA" | "MEDIA" | "BAIXA";
      title: string;
      description: string;
      actionLabel: string;
      actionPath: string;
      sourceAgent: string;
    }>;
  };
};

type BillingStatus = {
  hasBilling: boolean;
  planName?: string;
  monthlyFee?: number;
  status?: "ATIVO" | "TRIAL" | "ATRASADO" | "SUSPENSO" | "CANCELADO";
  accessStatus?: "LIBERADO" | "BLOQUEIO_AVISO" | "BLOQUEADO";
  nextDueDate?: string;
  daysToDue?: number;
  paymentMethods?: Array<{ id: "pix" | "credit_card" | "play_store"; label: string; status: string }>;
};

type BillingCheckoutResponse = {
  status: "aguardando_pagamento" | "pendente_configuracao" | "futuro";
  method: "pix" | "credit_card" | "play_store";
  message: string;
  amount?: number;
  dueDate?: string;
  referenceMonth?: string;
  checkoutUrl?: string;
  qrCodeDataUrl?: string;
  copyPasteCode?: string;
};

type WhatsAppStatus = {
  status: "CONECTADO" | "DESCONECTADO" | "AGUARDANDO_QR";
};

const operationTiles = [
  {
    to: "/painel-dono/mesas",
    title: "Mesas e vendas",
    desc: "Abra a mesa, lance os itens ao longo do atendimento e feche a comanda so no final.",
    emoji: "🍽"
  },
  {
    to: "/painel-dono/produtos",
    title: "Cardapio",
    desc: "Produtos, categorias e precos do restaurante.",
    emoji: "📖"
  },
  {
    to: "/painel-dono/insumos",
    title: "Insumos e ficha tecnica",
    desc: "Ligue os insumos aos produtos para custo e baixa automatica.",
    emoji: "🥬"
  },
  {
    to: "/painel-dono/estoque",
    title: "Estoque",
    desc: "Entradas, compras, custo medio e saldo dos insumos.",
    emoji: "📦"
  },
  {
    to: "/painel-dono/financeiro",
    title: "Financeiro",
    desc: "Receitas, despesas e contas a pagar/receber integradas com a operacao.",
    emoji: "💳"
  },
  {
    to: "/painel-dono/whatsapp",
    title: "WhatsApp e IA",
    desc: "Conectar atendimento, pedidos e automacao com o restaurante.",
    emoji: "💬"
  }
];

const supportTiles = [
  { to: "/painel-dono/dre", title: "DRE geral e por produto" },
  { to: "/painel-dono/caixa", title: "Caixa" },
  { to: "/painel-dono/cozinha", title: "Cozinha / KDS" },
  { to: "/painel-dono/clientes", title: "Clientes" },
  { to: "/painel-dono/qrcodes", title: "QR Codes" },
  { to: "/painel-dono/config", title: "Configuracoes" }
];

export function OwnerHubPage() {
  const { token } = useAuth();
  const { bars, activeBarId } = useBar();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dre, setDre] = useState<DreResponse | null>(null);
  const [agentCenter, setAgentCenter] = useState<AgentCenterResponse["agentCenter"] | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [billingCheckout, setBillingCheckout] = useState<BillingCheckoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const activeBar = bars.find((bar) => bar.id === activeBarId) ?? bars[0];
  const restaurantName = activeBar?.name || "Seu restaurante";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiRequest<DashboardData>("/reports/dashboard", { token }),
      apiRequest<DreResponse>("/reports/dre?period=mes", { token }),
      apiRequest<AgentCenterResponse>("/ai/agents", { token }),
      apiRequest<BillingStatus>("/auth/billing-status", { token }),
      apiRequest<WhatsAppStatus>("/ai/whatsapp/status", { token })
    ])
      .then(([dash, dreData, agentData, billingData, whatsappData]) => {
        if (!cancelled) {
          setDashboard(dash);
          setDre(dreData);
          setAgentCenter(agentData.agentCenter);
          setBilling(billingData);
          setWhatsapp(whatsappData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboard(null);
          setDre(null);
          setAgentCenter(null);
          setBilling(null);
          setWhatsapp(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function requestCheckout(method: "pix" | "credit_card" | "play_store") {
    const result = await apiRequest<BillingCheckoutResponse>("/auth/billing-checkout", {
      method: "POST",
      token,
      body: { method }
    });
    setBillingCheckout(result);
  }

  const onboardingSteps = [
    {
      id: "profile",
      title: "Configurar dados e identidade do restaurante",
      description: "Coloque nome, endereco, logo, cores e taxa de servico para o sistema ficar com a cara do restaurante.",
      to: "/painel-dono/config",
      action: "Abrir configuracoes",
      done: Boolean(activeBar)
    },
    {
      id: "menu",
      title: "Importar ou cadastrar o cardapio",
      description: "Envie imagem/PDF do cardapio ou cole o texto. Depois confirme para os produtos aparecerem nas mesas e no WhatsApp.",
      to: "/painel-dono/produtos",
      action: "Importar cardapio",
      done: (dashboard?.totalProducts ?? 0) > 0
    },
    {
      id: "whatsapp",
      title: "Conectar o WhatsApp do restaurante",
      description: "Escaneie o QR Code para o atendimento automatico responder clientes e gerar pedidos no painel.",
      to: "/painel-dono/whatsapp",
      action: "Conectar WhatsApp",
      done: whatsapp?.status === "CONECTADO"
    },
    {
      id: "tables",
      title: "Testar mesas e comandas",
      description: "Abra uma mesa, lance alguns itens e feche uma conta de teste para entender a operacao do salao.",
      to: "/painel-dono/mesas",
      action: "Testar mesas",
      done: (dashboard?.openTables ?? 0) > 0 || (dashboard?.salesToday ?? 0) > 0
    },
    {
      id: "supplies",
      title: "Cadastrar insumos e ficha tecnica",
      description: "Vincule produtos aos insumos para calcular CMV, margem e DRE por produto com mais precisao.",
      to: "/painel-dono/insumos",
      action: "Cadastrar insumos",
      done: (dre?.storeSummary.productCost ?? 0) > 0
    },
    {
      id: "dre",
      title: "Acompanhar DRE e financeiro",
      description: "Depois das primeiras vendas e despesas, acompanhe receita, CMV, lucro bruto e resultado operacional.",
      to: "/painel-dono/dre",
      action: "Abrir DRE",
      done: (dre?.storeSummary.netRevenue ?? 0) > 0
    }
  ];
  const completedOnboarding = onboardingSteps.filter((step) => step.done).length;
  const onboardingPercent = Math.round((completedOnboarding / onboardingSteps.length) * 100);

  return (
    <div className="space-y-8">
      <section className="card space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.32em]" style={{ color: "var(--color-primary)" }}>
          {restaurantName}
        </p>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Painel principal do {restaurantName}</h1>
          <p className="max-w-3xl text-sm text-muted">
            Aqui fica apenas o que pertence ao restaurante: operacao de mesas, cardapio, estoque, financeiro,
            DRE e atendimento.
          </p>
        </div>
      </section>

      {billing?.hasBilling ? (
        <section className="card space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em]" style={{ color: "var(--color-primary)" }}>
                Assinatura do sistema
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {billing.status === "TRIAL" ? `Teste gratis: ${Math.max(billing.daysToDue ?? 0, 0)} dia(s) restante(s)` : billing.planName}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Plano {billing.planName} de {formatMoney(billing.monthlyFee ?? 0)}. Vencimento: {billing.nextDueDate ? new Date(billing.nextDueDate).toLocaleDateString("pt-BR") : "nao informado"}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {billing.paymentMethods?.map((method) => (
                <button key={method.id} className="btn-secondary" type="button" onClick={() => requestCheckout(method.id)}>
                  Pagar com {method.label}
                </button>
              ))}
            </div>
          </div>
          {billingCheckout ? (
            <div className="rounded-2xl p-4 text-sm surface-soft space-y-3">
              <p className="font-semibold">{billingCheckout.message}</p>
              {billingCheckout.amount ? <p>Valor: {formatMoney(billingCheckout.amount)}</p> : null}
              {billingCheckout.dueDate ? <p>Vencimento: {new Date(billingCheckout.dueDate).toLocaleDateString("pt-BR")}</p> : null}
              {billingCheckout.checkoutUrl ? (
                <a className="btn-secondary inline-flex" href={billingCheckout.checkoutUrl} target="_blank" rel="noreferrer">
                  Abrir checkout
                </a>
              ) : null}
              {billingCheckout.qrCodeDataUrl ? (
                <div className="space-y-2">
                  <img src={billingCheckout.qrCodeDataUrl} alt="QR Code Pix da assinatura" className="w-52 rounded-xl border" style={{ borderColor: "var(--color-border)" }} />
                  {billingCheckout.copyPasteCode ? (
                    <textarea readOnly className="input min-h-24 text-xs" value={billingCheckout.copyPasteCode} />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em]" style={{ color: "var(--color-primary)" }}>
              Tutorial guiado
            </p>
            <h2 className="mt-2 text-2xl font-bold">Primeiros passos para colocar o restaurante no ar</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              Siga esta trilha uma vez. O sistema marca automaticamente o que ja foi configurado e leva direto para cada tela.
            </p>
          </div>
          <div className="min-w-[180px] rounded-3xl p-4 text-center surface-soft">
            <p className="text-xs text-muted">Progresso</p>
            <strong className="mt-1 block text-3xl">{onboardingPercent}%</strong>
            <p className="text-xs text-muted">{completedOnboarding} de {onboardingSteps.length} passos</p>
          </div>
        </div>

        <div className="h-3 overflow-hidden rounded-full surface-soft">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${onboardingPercent}%`, background: "var(--color-primary)" }}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {onboardingSteps.map((step, index) => (
            <div key={step.id} className="rounded-[1.5rem] border p-4" style={{ borderColor: "var(--color-border)", background: step.done ? "color-mix(in srgb, #22c55e 10%, var(--color-surface))" : "var(--color-surface)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--color-primary)" }}>
                    Passo {index + 1}
                  </span>
                  <h3 className="mt-1 font-bold">{step.title}</h3>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: step.done ? "#dcfce7" : "var(--color-surface-alt)", color: step.done ? "#166534" : "var(--color-text)" }}>
                  {step.done ? "Concluido" : "Pendente"}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted">{step.description}</p>
              <Link to={step.to} className={step.done ? "btn-secondary mt-4 inline-flex" : "btn-primary mt-4 inline-flex"}>
                {step.action}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <div className="card sm:col-span-2 xl:col-span-4">Carregando indicadores...</div>
        ) : (
          <>
            <div className="card">
              <p className="text-sm text-muted">Faturamento do dia</p>
              <h2 className="mt-2 text-3xl font-bold">{formatMoney(dashboard?.salesToday ?? 0)}</h2>
            </div>
            <div className="card">
              <p className="text-sm text-muted">Mesas em aberto</p>
              <h2 className="mt-2 text-3xl font-bold">{dashboard?.openTables ?? 0}</h2>
            </div>
            <div className="card">
              <p className="text-sm text-muted">Lucro bruto estimado</p>
              <h2 className="mt-2 text-3xl font-bold">{formatMoney(dashboard?.estimatedGrossProfit ?? 0)}</h2>
            </div>
            <div className="card">
              <p className="text-sm text-muted">Itens no cardapio</p>
              <h2 className="mt-2 text-3xl font-bold">{dashboard?.totalProducts ?? 0}</h2>
            </div>
          </>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold">Operacao integrada</h2>
          <p className="text-sm text-muted">
            Venda, estoque, despesas e DRE precisam conversar entre si. Os atalhos abaixo vao direto no que o
            restaurante usa de verdade.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {operationTiles.map((tile) => (
            <Link
              key={tile.to}
              to={tile.to}
              className="card flex gap-4 transition hover:translate-y-[-2px] hover:shadow-card"
            >
              <div className="text-4xl" aria-hidden>
                {tile.emoji}
              </div>
              <div>
                <p className="text-lg font-bold">{tile.title}</p>
                <p className="mt-1 text-sm text-muted">{tile.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card space-y-4">
          <div>
            <h2 className="text-xl font-bold">Leitura rapida da DRE</h2>
            <p className="text-sm text-muted">
              A DRE geral consolida vendas, custos e despesas. A DRE por produto fica na tela completa.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.6rem] p-4 surface-soft">
              <p className="text-sm text-muted">Receita liquida do periodo</p>
              <strong className="mt-2 block text-2xl">{formatMoney(dre?.storeSummary.netRevenue ?? 0)}</strong>
            </div>
            <div className="rounded-[1.6rem] p-4 surface-soft">
              <p className="text-sm text-muted">CMV / custo dos produtos</p>
              <strong className="mt-2 block text-2xl">{formatMoney(dre?.storeSummary.productCost ?? 0)}</strong>
            </div>
            <div className="rounded-[1.6rem] p-4 surface-soft">
              <p className="text-sm text-muted">Lucro bruto</p>
              <strong className="mt-2 block text-2xl">{formatMoney(dre?.storeSummary.grossProfit ?? 0)}</strong>
            </div>
            <div className="rounded-[1.6rem] p-4 surface-soft">
              <p className="text-sm text-muted">Resultado operacional</p>
              <strong className="mt-2 block text-2xl">{formatMoney(dre?.storeSummary.operationalResult ?? 0)}</strong>
            </div>
          </div>

          <Link to="/painel-dono/dre" className="btn-primary w-full">
            Abrir DRE geral e DRE por produto
          </Link>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="text-xl font-bold">Acessos de apoio</h2>
            <p className="text-sm text-muted">Ferramentas complementares do restaurante, sem misturar a sua gestao SaaS.</p>
          </div>

          <div className="grid gap-2">
            {supportTiles.map((tile) => (
              <Link
                key={tile.to}
                to={tile.to}
                className="rounded-[1.25rem] border px-4 py-3 text-sm font-semibold transition hover:bg-black/[0.04]"
                style={{ borderColor: "var(--color-border)" }}
              >
                {tile.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold">Assistente operacional do restaurante</h2>
          <p className="text-sm text-muted">
            O sistema agora destaca prioridades reais com base nos dados do proprio restaurante, sem depender de automacao externa para o nucleo do produto.
          </p>
        </div>
        {!agentCenter || agentCenter.recommendations.length === 0 ? (
          <div className="rounded-[1.6rem] p-4 surface-soft text-sm text-muted">
            Nenhum alerta importante por agora. A base operacional esta pronta para seguir com as proximas rotinas.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {agentCenter.recommendations.map((item) => (
              <div key={item.id} className="rounded-[1.6rem] border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong>{item.title}</strong>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background:
                        item.severity === "ALTA"
                          ? "color-mix(in srgb, #dc2626 12%, white)"
                          : item.severity === "MEDIA"
                            ? "color-mix(in srgb, #f59e0b 18%, white)"
                            : "color-mix(in srgb, #22c55e 14%, white)"
                    }}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted">{item.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--color-primary)" }}>
                    {item.sourceAgent}
                  </span>
                  <Link to={item.actionPath} className="btn-secondary">
                    {item.actionLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
