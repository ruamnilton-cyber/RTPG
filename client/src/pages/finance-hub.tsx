import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type FinanceTitle = {
  id: string;
  kind: "PAGAR" | "RECEBER";
  description: string;
  category: string;
  branchId: string;
  costCenter: string;
  amount: number;
  dueDate: string;
  status: "PENDENTE" | "PAGO" | "VENCIDO" | "CANCELADO" | "PARCIAL";
  counterparty: string;
  notes: string;
  createdAt: string;
};

type FinanceOverview = {
  cards: Array<{ label: string; value: number }>;
  statement: {
    revenue: number;
    cost: number;
    grossProfit: number;
    expenseTotal: number;
    payableOpen: number;
    receivableOpen: number;
    cashProjection: number;
  };
  payables: FinanceTitle[];
  receivables: FinanceTitle[];
  expensesByCategory: Record<string, number>;
};

export function FinanceHubPage() {
  const { token } = useAuth();
  const [data, setData] = useState<FinanceOverview | null>(null);

  async function load() {
    const result = await apiRequest<FinanceOverview>("/finance/overview", { token });
    setData(result);
  }

  useEffect(() => {
    load();
  }, [token]);

  if (!data) {
    return <div className="card">Carregando financeiro...</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Financeiro estrategico" subtitle="Fluxo de caixa, contas a pagar e receber e leitura gerencial pronta para decisao." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.cards.map((card) => (
          <div key={card.label} className="card">
            <p className="text-sm text-muted">{card.label}</p>
            <h3 className="mt-3 text-3xl font-bold">{formatMoney(card.value)}</h3>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <form
          className="card space-y-4"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            await apiRequest("/finance/titles", {
              method: "POST",
              token,
              body: {
                kind: String(formData.get("kind")),
                description: String(formData.get("description")),
                category: String(formData.get("category")),
                branchId: "branch-main",
                costCenter: String(formData.get("costCenter")),
                amount: Number(formData.get("amount")),
                dueDate: String(formData.get("dueDate")),
                status: "PENDENTE",
                counterparty: String(formData.get("counterparty") ?? ""),
                notes: String(formData.get("notes") ?? "")
              }
            });
            event.currentTarget.reset();
            load();
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Titulos financeiros</p>
            <h3 className="mt-2 text-2xl font-bold">Novo lancamento</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="input" name="kind" defaultValue="PAGAR">
              <option value="PAGAR">Conta a pagar</option>
              <option value="RECEBER">Conta a receber</option>
            </select>
            <input className="input" name="category" placeholder="Categoria" required />
            <input className="input md:col-span-2" name="description" placeholder="Descricao" required />
            <input className="input" name="counterparty" placeholder="Fornecedor / cliente" />
            <input className="input" name="costCenter" placeholder="Centro de custo" defaultValue="OPERACAO" />
            <input className="input" name="amount" type="number" step="0.01" placeholder="Valor" required />
            <input className="input" name="dueDate" type="date" required />
            <textarea className="input md:col-span-2 min-h-24" name="notes" placeholder="Observacoes" />
          </div>
          <button className="btn-primary">Salvar titulo</button>
        </form>

        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Saude financeira</p>
            <h3 className="mt-2 text-2xl font-bold">Resumo executivo</h3>
          </div>
          {[
            ["Lucro bruto", data.statement.grossProfit],
            ["Despesas operacionais", data.statement.expenseTotal],
            ["Em aberto para pagar", data.statement.payableOpen],
            ["Em aberto para receber", data.statement.receivableOpen],
            ["Fluxo projetado", data.statement.cashProjection]
          ].map(([label, value]) => (
            <div key={String(label)} className="flex items-center justify-between rounded-3xl p-4 surface-soft">
              <span>{label}</span>
              <strong>{formatMoney(Number(value))}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {[{ title: "Contas a pagar", items: data.payables }, { title: "Contas a receber", items: data.receivables }].map((group) => (
          <div key={group.title} className="card space-y-3">
            <h3 className="text-xl font-bold">{group.title}</h3>
            {group.items.map((item) => (
              <div key={item.id} className="rounded-3xl p-4 surface-soft">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong>{item.description}</strong>
                    <p className="text-sm text-muted">{item.category} • {item.counterparty || "Sem contraparte"}</p>
                  </div>
                  <div className="text-right">
                    <strong>{formatMoney(item.amount)}</strong>
                    <p className="text-xs text-muted">{formatDate(item.dueDate)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--color-badge)" }}>{item.status}</span>
                  {item.status !== "PAGO" ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/finance/titles/${item.id}`, {
                          method: "PATCH",
                          token,
                          body: { status: "PAGO" }
                        });
                        load();
                      }}
                    >
                      Marcar como pago
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
