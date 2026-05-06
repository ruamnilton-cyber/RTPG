import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
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
  if (action === "created" || action === "supply_created_and_purchased")
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Criado</span>;
  if (action === "updated" || action === "purchase_added")
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Atualizado</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">Sem alteração</span>;
}

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(",");
      const mime = header.split(":")[1].split(";")[0];
      resolve({ base64, mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AiImportPage() {
  const { token } = useAuth();

  // Menu state
  const [menuText, setMenuText] = useState("");
  const [menuImage, setMenuImage] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [menuDry, setMenuDry] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuResult, setMenuResult] = useState<MenuImportResponse | null>(null);
  const [menuError, setMenuError] = useState("");
  const menuFileRef = useRef<HTMLInputElement>(null);

  // Invoice state
  const [invoiceText, setInvoiceText] = useState("");
  const [invoiceSupplier, setInvoiceSupplier] = useState("");
  const [invoiceDry, setInvoiceDry] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<InvoiceImportResponse | null>(null);
  const [invoiceError, setInvoiceError] = useState("");

  // Global paste listener — captures Ctrl+V anywhere on this page
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgItem = items.find((i) => i.type.startsWith("image/"));
      if (!imgItem) return;
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (file) await applyImageFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function applyImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const { base64, mime } = await fileToBase64(file);
    const preview = URL.createObjectURL(file);
    setMenuImage({ base64, mime, preview });
    setMenuText("");
    setMenuResult(null);
    setMenuError("");
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyImageFile(file);
  }

  function clearImage() {
    setMenuImage(null);
    setMenuResult(null);
    setMenuError("");
    if (menuFileRef.current) menuFileRef.current.value = "";
  }

  async function handleMenuSubmit(e: FormEvent) {
    e.preventDefault();
    if (!menuImage && menuText.trim().length < 5) return;
    setMenuLoading(true);
    setMenuError("");
    setMenuResult(null);
    try {
      const body = menuImage
        ? { image: menuImage.base64, imageMime: menuImage.mime, dryRun: menuDry }
        : { text: menuText, dryRun: menuDry };

      const data = await apiRequest<MenuImportResponse>("/catalog/import-menu", {
        method: "POST",
        token,
        body
      });
      setMenuResult(data);
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : "Erro desconhecido ao processar.");
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
      setInvoiceError(err instanceof Error ? err.message : "Erro desconhecido ao processar.");
    } finally {
      setInvoiceLoading(false);
    }
  }

  const canSubmitMenu = !!menuImage || menuText.trim().length >= 5;

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Importação por IA"
        subtitle="Envie a foto do cardápio — a IA lê, identifica os pratos e cadastra automaticamente"
      />

      {/* ── Menu Import ───────────────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-2">
        <form className="card space-y-4" onSubmit={handleMenuSubmit}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Leitura de Cardápio
            </p>
            <h3 className="mt-2 text-2xl font-bold">Importar cardápio por IA</h3>
          </div>

          {/* Image area */}
          {menuImage ? (
            <div className="relative rounded-3xl border overflow-hidden">
              <img src={menuImage.preview} alt="Cardápio" className="max-h-80 w-full object-contain bg-gray-50" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white text-sm hover:bg-black/80"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Primary: file button */}
              <button
                type="button"
                onClick={() => menuFileRef.current?.click()}
                className="btn-primary w-full py-4 text-base"
              >
                📸 Selecionar foto do cardápio
              </button>
              <input
                ref={menuFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <p className="text-center text-xs text-muted">
                ou pressione <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">Ctrl+V</kbd> para colar uma imagem copiada
              </p>

              {/* Divider */}
              <div className="flex items-center gap-3 text-xs text-muted pt-1">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                ou cole o texto abaixo
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>

              <textarea
                className="input min-h-[100px] resize-y font-mono text-sm"
                placeholder={"Pizza Margherita - R$39,90\nRisoto de funghi - R$52,00\n..."}
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3">
            <input type="checkbox" checked={menuDry} onChange={(e) => setMenuDry(e.target.checked)} />
            <span className="text-sm">
              <strong>Simulação</strong> — visualiza sem salvar no banco
            </span>
          </label>

          {menuError && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap break-words">
              ⚠️ {menuError}
            </div>
          )}

          <button className="btn-primary" disabled={menuLoading || !canSubmitMenu}>
            {menuLoading ? "⏳ Processando imagem..." : menuDry ? "Pré-visualizar" : "Importar cardápio"}
          </button>
        </form>

        {/* Result panel */}
        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Resultado
            </p>
            <h3 className="mt-2 text-2xl font-bold">Itens identificados</h3>
          </div>

          {!menuResult && !menuLoading && !menuError && (
            <div className="rounded-3xl p-6 surface-soft text-center text-sm text-muted space-y-2">
              <p className="text-2xl">📋</p>
              <p>Selecione a foto e clique em <strong>Pré-visualizar</strong>.</p>
              <p>Os itens do cardápio aparecem aqui antes de salvar.</p>
            </div>
          )}

          {menuLoading && (
            <div className="rounded-3xl p-6 surface-soft text-center text-sm text-muted animate-pulse space-y-2">
              <p className="text-2xl">🤖</p>
              <p>A IA está lendo o cardápio...</p>
            </div>
          )}

          {menuResult && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="font-semibold text-green-700">{menuResult.saved} criados</span>
                <span className="font-semibold text-blue-700">{menuResult.updated} atualizados</span>
                <span className="text-muted">{menuResult.skipped} sem alteração</span>
                <span className="text-muted">{menuResult.items.length} total</span>
              </div>
              {menuResult.items.length === 0 ? (
                <div className="rounded-3xl p-4 surface-soft text-sm text-muted">
                  Nenhum item identificado. Tente uma foto mais nítida ou use o campo de texto.
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                  {menuResult.items.map((item, i) => {
                    const r = menuResult.results?.[i];
                    return (
                      <div key={`${item.name}-${i}`} className="rounded-2xl border px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            {item.description && <p className="text-xs text-muted">{item.description}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-semibold">{item.price > 0 ? formatMoney(item.price) : "—"}</span>
                            {r && actionBadge(r.action)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <hr className="border-t border-dashed opacity-30" />

      {/* ── Invoice Import ────────────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-2">
        <form className="card space-y-4" onSubmit={handleInvoiceSubmit}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Leitura de Nota Fiscal
            </p>
            <h3 className="mt-2 text-2xl font-bold">Importar nota fiscal por IA</h3>
          </div>

          <input
            className="input"
            placeholder="Nome do fornecedor (opcional)"
            value={invoiceSupplier}
            onChange={(e) => setInvoiceSupplier(e.target.value)}
          />

          <textarea
            className="input min-h-[180px] resize-y font-mono text-sm"
            placeholder={"Tomate - 10 kg - R$5,00/kg\nCebola - 5 kg - R$3,50/kg\n..."}
            value={invoiceText}
            onChange={(e) => setInvoiceText(e.target.value)}
            required
          />

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3">
            <input type="checkbox" checked={invoiceDry} onChange={(e) => setInvoiceDry(e.target.checked)} />
            <span className="text-sm"><strong>Simulação</strong> — visualiza sem salvar no estoque</span>
          </label>

          {invoiceError && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">⚠️ {invoiceError}</div>
          )}

          <button className="btn-primary" disabled={invoiceLoading || invoiceText.trim().length < 10}>
            {invoiceLoading ? "⏳ Processando..." : invoiceDry ? "Pré-visualizar" : "Importar nota fiscal"}
          </button>
        </form>

        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Resultado
            </p>
            <h3 className="mt-2 text-2xl font-bold">Itens identificados</h3>
          </div>

          {!invoiceResult && !invoiceLoading && (
            <div className="rounded-3xl p-6 surface-soft text-center text-sm text-muted space-y-2">
              <p className="text-2xl">📦</p>
              <p>Cole o texto da nota fiscal e clique em <strong>Pré-visualizar</strong>.</p>
            </div>
          )}

          {invoiceLoading && (
            <div className="rounded-3xl p-4 surface-soft text-sm text-muted animate-pulse">A IA está lendo a nota...</div>
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
                  const r = invoiceResult.results?.[i];
                  return (
                    <div key={`${item.product}-${i}`} className="rounded-2xl border px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.product}</p>
                          <p className="text-xs text-muted">{item.quantity} un × {formatMoney(item.unit_cost)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold">{formatMoney(item.total_cost ?? item.quantity * item.unit_cost)}</span>
                          {r && actionBadge(r.action)}
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
