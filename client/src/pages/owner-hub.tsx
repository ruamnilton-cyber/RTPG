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
  const [loading, setLoading] = useState(true);
  const activeBar = bars.find((bar) => bar.id === activeBarId) ?? bars[0];
  const restaurantName = activeBar?.name || "Seu restaurante";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiRequest<DashboardData>("/reports/dashboard", { token }),
      apiRequest<DreResponse>("/reports/dre?period=mes", { token })
    ])
      .then(([dash, dreData]) => {
        if (!cancelled) {
          setDashboard(dash);
          setDre(dreData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboard(null);
          setDre(null);
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
    </div>
  );
}
