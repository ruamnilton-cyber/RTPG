import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type TableItem = { id: string; number: number; name: string; status: "LIVRE" | "OCUPADA" | "AGUARDANDO_FECHAMENTO"; sessions: Array<{ id: string; subtotal: number; openedAt: string; items: Array<{ id: string }> }>; calls: Array<{ id: string }> };
type Category = { id: string; name: string };
type Product = { id: string; name: string; salePrice: number; active: boolean; description?: string | null; imageUrl?: string | null; categoryId?: string | null; category?: Category | null };
type Session = { id: string; table: { number: number; name: string }; subtotal: number; openedAt: string; status: string; items: Array<{ id: string; productId: string; quantity: number; notes?: string | null; product: Product; unitPrice: number }> };
type Call = { id: string; status: string; createdAt: string; table: { number: number } };
type SettingsPayload = { establishment?: { serviceFee?: number; serviceFeeLocked?: boolean } };
type PendingItem = { key: string; productId: string; product: Product; quantity: number; notes: string };

const quickNotesPresets = ["Sem gelo", "Bem passado", "Sem cebola", "Caprichar", "Sem pimenta"];
const tableBadge = (status: TableItem["status"]) => status === "LIVRE" ? { label: "Livre", background: "color-mix(in srgb, #16a34a 14%, white)" } : status === "AGUARDANDO_FECHAMENTO" ? { label: "Fechamento", background: "color-mix(in srgb, #dc2626 14%, white)" } : { label: "Ocupada", background: "color-mix(in srgb, #f59e0b 16%, white)" };

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
  type PixModal = { paymentId: string; qrCode: string; qrCodeBase64: string | null; amount: number; status: "PENDENTE" | "PAGO" };
  const [pixModal, setPixModal] = useState<PixModal | null>(null);
  const pixPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setSelectedTable(null); setSession(null); setPendingItems([]); setQuantity(1); setNotes(""); setClosingMode(false); setDeductionsAmount(0);
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
    setPendingItems([]); await load();
  }

  async function updateItem(itemId: string, nextQuantity: number, currentNotes?: string | null) {
    if (!session || !selectedTable) return;
    if (nextQuantity <= 0) await apiRequest(`/operations/session-items/${itemId}`, { method: "DELETE", token });
    else await apiRequest(`/operations/session-items/${itemId}`, { method: "PUT", token, body: { quantity: nextQuantity, notes: currentNotes ?? null } });
    await loadSession(selectedTable.id); await load();
  }

  async function removeItem(itemId: string) {
    if (!selectedTable) return;
    await apiRequest(`/operations/session-items/${itemId}`, { method: "DELETE", token });
    await loadSession(selectedTable.id); await load();
  }

  async function requestClose() {
    if (!session) return;
    await apiRequest(`/operations/sessions/${session.id}/request-close`, { method: "POST", token, body: {} });
    await load(); if (selectedTable) await loadSession(selectedTable.id); setClosingMode(true);
  }

  async function closeSession() {
    if (!session) return;
    const serviceFeeAmount = serviceFeeEnabled ? Number(((session.subtotal * serviceFeePercent) / 100).toFixed(2)) : 0;
    await apiRequest(`/operations/sessions/${session.id}/close`, { method: "POST", token, body: { deductionsAmount, serviceFeeAmount } });
    resetSelection(); await load();
  }

  async function handleCall(callId: string) {
    await apiRequest(`/operations/calls/${callId}/handle`, { method: "POST", token, body: {} }); await load();
  }

  async function gerarPix() {
    if (!session) return;
    const serviceFeeAmount = serviceFeeEnabled ? Number(((session.subtotal * serviceFeePercent) / 100).toFixed(2)) : 0;
    const amount = Math.max(0, session.subtotal - deductionsAmount + serviceFeeAmount);
    const tableNumber = selectedTable?.number ?? "?";
    const data = await apiRequest<{ id: string; pixQrCode: string | null; pixQrCodeBase64: string | null; amount: number; status: string }>(
      "/payments/pix",
      { method: "POST", token, body: { amount, description: `Mesa ${tableNumber} – RTPG` } }
    );
    setPixModal({ paymentId: data.id, qrCode: data.pixQrCode ?? "", qrCodeBase64: data.pixQrCodeBase64, amount, status: "PENDENTE" });
    if (pixPollRef.current) clearInterval(pixPollRef.current);
    pixPollRef.current = setInterval(async () => {
      try {
        const status = await apiRequest<{ status: string }>(`/payments/${data.id}/status`, { token });
        if (status.status === "PAGO") {
          setPixModal((prev) => prev ? { ...prev, status: "PAGO" } : null);
          if (pixPollRef.current) clearInterval(pixPollRef.current);
        }
      } catch (_) {}
    }, 5000);
  }

  function fecharPixModal() {
    setPixModal(null);
    if (pixPollRef.current) clearInterval(pixPollRef.current);
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
              return (
                <div key={table.id} className="rounded-[1.6rem] border p-4 transition hover:scale-[1.01]" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong>{`Mesa ${table.number}`}</strong>
                        <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: badge.background }}>{badge.label}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted">{table.name}</p>
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
                </div>
                <div className="flex flex-wrap gap-2">
                  {closingMode ? <button className="btn-secondary" onClick={() => setClosingMode(false)}>Voltar para comanda</button> : <button className="btn-secondary" onClick={() => setClosingMode(true)} disabled={!session}>Ir para fechamento</button>}
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
                      <div><p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--color-primary)" }}>Fechamento</p><h3 className="mt-2 text-2xl font-bold">Resumo da conta da mesa {session?.table.number}</h3><p className="text-sm text-muted">Revise tudo antes de receber o pagamento.</p></div>
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
                              <button className="btn-secondary" onClick={requestClose} disabled={session.items.length === 0}>Preparar fechamento</button>
                              <button className="btn-primary" onClick={() => setClosingMode(true)} disabled={session.items.length === 0}>Fechar conta</button>
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
                          <label className="label">Deducoes da conta</label>
                          <input className="input" type="number" step="0.01" value={deductionsAmount} onChange={(e) => setDeductionsAmount(Number(e.target.value))} />
                        </div>
                        <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3" style={{ borderColor: "var(--color-border)" }}>
                          <div><strong className="block">Taxa de servico</strong><p className="text-sm text-muted">{serviceFeeLocked ? "O percentual da taxa esta travado, mas voce pode decidir cobrar ou nao nesta conta." : "Marque se deseja cobrar e ajuste o percentual se precisar."}</p></div>
                          <input type="checkbox" checked={serviceFeeEnabled} onChange={(e) => setServiceFeeEnabled(e.target.checked)} />
                        </label>
                        <div className="grid gap-2">
                          <label className="label">Percentual da taxa de servico</label>
                          <input className="input" type="number" step="0.01" value={serviceFeePercent} onChange={(e) => setServiceFeePercent(Number(e.target.value))} disabled={!serviceFeeEnabled || serviceFeeLocked} />
                          {defaultServiceFeeRate > 0 ? <p className="text-xs text-muted">Padrao do estabelecimento: {defaultServiceFeeRate}%{serviceFeeLocked ? " com percentual travado." : "."}</p> : null}
                        </div>
                        <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted">Valor da taxa</span><strong>{formatMoney(appliedServiceFeeAmount)}</strong></div>
                        <div className="flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--color-border)" }}><span className="text-base font-semibold">Total final</span><strong className="text-3xl">{formatMoney(finalTotal)}</strong></div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button className="btn-primary w-full" onClick={closeSession} disabled={!session || session.items.length === 0}>Confirmar fechamento da conta</button>
                        <button className="w-full rounded-2xl border-2 py-3 text-sm font-semibold" style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }} onClick={gerarPix} disabled={!session || session.items.length === 0} type="button">
                          Cobrar via Pix (Mercado Pago)
                        </button>
                      </div>
                    </section>
                  )}
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pixModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            {pixModal.status === "PAGO" ? (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">✓</div>
                  <h3 className="mt-4 text-2xl font-bold text-emerald-700">Pagamento confirmado!</h3>
                  <p className="mt-2 text-sm text-muted">O Pix foi recebido com sucesso.</p>
                </div>
                <button className="btn-primary w-full" onClick={() => { fecharPixModal(); closeSession(); }}>Fechar conta e continuar</button>
              </>
            ) : (
              <>
                <div>
                  <h3 className="text-xl font-bold">Cobrar via Pix</h3>
                  <p className="text-sm text-muted">Total: <strong className="text-lg">{formatMoney(pixModal.amount)}</strong></p>
                </div>
                {pixModal.qrCodeBase64 ? (
                  <img src={`data:image/png;base64,${pixModal.qrCodeBase64}`} alt="QR Code Pix" className="mx-auto h-52 w-52 rounded-2xl" />
                ) : null}
                {pixModal.qrCode ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted">Ou copie o código Pix:</p>
                    <div className="flex gap-2">
                      <input className="input flex-1 font-mono text-xs" value={pixModal.qrCode} readOnly />
                      <button className="btn-secondary px-3" onClick={() => navigator.clipboard.writeText(pixModal.qrCode)}>Copiar</button>
                    </div>
                  </div>
                ) : null}
                <p className="text-center text-xs text-muted">Aguardando pagamento...</p>
                <button className="btn-secondary w-full" onClick={fecharPixModal}>Fechar e pagar de outra forma</button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
