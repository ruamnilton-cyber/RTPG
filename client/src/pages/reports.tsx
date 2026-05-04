import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type ExpenseCategory = {
  id: string;
  name: string;
  groupType: "OPERACIONAL" | "ADMINISTRATIVA" | "COMERCIAL" | "OUTRAS";
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  expenseDate: string;
  category: ExpenseCategory;
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
    salesRevenue?: number;
    manualRevenue?: number;
    deductions: number;
    netRevenue: number;
    productCost: number;
    grossProfit: number;
    operationalExpenses: number;
    operationalResult: number;
    previousRevenue: number;
    previousExpensesTotal: number;
    expensesByGroup: {
      operacional: number;
      administrativa: number;
      comercial: number;
      outras: number;
    };
    ebitda: number;
    lines: Array<{ label: string; value: number; percentage: number; kind: string }>;
  };
  perProduct: Array<{
    productId: string;
    productName: string;
    revenue: number;
    quantity: number;
    cost: number;
    grossProfit: number;
    grossMargin: number;
    averageTicket: number;
  }>;
  expenses: Expense[];
};

const productFormulaLines = [
  "Receita do produto = soma das vendas do item no período",
  "Despesa do produto = custo total do item pela ficha técnica",
  "Lucro bruto = receita - despesa",
  "Margem bruta = lucro bruto / receita",
  "Ticket médio = receita / quantidade vendida"
];

const storeFormulaLines = [
  "Receita líquida = receita bruta + receitas manuais - deduções",
  "Lucro bruto = receita líquida - CMV",
  "EBITDA = lucro bruto - despesas operacionais - administrativas - comerciais",
  "Resultado operacional = lucro bruto - despesas totais",
  "Resultado líquido = resultado operacional"
];

function FormulaPanel({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-3xl p-4 surface-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--color-primary)" }}>
        {title}
      </p>
      <div className="mt-3 space-y-2 text-sm text-muted">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { token, user } = useAuth();
  const [period, setPeriod] = useState("dia");
  const [tab, setTab] = useState<"produto" | "geral">("produto");
  const [dre, setDre] = useState<DreResponse | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  async function load() {
    const [dreData, categoriesData] = await Promise.all([
      apiRequest<DreResponse>(`/reports/dre?period=${period}`, { token }),
      apiRequest<ExpenseCategory[]>("/reports/expenses/categories", { token })
    ]);
    setDre(dreData);
    setCategories(categoriesData);
    if (!selectedProductId && dreData.perProduct[0]) {
      setSelectedProductId(dreData.perProduct[0].productId);
    }
  }

  useEffect(() => {
    load();

    const interval = window.setInterval(() => {
      load();
    }, 15000);

    const handleFocus = () => {
      load();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [token, period]);

  const selectedProduct = useMemo(
    () => dre?.perProduct.find((item) => item.productId === selectedProductId) ?? dre?.perProduct[0],
    [dre, selectedProductId]
  );

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await apiRequest("/reports/expenses/categories", {
      method: "POST",
      token,
      body: {
        name: String(formData.get("name")),
        groupType: String(formData.get("groupType"))
      }
    });
    event.currentTarget.reset();
    load();
  }

  async function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await apiRequest("/reports/expenses", {
      method: "POST",
      token,
      body: {
        categoryId: String(formData.get("categoryId")),
        description: String(formData.get("description")),
        amount: Number(formData.get("amount")),
        expenseDate: String(formData.get("expenseDate")),
        notes: String(formData.get("notes") || "")
      }
    });
    event.currentTarget.reset();
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financeiro e DRE"
        subtitle="DRE por produto e DRE geral da loja com atualização automática e fórmula visível."
        action={
          <select className="input max-w-[180px]" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="dia">Hoje</option>
            <option value="semana">Últimos 7 dias</option>
            <option value="mes">Mês</option>
          </select>
        }
      />

      <div className="flex gap-3">
        <button className={tab === "produto" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("produto")}>
          DRE por produto
        </button>
        <button className={tab === "geral" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("geral")}>
          DRE geral da loja
        </button>
      </div>

      {tab === "produto" ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="card">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Produtos</p><strong>{dre?.productSummary?.totalProducts ?? 0}</strong></div>
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Receita</p><strong>{formatMoney(dre?.productSummary?.totalRevenue ?? 0)}</strong></div>
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Despesa</p><strong>{formatMoney(dre?.productSummary?.totalCost ?? 0)}</strong></div>
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Lucro bruto</p><strong>{formatMoney(dre?.productSummary?.totalGrossProfit ?? 0)}</strong></div>
            </div>

            <div className="mt-5 space-y-3">
              {dre?.perProduct.length ? dre.perProduct.map((item) => (
                <button
                  key={item.productId}
                  onClick={() => setSelectedProductId(item.productId)}
                  className="flex w-full items-center justify-between rounded-3xl p-4 text-left transition"
                  style={{
                    background: selectedProduct?.productId === item.productId ? "var(--color-surface-alt)" : "transparent",
                    border: "1px solid var(--color-border)"
                  }}
                >
                  <div>
                    <strong>{item.productName}</strong>
                    <p className="text-sm text-muted">Qtd. vendida: {item.quantity}</p>
                  </div>
                  <span>{formatMoney(item.grossProfit)}</span>
                </button>
              )) : (
                <div className="space-y-4 rounded-3xl border border-dashed p-8" style={{ borderColor: "var(--color-border)" }}>
                  <EmptyState message="Ainda não há vendas por produto neste período, mas a estrutura da DRE já está pronta." />
                  <FormulaPanel title="Formula da DRE por produto" lines={productFormulaLines} />
                </div>
              )}
            </div>
          </div>

          <div className="card">
            {selectedProduct ? (
              <>
                <h3 className="text-2xl font-bold">{selectedProduct.productName}</h3>
                <p className="mt-2 text-sm text-muted">Resumo financeiro individual do item selecionado.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Receita total</p><strong>{formatMoney(selectedProduct.revenue)}</strong></div>
                  <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Despesa total</p><strong>{formatMoney(selectedProduct.cost)}</strong></div>
                  <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Lucro bruto</p><strong>{formatMoney(selectedProduct.grossProfit)}</strong></div>
                  <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Margem bruta</p><strong>{selectedProduct.grossMargin.toFixed(1)}%</strong></div>
                  <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Quantidade vendida</p><strong>{selectedProduct.quantity}</strong></div>
                  <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Ticket médio por item</p><strong>{formatMoney(selectedProduct.averageTicket)}</strong></div>
                </div>
                <div className="mt-5 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[selectedProduct]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="productName" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatMoney(value)} />
                      <Bar dataKey="revenue" fill="var(--color-primary)" name="Receita" />
                      <Bar dataKey="cost" fill="var(--color-accent)" name="Despesa" />
                      <Bar dataKey="grossProfit" fill="var(--color-secondary)" name="Lucro bruto" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5">
                  <FormulaPanel title="Formula da DRE por produto" lines={productFormulaLines} />
                </div>
              </>
            ) : (
              <div className="space-y-4 rounded-3xl border border-dashed p-8" style={{ borderColor: "var(--color-border)" }}>
                <EmptyState message="Escolha um produto do cardápio para visualizar sua DRE individual." />
                <FormulaPanel title="Formula da DRE por produto" lines={productFormulaLines} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="card">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Receita bruta</p><strong>{formatMoney(dre?.storeSummary?.revenue ?? 0)}</strong></div>
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Receitas manuais</p><strong>{formatMoney(dre?.storeSummary?.manualRevenue ?? 0)}</strong></div>
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Lucro bruto</p><strong>{formatMoney(dre?.storeSummary?.grossProfit ?? 0)}</strong></div>
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">EBITDA</p><strong>{formatMoney(dre?.storeSummary?.ebitda ?? 0)}</strong></div>
              <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Resultado líquido</p><strong>{formatMoney(dre?.storeSummary?.operationalResult ?? 0)}</strong></div>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl border" style={{ borderColor: "var(--color-border)" }}>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Linha do DRE</th>
                    <th>Valor</th>
                    <th>% sobre receita</th>
                  </tr>
                </thead>
                <tbody>
                  {dre?.storeSummary?.lines?.map((line) => (
                    <tr key={line.label} style={{ background: line.kind === "result" ? "var(--color-surface-alt)" : "transparent" }}>
                      <td><strong>{line.label}</strong></td>
                      <td>{formatMoney(line.value)}</td>
                      <td>{line.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5">
              <FormulaPanel title="Formula da DRE geral" lines={storeFormulaLines} />
            </div>
          </div>

          <div className="space-y-5">
            <form onSubmit={handleCreateCategory} className="card space-y-3">
              <h3 className="text-xl font-bold">Categorias de despesa</h3>
              <input className="input" name="name" placeholder="Nome da categoria" required />
              <select className="input" name="groupType" defaultValue="OPERACIONAL">
                <option value="OPERACIONAL">Despesa operacional</option>
                <option value="ADMINISTRATIVA">Despesa administrativa</option>
                <option value="COMERCIAL">Despesa comercial</option>
                <option value="OUTRAS">Outras receitas/despesas</option>
              </select>
              <button className="btn-primary" disabled={user?.role !== "ADMIN"}>Salvar categoria</button>
            </form>

            <form onSubmit={handleCreateExpense} className="card space-y-3">
              <h3 className="text-xl font-bold">Lançar despesa</h3>
              <select className="input" name="categoryId" required>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input className="input" name="description" placeholder="Descrição" required />
              <input className="input" name="amount" type="number" step="0.01" placeholder="Valor" required />
              <input className="input" name="expenseDate" type="datetime-local" required />
              <textarea className="input min-h-20" name="notes" placeholder="Observações" />
              <button className="btn-primary" disabled={user?.role !== "ADMIN"}>Salvar despesa</button>
            </form>

            <div className="card">
              <h3 className="text-xl font-bold">Comparativo rápido</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Receita período anterior</p><strong>{formatMoney(dre?.storeSummary?.previousRevenue ?? 0)}</strong></div>
                <div className="rounded-3xl p-4 surface-soft"><p className="text-xs text-muted">Despesas período anterior</p><strong>{formatMoney(dre?.storeSummary?.previousExpensesTotal ?? 0)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
