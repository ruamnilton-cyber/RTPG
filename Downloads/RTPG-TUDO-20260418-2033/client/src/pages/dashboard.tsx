import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type DashboardData = {
  salesToday: number;
  salesRevenue?: number;
  manualRevenue?: number;
  productCost?: number;
  totalStock: number;
  totalProducts: number;
  openTables: number;
  estimatedGrossProfit: number;
};

export function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiRequest<DashboardData>("/reports/dashboard", { token }).then(setData);
  }, [token]);

  const cards = useMemo(
    () => [
      { label: "Faturamento do dia", value: formatMoney(data?.salesToday ?? 0) },
      { label: "Lucro bruto estimado", value: formatMoney(data?.estimatedGrossProfit ?? 0) },
      { label: "Mesas em operação", value: String(data?.openTables ?? 0) },
      { label: "Itens no cardápio", value: String(data?.totalProducts ?? 0) },
      { label: "Estoque total", value: (data?.totalStock ?? 0).toFixed(2) }
    ],
    [data]
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard executivo" subtitle="Visão gerencial com leitura rápida da operação, rentabilidade e movimento do dia." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <p className="text-sm text-muted">{card.label}</p>
            <h3 className="mt-3 text-3xl font-bold">{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Visão de negócio</p>
          <h3 className="mt-2 text-2xl font-bold">Resumo premium da operação</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl p-4 surface-soft">
              <p className="text-xs text-muted">Produto mais vendido</p>
              <strong>Estrutura pronta para ranqueamento real</strong>
              <p className="mt-2 text-sm text-muted">Conecte volume por item e o dashboard passa a destacar automaticamente o campeão do período.</p>
            </div>
            <div className="rounded-3xl p-4 surface-soft">
              <p className="text-xs text-muted">Categoria mais vendida</p>
              <strong>Pronta para priorização comercial</strong>
              <p className="mt-2 text-sm text-muted">A nova arquitetura de categorias e DRE já deixa o sistema pronto para análise comparativa por mix.</p>
            </div>
            <div className="rounded-3xl p-4 surface-soft">
              <p className="text-xs text-muted">CMV estimado</p>
              <strong>{formatMoney(data?.productCost ?? 0)}</strong>
            </div>
            <div className="rounded-3xl p-4 surface-soft">
              <p className="text-xs text-muted">Status do salão</p>
              <strong>{(data?.openTables ?? 0) > 0 ? "Operando" : "Sem mesas abertas"}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Próximos módulos</p>
          <h3 className="mt-2 text-2xl font-bold">Arquitetura preparada</h3>
          <div className="mt-5 space-y-3">
            {[
              "KDS para cozinha e bar",
              "Caixa por operador e fechamento de turno",
              "CRM e fidelização",
              "Reservas com status e vínculo de mesas",
              "Central de relatórios e exportações",
              "Perfis avançados com RBAC expandido"
            ].map((item) => (
              <div key={item} className="rounded-3xl p-4 surface-soft">
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
