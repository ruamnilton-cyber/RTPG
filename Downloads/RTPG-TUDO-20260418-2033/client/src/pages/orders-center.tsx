import { useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type InboxPayload = {
  queue: Array<{
    id: string;
    type: "MESA_ABERTA" | "FECHAMENTO_PENDENTE";
    table: number;
    label: string;
    owner: string;
    itemsCount: number;
    total: number;
    openedAt: string;
  }>;
  calls: Array<{ id: string; table: number; createdAt: string; status: string }>;
  recentSales: Array<{ id: string; soldAt: string; user: string; total: number; finalAmount: number; itemsCount: number }>;
};

export function OrdersCenterPage() {
  const { token } = useAuth();
  const [data, setData] = useState<InboxPayload | null>(null);

  async function load() {
    const result = await apiRequest<InboxPayload>("/operations/inbox", { token });
    setData(result);
  }

  useEffect(() => {
    load();
  }, [token]);

  if (!data) {
    return <div className="card">Carregando central de pedidos...</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Central de pedidos" subtitle="Fila unica da operacao para mesas abertas, fechamentos pendentes, chamados e vendas recentes." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-muted">Operacoes em aberto</p>
          <h3 className="mt-2 text-3xl font-bold">{data.queue.filter((item) => item.type === "MESA_ABERTA").length}</h3>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Fechamentos pendentes</p>
          <h3 className="mt-2 text-3xl font-bold">{data.queue.filter((item) => item.type === "FECHAMENTO_PENDENTE").length}</h3>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Chamados ativos</p>
          <h3 className="mt-2 text-3xl font-bold">{data.calls.length}</h3>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card space-y-3">
          <h3 className="text-xl font-bold">Fila da operacao</h3>
          {data.queue.map((item) => (
            <div key={item.id} className="rounded-3xl p-4 surface-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <strong>{item.label}</strong>
                  <p className="text-sm text-muted">Responsavel: {item.owner}</p>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: item.type === "FECHAMENTO_PENDENTE" ? "color-mix(in srgb, #991b1b 14%, white)" : "var(--color-badge)" }}>
                  {item.type === "FECHAMENTO_PENDENTE" ? "Fechamento" : "Operacao"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
                <span>Mesa {item.table}</span>
                <span>{item.itemsCount} itens</span>
                <span>{formatMoney(item.total)}</span>
                <span>{formatDate(item.openedAt)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <div className="card space-y-3">
            <h3 className="text-xl font-bold">Chamados do salao</h3>
            {data.calls.length === 0 ? <p className="text-sm text-muted">Nenhum chamado pendente.</p> : data.calls.map((call) => (
              <div key={call.id} className="rounded-3xl p-4 surface-soft">
                <strong>Mesa {call.table}</strong>
                <p className="text-sm text-muted">{formatDate(call.createdAt)}</p>
              </div>
            ))}
          </div>

          <div className="card space-y-3">
            <h3 className="text-xl font-bold">Vendas recentes</h3>
            {data.recentSales.map((sale) => (
              <div key={sale.id} className="rounded-3xl p-4 surface-soft">
                <div className="flex items-center justify-between gap-3">
                  <strong>{formatMoney(sale.total)}</strong>
                  <span className="text-sm text-muted">{formatDate(sale.soldAt)}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{sale.user} • {sale.itemsCount} itens • resultado {formatMoney(sale.finalAmount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
