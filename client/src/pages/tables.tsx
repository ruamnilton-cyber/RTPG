import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type OrderStatus = "ABERTO" | "CONFIRMADO" | "EM_PREPARO" | "PRONTO" | "ENTREGUE" | "AGUARDANDO_PAGAMENTO" | "FECHADO" | "CANCELADO";
type TableItem = { id: string; number: number; name: string; status: "LIVRE" | "OCUPADA" | "AGUARDANDO_FECHAMENTO"; sessions: Array<{ id: string; subtotal: number; openedAt: string; items: Array<{ id: string }>; order?: { id: string; status: OrderStatus } | null }>; calls: Array<{ id: string }> };
type Category = { id: string; name: string };
type Product = { id: string; name: string; salePrice: number; active: boolean; description?: string | null; imageUrl?: string | null; categoryId?: string | null; category?: Category | null };
type OrderRow = {
  id: string;
  status: OrderStatus;
  channel: "SALAO" | "BALCAO" | "DELIVERY" | "WHATSAPP" | "QR";
  subtotal: number;
  totalAmount: number;
  deductionsAmount: number;
  serviceFeeAmount: number;
  items: Array<{ id: string; productId: string; quantity: number; notes?: string | null; product: Product; unitPrice: number; totalPrice: number }>;
};
type Session = { id: string; table: { number: number; name: string }; subtotal: number; openedAt: string; status: string; order?: OrderRow | null; items: Array<{ id: string; productId: string; quantity: number; notes?: string | null; product: Product; unitPrice: number }> };
type Call = { id: string; status: string; createdAt: string; table: { number: number } };
type SettingsPayload = { establishment?: { serviceFee?: number; serviceFeeLocked?: boolean } };
type PendingItem = { key: string; productId: string; product: Product; quantity: number; notes: string };
type PaymentMethod = "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO";
type ReceiptPayload = {
  tableNumber: number;
  openedAt: string;
  closedAt: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  deductionsAmount: number;
  serviceFeeAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
};

const quickNotesPresets = ["Sem gelo", "Bem passado", "Sem cebola", "Caprichar", "Sem pimenta"];
const tableBadge = (status: TableItem["status"]) => status === "LIVRE" ? { label: "Livre", background: "color-mix(in srgb, #16a34a 14%, white)" } : status === "AGUARDANDO_FECHAMENTO" ? { label: "Fechamento", background: "color-mix(in srgb, #dc2626 14%, white)" } : { label: "Ocupada", background: "color-mix(in srgb, #f59e0b 16%, white)" };
const orderStatusMeta: Record<OrderStatus, { label: string; background: string }> = {
  ABERTO: { label: "Rascunho", background: "color-mix(in srgb, #64748b 18%, white)" },
  CONFIRMADO: { label: "Recebido", background: "color-mix(in srgb, #2563eb 16%, white)" },
  EM_PREPARO: { label: "Em preparo", background: "color-mix(in srgb, #f59e0b 16%, white)" },
  PRONTO: { label: "Pronto", background: "color-mix(in srgb, #22c55e 16%, white)" },
  ENTREGUE: { label: "Entregue", background: "color-mix(in srgb, #14b8a6 16%, white)" },
  AGUARDANDO_PAGAMENTO: { label: "Pagamento", background: "color-mix(in srgb, #dc2626 14%, white)" },
  FECHADO: { label: "Fechado", background: "color-mix(in srgb, #111827 22%, white)" },
  CANCELADO: { label: "Cancelado", background: "color-mix(in srgb, #991b1b 22%, white)" }
};

function buildReceiptHtml(receipt: ReceiptPayload) {
  const rows = receipt.items
    .map(
      (item) => `
        <tr>
          <td>${item.name}</td>
          <td class="qty">${item.quantity}</td>
          <td class="money">${formatMoney(item.unitPrice)}</td>
          <td class="money">${formatMoney(item.total)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Cupom da mesa ${receipt.tableNumber}</title>
        <style>
          body { font-family: "Courier New", monospace; background: #fff; color: #111; margin: 0; padding: 16px; }
          .coupon { width: 78mm; margin: 0 auto; }
          .center { text-align: center; }
          h1, h2, p { margin: 0; }
          h1 { font-size: 16px; }
          .muted { font-size: 11px; margin-top: 4px; }
          .divider { border-top: 1px dashed #111; margin: 12px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          td { padding: 4px 0; vertical-align: top; }
          .qty { width: 28px; text-align: center; }
          .money { text-align: right; white-space: nowrap; }
          .totals { font-size: 12px; }
          .totals div { display: flex; justify-content: space-between; margin: 4px 0; }
          .grand { font-weight: 700; font-size: 15px; }
          @media print { body { padding: 0; } .coupon { width: auto; } }
        </style>
      </head>
      <body>
        <div class="coupon">
          <div class="center">
            <h1>RTPG GESTAO</h1>
            <p class="muted">Cupom nao fiscal</p>
            <p class="muted">Mesa ${receipt.tableNumber}</p>
            <p class="muted">Abertura: ${formatDate(receipt.openedAt)}</p>
            <p class="muted">Fechamento: ${formatDate(receipt.closedAt)}</p>
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <td><strong>Item</strong></td>
                <td class="qty"><strong>Qtd</strong></td>
                <td class="money"><strong>Unit.</strong></td>
                <td class="money"><strong>Total</strong></td>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="divider"></div>
          <div class="totals">
            <div><span>Subtotal</span><span>${formatMoney(receipt.subtotal)}</span></div>
            <div><span>Deducoes</span><span>${formatMoney(receipt.deductionsAmount)}</span></div>
            <div><span>Taxa de servico</span><span>${formatMoney(receipt.serviceFeeAmount)}</span></div>
            <div><span>Pagamento</span><span>${receipt.paymentMethod}</span></div>
            <div class="grand"><span>Total</span><span>${formatMoney(receipt.total)}</span></div>
          </div>
          <div class="divider"></div>
          <p class="center muted">Obrigado pela preferencia.</p>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `;
}

export function TablesPage() {
  const { token, user } = useAuth();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [deductionsAmount, setDeductionsAmount] = useState(0);
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(false);
  const [serviceFeePercent, setServiceFeePercent] = useState(0);
  const [defaultServiceFeeRate, setDefaultServiceFeeRate] = useState(0);
  const [serviceFeeLocked, setServiceFeeLocked] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [closingMode, setClosingMode] = useState(false);
  const [manageTablesMode, setManageTablesMode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [receiptIssued, setReceiptIssued] = useState(false);

  function openReceiptPrint(receipt: ReceiptPayload) {
    const popup = window.open("", "_blank", "width=420,height=760");
    if (!popup) {
      window.alert("Nao foi possivel abrir a janela do cupom. Verifique se o navegador bloqueou pop-up.");
      return;
    }
    popup.document.open();
    popup.document.write(buildReceiptHtml(receipt));
    popup.document.close();
  }

  function buildReceiptPayload(): ReceiptPayload | null {
    if (!session) return null;
    const serviceFeeAmount = serviceFeeEnabled ? Number(((session.subtotal * serviceFeePercent) / 100).toFixed(2)) : 0;
    return {
      tableNumber: session.table.number,
      openedAt: session.openedAt,
      closedAt: new Date().toISOString(),
      items: session.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.unitPrice) * item.quantity
      })),
      subtotal: session.subtotal,
      deductionsAmount,
      serviceFeeAmount,
      total: Math.max(0, session.subtotal - deductionsAmount + serviceFeeAmount),
      paymentMethod
    };
  }

  function issueReceipt() {
    const receiptPayload = buildReceiptPayload();
    if (!receiptPayload) return;
    openReceiptPrint(receiptPayload);
    setReceiptIssued(true);
  }

  async function load() {
    const [t, p, c, cat, s] = await Promise.allSettled([
      apiRequest<TableItem[]>("/operations/tables", { token }),
      apiRequest<Product[]>("/catalog/products?status=ativos", { token }),
      apiRequest<Call[]>("/operations/calls", { token }),
      apiRequest<Category[]>("/catalog/categories", { token }),
      apiRequest<SettingsPayload>("/settings", { token })
    ]);
    setTables(t.status === "fulfilled" ? t.value : []);
    setProducts(p.status === "fulfilled" ? p.value.filter((item) => item.active) : []);
    setCalls(c.status === "fulfilled" ? c.value.filter((item) => item.status === "PENDENTE") : []);
    setCategories(cat.status === "fulfilled" ? cat.value : []);
    setDefaultServiceFeeRate(s.status === "fulfilled" ? Number(s.value.establishment?.serviceFee ?? 0) : 0);
    setServiceFeeLocked(s.status === "fulfilled" ? Boolean(s.value.establishment?.serviceFeeLocked) : false);
  }

  async function loadSession(tableId: string) {
    const current = await apiRequest<Session | null>(`/operations/tables/${tableId}/session`, { token });
    setSession(current);
    return current;
  }

  useEffect(() => { load(); }, [token]);
  useEffect(() => {
    if (!selectedTable) return;
    const timer = window.setInterval(() => {
      loadSession(selectedTable.id);
      load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedTable?.id, token]);
  useEffect(() => {
    if (!session) return;
    if (defaultServiceFeeRate > 0) {
      setServiceFeeEnabled(true);
      setServiceFeePercent(defaultServiceFeeRate);
    } else {
      setServiceFeeEnabled(false);
      setServiceFeePercent(0);
    }
  }, [session?.id, defaultServiceFeeRate]);

  async function openTable(table: TableItem) {
    setSelectedTable(table);
    await apiRequest(`/operations/tables/${table.id}/session`, { method: "POST", token, body: {} });
    await loadSession(table.id);
    await load();
    setClosingMode(false);
    setReceiptIssued(false);
  }

  async function updateOrderStatus(status: OrderStatus) {
    if (!session?.order || !selectedTable) return;
    await apiRequest(`/orders/${session.order.id}/status`, {
      method: "PATCH",
      token,
      body: { status }
    });
    await loadSession(selectedTable.id);
    await load();
  }

  async function createTable() {
    const nextNumber = tables.length ? Math.max(...tables.map((table) => table.number)) + 1 : 1;
    const nameInput = window.prompt("Nome ou descricao da mesa", `Mesa ${nextNumber}`);
    if (!nameInput) return;
    try {
      await apiRequest("/operations/tables", {
        method: "POST",
        token,
        body: { number: nextNumber, name: nameInput }
      });
      await load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel criar a mesa.");
    }
  }

  async function deleteTable(table: TableItem) {
    if (!window.confirm(`Excluir ${table.name}?`)) return;
    try {
      await apiRequest(`/operations/tables/${table.id}`, { method: "DELETE", token });
      if (selectedTable?.id === table.id) {
        resetSelection();
      }
      await load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Nao foi possivel excluir a mesa.");
    }
  }

  function resetSelection() {
    setSelectedTable(null); setSession(null); setPendingItems([]); setQuantity(1); setNotes(""); setClosingMode(false); setDeductionsAmount(0); setPaymentMethod("PIX"); setReceiptIssued(false);
  }

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchCategory = selectedCategory === "all" || product.categoryId === selectedCategory;
    const normalized = search.trim().toLowerCase();
    const matchSearch = !normalized || product.name.toLowerCase().includes(normalized) || (product.description ?? "").toLowerCase().includes(normalized);
    return matchCategory && matchSearch;
  }), [products, search, selectedCategory]);

  function addPendingItem(product: Product, qty = quantity, noteValue = notes) {
    const normalizedNotes = noteValue.trim();
    const key = `${product.id}:${normalizedNotes}`;
    setPendingItems((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + qty } : item);
      return [...current, { key, productId: product.id, product, quantity: qty, notes: normalizedNotes }];
    });
    setQuantity(1); setNotes("");
  }

  function updatePendingItem(key: string, nextQuantity: number) {
    if (nextQuantity <= 0) return setPendingItems((current) => current.filter((item) => item.key !== key));
    setPendingItems((current) => current.map((item) => item.key === key ? { ...item, quantity: nextQuantity } : item));
  }

  async function commitPendingItems() {
    if (!session || pendingItems.length === 0) return;
    for (const item of pendingItems) {
      await apiRequest(`/operations/sessions/${session.id}/items`, { method: "POST", token, body: { productId: item.productId, quantity: item.quantity, notes: item.notes || null } });
    }
    if (selectedTable) await loadSession(selectedTable.id);
    setPendingItems([]); setReceiptIssued(false); await load();
  }

  async function updateItem(itemId: string, nextQuantity: number, currentNotes?: string | null) {
    if (!session || !selectedTable) return;
    if (nextQuantity <= 0) await apiRequest(`/operations/session-items/${itemId}`, { method: "DELETE", token });
    else await apiRequest(`/operations/session-items/${itemId}`, { method: "PUT", token, body: { quantity: nextQuantity, notes: currentNotes ?? null } });
    setReceiptIssued(false);
    await loadSession(selectedTable.id); await load();
  }

  async function removeItem(itemId: string) {
    if (!selectedTable) return;
    await apiRequest(`/operations/session-items/${itemId}`, { method: "DELETE", token });
    setReceiptIssued(false);
    await loadSession(selectedTable.id); await load();
  }

  async function requestClose() {
    if (!session) return;
    await apiRequest(`/operations/sessions/${session.id}/request-close`, { method: "POST", token, body: {} });
    setReceiptIssued(false);
    await load(); if (selectedTable) await loadSession(selectedTable.id); setClosingMode(true);
  }

  async function closeSession() {
    if (!session) return;
    if (!receiptIssued) {
      window.alert("Emita a notinha antes de confirmar o pagamento.");
      return;
    }
    const serviceFeeAmount = serviceFeeEnabled ? Number(((session.subtotal * serviceFeePercent) / 100).toFixed(2)) : 0;
    await apiRequest(`/operations/sessions/${session.id}/close`, { method: "POST", token, body: { deductionsAmount, serviceFeeAmount, paymentMethod } });
    resetSelection(); await load();
  }

  async function handleCall(callId: string) {
    await apiRequest(`/operations/calls/${callId}/handle`, { method: "POST", token, body: {} }); await load();
  }

  const pendingTotal = pendingItems.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0);
  const appliedServiceFeeAmount = session && serviceFeeEnabled ? Number(((session.subtotal * serviceFeePercent) / 100).toFixed(2)) : 0;
  const finalTotal = Math.max(0, (session?.subtotal ?? 0) - deductionsAmount + appliedServiceFeeAmount);

  return (
    <div className="space-y-5">
      <PageHeader title="Mesas e vendas" subtitle="Clique na mesa para abrir o cardapio em um painel por cima da tela." />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Mesas</h3>
              <p className="text-sm text-muted">A operacao abre em painel sobreposto.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">{tables.length}</span>
              {user?.role === "ADMIN" ? (
                <>
                  <button
                    className={`btn-secondary px-3 py-2 text-sm ${manageTablesMode ? "ring-2 ring-[var(--color-primary)]" : ""}`}
                    type="button"
                    onClick={() => setManageTablesMode((current) => !current)}
                  >
                    🗑 Excluir mesa
                  </button>
                  <button className="btn-primary px-3 py-2 text-sm" type="button" onClick={createTable}>
                    + Mesa
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tables.map((table) => {
              const badge = tableBadge(table.status);
              const orderStatus = table.sessions[0]?.order?.status;
              const orderBadge = orderStatus ? orderStatusMeta[orderStatus] : null;
              return (
                <div key={table.id} className="rounded-[1.6rem] border p-4 transition hover:scale-[1.01]" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong>{`Mesa ${table.number}`}</strong>
                        <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: badge.background }}>{badge.label}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted">{table.name}</p>
                      {orderBadge ? (
                        <p className="mt-2">
                          <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: orderBadge.background }}>
                            Pedido: {orderBadge.label}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    {user?.role === "ADMIN" && manageTablesMode ? (
                      <button className="btn-secondary px-3 py-2 text-sm text-red-700" type="button" onClick={() => deleteTable(table)}>
                        Excluir
                      </button>
                    ) : null}
                  </div>
                  <button type="button" className="w-full text-left" onClick={() => openTable(table)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Abrir operacao da mesa</span>
                    <span className="text-xs text-muted">Clique</span>
                  </div>
                  <p className="mt-2 text-xs text-muted">Itens em aberto: {table.sessions[0]?.items.length ?? 0}</p>
                  {table.calls[0] ? <p className="mt-1 text-xs font-semibold text-red-700">Chamado pendente</p> : null}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="card">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Chamados</h3><span className="text-sm text-muted">{calls.length}</span></div>
          {calls.length === 0 ? <EmptyState message="Nenhum chamado pendente." /> : (
            <div className="space-y-3">
              {calls.map((call) => (
                <div key={call.id} className="rounded-[1.4rem] p-4 surface-soft">
                  <p className="font-semibold">Mesa {call.table.number}</p>
                  <p className="text-sm text-muted">{formatDate(call.createdAt)}</p>
                  <button className="btn-secondary mt-3" onClick={() => handleCall(call.id)}>Marcar como atendido</button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {selectedTable ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]">
          <div className="flex h-full w-full items-center justify-center p-4">
            <div className="flex h-[92vh] w-full max-w-[1560px] flex-col overflow-hidden rounded-[2rem] border shadow-2xl" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--color-primary)" }}>Operacao da mesa</p>
                  <h3 className="mt-2 text-2xl font-bold">{`Mesa ${selectedTable.number}`}</h3>
                  <p className="text-sm text-muted">{session ? `Comanda aberta em ${formatDate(session.openedAt)}. Lance itens a vontade e cobre apenas no fim.` : "Abrindo comanda da mesa..."}</p>
                  {session?.order ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-sm font-semibold"
                        style={{ background: orderStatusMeta[session.order.status].background }}
                      >
                        Pedido {orderStatusMeta[session.order.status].label}
                      </span>
                      <span className="text-xs text-muted">Canal {session.order.channel}</span>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {closingMode ? <button className="btn-secondary" onClick={() => setClosingMode(false)}>Voltar para comanda</button> : <button className="btn-secondary" onClick={() => setClosingMode(true)} disabled={!session}>Levar para pagamento</button>}
                  <button className="btn-secondary" onClick={resetSelection}>Fechar painel</button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 xl:grid-cols-[1fr_390px]">
                <section className="min-h-0 overflow-y-auto p-5">
                  {!closingMode ? (
                    <div className="space-y-5">
                      <div className="card space-y-4">
                        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                          <input className="input" placeholder="Buscar item no cardapio..." value={search} onChange={(e) => setSearch(e.target.value)} />
                          <select className="input" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                            <option value="all">Todas as categorias</option>
                            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className={selectedCategory === "all" ? "btn-primary" : "btn-secondary"} onClick={() => setSelectedCategory("all")}>Todos</button>
                          {categories.map((category) => <button key={category.id} className={selectedCategory === category.id ? "btn-primary" : "btn-secondary"} onClick={() => setSelectedCategory(category.id)}>{category.name}</button>)}
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredProducts.map((product) => (
                          <button key={product.id} type="button" className="card overflow-hidden text-left transition hover:scale-[1.01]" style={{ border: "1px solid var(--color-border)" }} onClick={() => addPendingItem(product, 1, "")}>
                            {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-40 w-full rounded-2xl object-cover" /> : <div className="flex h-40 items-center justify-center rounded-2xl surface-soft text-sm text-muted">Sem imagem</div>}
                            <div className="mt-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div><h4 className="text-lg font-bold">{product.name}</h4><p className="text-sm text-muted">{product.category?.name ?? "Sem categoria"}</p></div>
                                <strong>{formatMoney(product.salePrice)}</strong>
                              </div>
                              <p className="line-clamp-2 text-sm text-muted">{product.description || "Sem descricao cadastrada."}</p>
                              <span className="btn-primary inline-flex w-full items-center justify-center">Adicionar na comanda</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      {filteredProducts.length === 0 ? <div className="card"><EmptyState message="Nenhum item encontrado para este filtro." /></div> : null}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div><p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--color-primary)" }}>Pagamento</p><h3 className="mt-2 text-2xl font-bold">Pagamento da mesa {session?.table.number}</h3><p className="text-sm text-muted">Aqui voce confere a comanda, recebe o pagamento e encerra o atendimento.</p></div>
                      {session?.items.length ? (
                        <div className="space-y-3">
                          {session.items.map((item) => (
                            <div key={item.id} className="rounded-[1.5rem] p-4 surface-soft">
                              <div className="flex items-start justify-between gap-3">
                                <div><strong>{item.product.name}</strong><p className="text-sm text-muted">{item.quantity} x {formatMoney(item.unitPrice)}</p>{item.notes ? <p className="mt-1 text-sm text-muted">{item.notes}</p> : null}</div>
                                <strong>{formatMoney(Number(item.unitPrice) * item.quantity)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <EmptyState message="Nao existem itens lancados para fechar esta conta." />}
                    </div>
                  )}
                </section>

                <aside className="min-h-0 overflow-y-auto border-l p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                  {!closingMode ? (
                    <div className="space-y-5">
                      <section className="card space-y-4">
                        <div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-bold">Lancamento atual</h3><p className="text-sm text-muted">Varios cliques, uma comanda so.</p></div><strong>{formatMoney(pendingTotal)}</strong></div>
                        <div className="rounded-[1.5rem] p-4 surface-soft">
                          <div className="flex items-center gap-2">
                            <button className="btn-secondary" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>-</button>
                            <span className="min-w-8 text-center font-semibold">{quantity}</span>
                            <button className="btn-secondary" onClick={() => setQuantity((current) => current + 1)}>+</button>
                          </div>
                          <textarea className="input mt-3 min-h-24" placeholder="Observacao para o proximo clique no cardapio" value={notes} onChange={(e) => setNotes(e.target.value)} />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {quickNotesPresets.map((notePreset) => <button key={notePreset} className="btn-secondary" onClick={() => setNotes((current) => current ? `${current} | ${notePreset}` : notePreset)}>{notePreset}</button>)}
                          </div>
                        </div>
                        {pendingItems.length === 0 ? <EmptyState message="Nenhum item aguardando lancamento." /> : (
                          <div className="space-y-3">
                            {pendingItems.map((item) => (
                              <div key={item.key} className="rounded-[1.4rem] p-4 surface-soft">
                                <div className="flex items-start justify-between gap-3">
                                  <div><strong>{item.product.name}</strong><p className="text-sm text-muted">{formatMoney(item.product.salePrice)} por unidade</p>{item.notes ? <p className="mt-1 text-sm text-muted">{item.notes}</p> : null}</div>
                                  <strong>{formatMoney(item.product.salePrice * item.quantity)}</strong>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <button className="btn-secondary" onClick={() => updatePendingItem(item.key, item.quantity - 1)}>-</button>
                                    <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
                                    <button className="btn-secondary" onClick={() => updatePendingItem(item.key, item.quantity + 1)}>+</button>
                                  </div>
                                  <button className="text-sm font-semibold text-red-700" onClick={() => updatePendingItem(item.key, 0)}>Remover</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button className="btn-primary w-full" onClick={commitPendingItems} disabled={!session || pendingItems.length === 0}>Lancar tudo na comanda</button>
                      </section>

                      <section className="card space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div><h3 className="text-xl font-bold">Comanda</h3><p className="text-sm text-muted">{session ? `Mesa ${session.table.number} aberta em ${formatDate(session.openedAt)}` : "Selecione uma mesa para comecar."}</p></div>
                          {session ? <span className="rounded-full px-3 py-2 text-sm font-semibold" style={{ background: "color-mix(in srgb, var(--color-primary) 12%, white)" }}>{session.status}</span> : null}
                        </div>
                        {session?.order ? (
                          <div className="rounded-[1.5rem] p-4 surface-soft space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">Status do pedido</p>
                                <p className="text-xs text-muted">A equipe pode acompanhar e avancar a operacao da mesa por aqui.</p>
                              </div>
                              <span
                                className="rounded-full px-3 py-1 text-sm font-semibold"
                                style={{ background: orderStatusMeta[session.order.status].background }}
                              >
                                {orderStatusMeta[session.order.status].label}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button className="btn-secondary" type="button" onClick={() => updateOrderStatus("CONFIRMADO")} disabled={session.order.status === "CONFIRMADO" || session.order.status === "EM_PREPARO" || session.order.status === "PRONTO" || session.order.status === "ENTREGUE" || session.order.status === "AGUARDANDO_PAGAMENTO" || session.order.status === "FECHADO"}>
                                Recebido
                              </button>
                              <button className="btn-secondary" type="button" onClick={() => updateOrderStatus("EM_PREPARO")} disabled={session.order.status === "EM_PREPARO" || session.order.status === "PRONTO" || session.order.status === "ENTREGUE" || session.order.status === "AGUARDANDO_PAGAMENTO" || session.order.status === "FECHADO"}>
                                Em preparo
                              </button>
                              <button className="btn-secondary" type="button" onClick={() => updateOrderStatus("PRONTO")} disabled={session.order.status === "PRONTO" || session.order.status === "ENTREGUE" || session.order.status === "AGUARDANDO_PAGAMENTO" || session.order.status === "FECHADO"}>
                                Pronto
                              </button>
                              <button className="btn-secondary" type="button" onClick={() => updateOrderStatus("ENTREGUE")} disabled={session.order.status === "ENTREGUE" || session.order.status === "AGUARDANDO_PAGAMENTO" || session.order.status === "FECHADO"}>
                                Entregue
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {!session ? <EmptyState message="A comanda aparece aqui assim que voce escolher uma mesa." /> : session.items.length === 0 ? <EmptyState message="Nenhum item lancado ainda nesta mesa." /> : (
                          <div className="space-y-3">
                            {session.items.map((item) => (
                              <div key={item.id} className="rounded-[1.4rem] p-4 surface-soft">
                                <div className="flex items-start justify-between gap-3">
                                  <div><strong>{item.product.name}</strong><p className="text-sm text-muted">{formatMoney(item.unitPrice)} por unidade</p>{item.notes ? <p className="mt-1 text-sm text-muted">{item.notes}</p> : null}</div>
                                  <strong>{formatMoney(Number(item.unitPrice) * item.quantity)}</strong>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <button className="btn-secondary" onClick={() => updateItem(item.id, item.quantity - 1, item.notes)}>-</button>
                                    <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
                                    <button className="btn-secondary" onClick={() => updateItem(item.id, item.quantity + 1, item.notes)}>+</button>
                                  </div>
                                  <button className="text-sm font-semibold text-red-700" onClick={() => removeItem(item.id)}>Remover</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {session ? (
                          <div className="rounded-[1.5rem] p-4" style={{ background: "color-mix(in srgb, var(--color-primary) 7%, white)" }}>
                            <p className="text-sm text-muted">Subtotal atual</p><p className="text-3xl font-bold">{formatMoney(session.subtotal)}</p>
                            <div className="mt-4 grid gap-3">
                              <button className="btn-secondary" onClick={requestClose} disabled={session.items.length === 0}>Gerar comanda</button>
                              <button className="btn-primary" onClick={() => setClosingMode(true)} disabled={session.items.length === 0}>Levar para pagamento</button>
                            </div>
                          </div>
                        ) : null}
                      </section>
                    </div>
                  ) : (
                    <section className="card space-y-4">
                      <div className="rounded-[1.75rem] p-4 surface-soft space-y-3">
                        <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted">Subtotal</span><strong>{formatMoney(session?.subtotal ?? 0)}</strong></div>
                        <div className="grid gap-2">
                          <label className="label">Forma de pagamento</label>
                          <select className="input" value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value as PaymentMethod); setReceiptIssued(false); }}>
                            <option value="PIX">PIX</option>
                            <option value="CREDITO">Cartao de credito</option>
                            <option value="DEBITO">Cartao de debito</option>
                            <option value="DINHEIRO">Dinheiro</option>
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <label className="label">Deducoes da conta</label>
                          <input className="input" type="number" step="0.01" value={deductionsAmount} onChange={(e) => { setDeductionsAmount(Number(e.target.value)); setReceiptIssued(false); }} />
                        </div>
                        <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3" style={{ borderColor: "var(--color-border)" }}>
                          <div><strong className="block">Taxa de servico</strong><p className="text-sm text-muted">{serviceFeeLocked ? "O percentual da taxa esta travado, mas voce pode decidir cobrar ou nao nesta conta." : "Marque se deseja cobrar e ajuste o percentual se precisar."}</p></div>
                          <input type="checkbox" checked={serviceFeeEnabled} onChange={(e) => { setServiceFeeEnabled(e.target.checked); setReceiptIssued(false); }} />
                        </label>
                        <div className="grid gap-2">
                          <label className="label">Percentual da taxa de servico</label>
                          <input className="input" type="number" step="0.01" value={serviceFeePercent} onChange={(e) => { setServiceFeePercent(Number(e.target.value)); setReceiptIssued(false); }} disabled={!serviceFeeEnabled || serviceFeeLocked} />
                          {defaultServiceFeeRate > 0 ? <p className="text-xs text-muted">Padrao do estabelecimento: {defaultServiceFeeRate}%{serviceFeeLocked ? " com percentual travado." : "."}</p> : null}
                        </div>
                        <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted">Valor da taxa</span><strong>{formatMoney(appliedServiceFeeAmount)}</strong></div>
                        <div className="flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--color-border)" }}><span className="text-base font-semibold">Total final</span><strong className="text-3xl">{formatMoney(finalTotal)}</strong></div>
                      </div>
                      <div className="grid gap-3">
                        <button className="btn-secondary w-full" onClick={issueReceipt} disabled={!session || session.items.length === 0}>
                          {receiptIssued ? "Reemitir notinha" : "Emitir notinha"}
                        </button>
                        <button className="btn-primary w-full" onClick={closeSession} disabled={!session || session.items.length === 0 || !receiptIssued}>
                          Confirmar pagamento e finalizar pedido
                        </button>
                        <p className="text-xs text-muted">
                          Primeiro emita a notinha para levar a mesa. Depois que o cliente pagar, confirme o pagamento para encerrar a comanda.
                        </p>
                      </div>
                    </section>
                  )}
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
