import { FormEvent, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type MenuResultItem = { name: string; action: "created" | "updated" | "skipped"; id: string };
type InvoiceResultItem = { product: string; action: string; supplyId: string };
type ParsedMenuItem = { name: string; description: string; price: number };
type ParsedInvoiceItem = { product: string; quantity: number; unit_cost: number; total_cost?: number };

type MenuImportResponse = {
  items: ParsedMenuItem[];
  results?: MenuResultItem[];
  saved: number;
  updated: number;
  skipped: number;
};

type InvoiceImportResponse = {
  items: ParsedInvoiceItem[];
  results?: InvoiceResultItem[];
  created: number;
  saved: number;
  skipped: number;
};

function actionBadge(action: string) {
  if (action === "created" || action === "supply_created_and_purchased") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Criado</span>;
  if (action === "updated" || action === "purchase_added") return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Atualizado</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">Sem alteração</span>;
}

export function AiImportPage() {
  const { token } = useAuth();

  // Menu state
  const [menuText, setMenuText] = useState("");
  const [menuDry, setMenuDry] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuResult, setMenuResult] = useState<MenuImportResponse | null>(null);
  const [menuError, setMenuError] = useState("");

  // Invoice state
  const [invoiceText, setInvoiceText] = useState("");
  const [invoiceSupplier, setInvoiceSupplier] = useState("");
  const [invoiceDry, setInvoiceDry] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<InvoiceImportResponse | null>(null);
  const [invoiceError, setInvoiceError] = useState("");

  async function handleMenuSubmit(e: FormEvent) {
    e.preventDefault();
    setMenuLoading(true);
    setMenuError("");
    setMenuResult(null);
    try {
      const data = await apiRequest<MenuImportResponse>("/catalog/import-menu", {
        method: "POST",
        token,
        body: { text: menuText, dryRun: menuDry }
      });
      setMenuResult(data);
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setMenuLoading(false);
    }
  }

  async function handleInvoiceSubmit(e: FormEvent) {
    e.preventDefault();
    setInvoiceLoading(true);
    setInvoiceError("");
    setInvoiceResult(null);
    try {
      const data = await apiRequest<InvoiceImportResponse>("/inventory/import-invoice", {
        method: "POST",
        token,
        body: { text: invoiceText, supplierName: invoiceSupplier || undefined, dryRun: invoiceDry }
      });
      setInvoiceResult(data);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setInvoiceLoading(false);
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Importação por IA"
        subtitle="Use inteligência artificial para cadastrar o cardápio ou importar notas fiscais automaticamente"
      />

      {/* Menu Import */}
      <section className="grid gap-6 xl:grid-cols-2">
        <form className="card space-y-4" onSubmit={handleMenuSubmit}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Leitura de Cardápio
            </p>
            <h3 className="mt-2 text-2xl font-bold">Importar cardápio por IA</h3>
            <p className="mt-1 text-sm text-muted">
              Cole ou digite o texto do cardápio. A IA identificará pratos, descrições e preços e os cadastrará automaticamente.
            </p>
          </div>

          <textarea
            className="input min-h-[180px] resize-y font-mono text-sm"
            placeholder={"Pizza Margherita - R$39,90\nMolho de tomate, mussarela e manjericão\n\nRisoto de funghi - R$52,00\n..."}
            value={menuText}
            onChange={(e) => setMenuText(e.target.value)}
            required
          />

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3">
            <input
              type="checkbox"
              checked={menuDry}
              onChange={(e) => setMenuDry(e.target.checked)}
            />
            <span className="text-sm">
              <strong>Simulação</strong> — só visualiza os itens, não salva no banco
            </span>
          </label>

          {menuError && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{menuError}</div>
          )}

          <button className="btn-primary" disabled={menuLoading || menuText.trim().length < 10}>
            {menuLoading ? "Processando..." : menuDry ? "Pré-visualizar" : "Importar cardápio"}
          </button>
        </form>

        {/* Menu result */}
        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Resultado
            </p>
            <h3 className="mt-2 text-2xl font-bold">Itens identificados</h3>
          </div>

          {!menuResult && !menuLoading && (
            <div className="rounded-3xl p-4 surface-soft text-sm text-muted">
              Nenhuma importação realizada ainda. Cole o texto do cardápio ao lado.
            </div>
          )}

          {menuLoading && (
            <div className="rounded-3xl p-4 surface-soft text-sm text-muted animate-pulse">
              A IA está lendo o cardápio...
            </div>
          )}

          {menuResult && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="font-semibold text-green-700">{menuResult.saved} criados</span>
                <span className="font-semibold text-blue-700">{menuResult.updated} atualizados</span>
                <span className="text-muted">{menuResult.skipped} sem alteração</span>
              </div>
              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {menuResult.items.map((item, i) => {
                  const resultItem = menuResult.results?.[i];
                  return (
                    <div key={`${item.name}-${i}`} className="rounded-2xl border px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {item.description && <p className="text-xs text-muted">{item.description}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold">{item.price > 0 ? formatMoney(item.price) : "—"}</span>
                          {resultItem && actionBadge(resultItem.action)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Divider */}
      <hr className="border-t border-dashed opacity-30" />

      {/* Invoice Import */}
      <section className="grid gap-6 xl:grid-cols-2">
        <form className="card space-y-4" onSubmit={handleInvoiceSubmit}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Leitura de Nota Fiscal
            </p>
            <h3 className="mt-2 text-2xl font-bold">Importar nota fiscal por IA</h3>
            <p className="mt-1 text-sm text-muted">
              Cole o texto da nota fiscal. A IA extrairá produtos, quantidades e custos para atualizar o estoque automaticamente.
            </p>
          </div>

          <input
            className="input"
            placeholder="Nome do fornecedor (opcional)"
            value={invoiceSupplier}
            onChange={(e) => setInvoiceSupplier(e.target.value)}
          />

          <textarea
            className="input min-h-[180px] resize-y font-mono text-sm"
            placeholder={"Tomate - 10 kg - R$5,00/kg\nCebola - 5 kg - R$3,50/kg\nMussarela - 2 kg - R$28,00/kg\n..."}
            value={invoiceText}
            onChange={(e) => setInvoiceText(e.target.value)}
            required
          />

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3">
            <input
              type="checkbox"
              checked={invoiceDry}
              onChange={(e) => setInvoiceDry(e.target.checked)}
            />
            <span className="text-sm">
              <strong>Simulação</strong> — só visualiza os itens, não salva no estoque
            </span>
          </label>

          {invoiceError && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{invoiceError}</div>
          )}

          <button className="btn-primary" disabled={invoiceLoading || invoiceText.trim().length < 10}>
            {invoiceLoading ? "Processando..." : invoiceDry ? "Pré-visualizar" : "Importar nota fiscal"}
          </button>
        </form>

        {/* Invoice result */}
        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Resultado
            </p>
            <h3 className="mt-2 text-2xl font-bold">Itens identificados</h3>
          </div>

          {!invoiceResult && !invoiceLoading && (
            <div className="rounded-3xl p-4 surface-soft text-sm text-muted">
              Nenhuma importação realizada ainda. Cole o texto da nota fiscal ao lado.
            </div>
          )}

          {invoiceLoading && (
            <div className="rounded-3xl p-4 surface-soft text-sm text-muted animate-pulse">
              A IA está lendo a nota fiscal...
            </div>
          )}

          {invoiceResult && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="font-semibold text-green-700">{invoiceResult.created} insumos criados</span>
                <span className="font-semibold text-blue-700">{invoiceResult.saved} entradas salvas</span>
                <span className="text-muted">{invoiceResult.skipped} ignorados</span>
              </div>
              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {invoiceResult.items.map((item, i) => {
                  const resultItem = invoiceResult.results?.[i];
                  return (
                    <div key={`${item.product}-${i}`} className="rounded-2xl border px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.product}</p>
                          <p className="text-xs text-muted">
                            {item.quantity} un × {formatMoney(item.unit_cost)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold">
                            {formatMoney(item.total_cost ?? item.quantity * item.unit_cost)}
                          </span>
                          {resultItem && actionBadge(resultItem.action)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
