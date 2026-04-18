import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type WppStatus = "DISCONNECTED" | "CONNECTING" | "QR_READY" | "CONNECTED" | "AUTH_FAILURE" | "RECONNECTING";

interface WppState {
  status: WppStatus;
  qrDataUrl: string | null;
  phone: string | null;
  connectedAt: string | null;
  retryCount: number;
  lastError: string | null;
  logs: Array<{ ts: string; message: string }>;
}

type OrderStatus = "NOVO" | "AGUARDANDO_PAGAMENTO" | "AGUARDANDO_CONFERENCIA" | "CONFIRMADO" | "CANCELADO";

interface PaymentLink {
  id: string;
  url: string;
  amount: number;
  status: string;
  paidAt: string | null;
}

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
}

interface WppOrder {
  id: string;
  phone: string;
  customerName: string | null;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  items: OrderItem[];
  paymentLinks: PaymentLink[];
}

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<WppStatus, string> = {
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando...",
  QR_READY: "Aguardando QR Code",
  CONNECTED: "Conectado",
  AUTH_FAILURE: "Falha de autenticação",
  RECONNECTING: "Reconectando...",
};

const STATUS_COLOR: Record<WppStatus, string> = {
  DISCONNECTED: "#ef4444",
  CONNECTING: "#f59e0b",
  QR_READY: "#3b82f6",
  CONNECTED: "#22c55e",
  AUTH_FAILURE: "#ef4444",
  RECONNECTING: "#f97316",
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NOVO: "Novo",
  AGUARDANDO_PAGAMENTO: "Aguard. Pagamento",
  AGUARDANDO_CONFERENCIA: "Aguard. Conferência",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
};

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  NOVO: "#6366f1",
  AGUARDANDO_PAGAMENTO: "#f59e0b",
  AGUARDANDO_CONFERENCIA: "#3b82f6",
  CONFIRMADO: "#22c55e",
  CANCELADO: "#ef4444",
};

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function fmtPhone(phone: string) {
  return phone.replace("@s.whatsapp.net", "").replace("@c.us", "");
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function WhatsappPage() {
  const { token } = useAuth();
  const [wpp, setWpp] = useState<WppState | null>(null);
  const [orders, setOrders] = useState<WppOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("AGUARDANDO_PAGAMENTO");
  const [selectedOrder, setSelectedOrder] = useState<WppOrder | null>(null);
  const [menuPreview, setMenuPreview] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiRequest<WppState>("/whatsapp/status", { token });
      setWpp(data);
    } catch {
      // silencioso
    }
  }, [token]);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiRequest<WppOrder[]>(
        `/whatsapp/orders${statusFilter ? `?status=${statusFilter}` : ""}`,
        { token }
      );
      setOrders(data);
    } catch {
      //
    }
  }, [token, statusFilter]);

  useEffect(() => {
    loadStatus();
    loadOrders();

    pollRef.current = setInterval(() => {
      loadStatus();
      loadOrders();
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadStatus, loadOrders]);

  async function connect() {
    setActionLoading("connect");
    try {
      await apiRequest("/whatsapp/connect", { method: "POST", token });
      showToast("Iniciando conexão...");
      setTimeout(loadStatus, 2000);
    } catch (e) {
      showToast(String(e), false);
    } finally {
      setActionLoading(null);
    }
  }

  async function disconnect() {
    setActionLoading("disconnect");
    try {
      await apiRequest("/whatsapp/disconnect", { method: "POST", token });
      showToast("Sessão encerrada.");
      await loadStatus();
    } catch (e) {
      showToast(String(e), false);
    } finally {
      setActionLoading(null);
    }
  }

  async function reconnect() {
    setActionLoading("reconnect");
    try {
      await apiRequest("/whatsapp/reconnect", { method: "POST", token });
      showToast("Reconectando... Aguarde o QR Code.");
      setTimeout(loadStatus, 2000);
    } catch (e) {
      showToast(String(e), false);
    } finally {
      setActionLoading(null);
    }
  }

  async function resetRetries() {
    try {
      await apiRequest("/whatsapp/reset-retries", { method: "POST", token });
      showToast("Contador de reconexões resetado.");
      await loadStatus();
    } catch (e) {
      showToast(String(e), false);
    }
  }

  async function loadMenuPreview() {
    try {
      const data = await apiRequest<{ menu: string }>("/whatsapp/menu-preview", { token });
      setMenuPreview(data.menu);
    } catch (e) {
      showToast(String(e), false);
    }
  }

  async function confirmPayment(orderId: string) {
    setActionLoading(`confirm-${orderId}`);
    try {
      await apiRequest(`/whatsapp/orders/${orderId}/confirm-payment`, { method: "POST", token });
      showToast("Pagamento confirmado! Pedido atualizado.");
      setSelectedOrder(null);
      await loadOrders();
    } catch (e) {
      showToast(String(e), false);
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelOrderAction(orderId: string) {
    setActionLoading(`cancel-${orderId}`);
    try {
      await apiRequest(`/whatsapp/orders/${orderId}/cancel`, { method: "POST", token });
      showToast("Pedido cancelado.");
      setSelectedOrder(null);
      await loadOrders();
    } catch (e) {
      showToast(String(e), false);
    } finally {
      setActionLoading(null);
    }
  }

  const canConnect = wpp && !["CONNECTED", "CONNECTING", "RECONNECTING"].includes(wpp.status);
  const canDisconnect = wpp && ["CONNECTED", "CONNECTING", "QR_READY", "RECONNECTING"].includes(wpp.status);

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm font-medium text-white shadow-lg"
          style={{ background: toast.ok ? "#22c55e" : "#ef4444" }}
        >
          {toast.msg}
        </div>
      )}

      <PageHeader
        title="WhatsApp"
        subtitle="Atendimento via WhatsApp — conexão, cardápio, pedidos e conferência de pagamentos."
      />

      {/* ── Painel de Conexão ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Conexão
            </p>
            <h3 className="mt-1 text-2xl font-bold">Status WhatsApp</h3>
          </div>

          {wpp ? (
            <>
              {/* Status badge */}
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: STATUS_COLOR[wpp.status], boxShadow: `0 0 8px ${STATUS_COLOR[wpp.status]}` }}
                />
                <span className="font-semibold">{STATUS_LABEL[wpp.status]}</span>
                {wpp.phone && (
                  <span className="ml-auto rounded-xl bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    +{fmtPhone(wpp.phone)}
                  </span>
                )}
              </div>

              {/* Retry / Error info */}
              {wpp.retryCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">
                  <span>Reconexão: tentativa {wpp.retryCount}/5</span>
                  {wpp.lastError && <span className="text-xs text-orange-500">({wpp.lastError})</span>}
                </div>
              )}

              {wpp.status === "AUTH_FAILURE" && wpp.lastError && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {wpp.lastError}. Clique em "Reconectar (novo QR)" para gerar um novo QR Code.
                </div>
              )}

              {wpp.status === "DISCONNECTED" && wpp.lastError && (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Último erro: {wpp.lastError}. Clique em "Reconectar (novo QR)" para tentar novamente.
                </div>
              )}

              {/* QR Code */}
              {wpp.qrDataUrl && (
                <div
                  className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-5"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <p className="text-sm font-medium">Escaneie com o WhatsApp do celular</p>
                  <img src={wpp.qrDataUrl} alt="QR Code WhatsApp" className="h-52 w-52 rounded-xl" />
                  <p className="text-xs text-muted">O QR Code expira em ~60 segundos. A página atualiza automaticamente.</p>
                </div>
              )}

              {wpp.connectedAt && <p className="text-sm text-muted">Conectado desde: {fmtDate(wpp.connectedAt)}</p>}

              {/* Ações */}
              <div className="flex flex-wrap gap-3">
                {canConnect && (
                  <button className="btn-primary" onClick={connect} disabled={actionLoading === "connect"}>
                    {actionLoading === "connect" ? "Conectando..." : "Conectar"}
                  </button>
                )}
                {canDisconnect && (
                  <button className="btn-secondary" onClick={disconnect} disabled={actionLoading === "disconnect"}>
                    {wpp.status === "CONNECTED" ? "Desconectar" : "Cancelar"}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={reconnect}
                  disabled={actionLoading === "reconnect"}
                  title="Limpa a sessão anterior e gera um novo QR Code"
                >
                  {actionLoading === "reconnect" ? "Reconectando..." : "Reconectar (novo QR)"}
                </button>
                {wpp.retryCount > 0 && wpp.status !== "CONNECTED" && (
                  <button className="btn-secondary" onClick={resetRetries}>
                    Resetar reconexões
                  </button>
                )}
                <button className="btn-secondary" onClick={loadMenuPreview}>
                  Ver cardápio formatado
                </button>
              </div>
            </>
          ) : (
            <div className="text-muted">Carregando status...</div>
          )}
        </div>

        {/* ── Logs de Conexão ───────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Atividade
            </p>
            <h3 className="mt-1 text-2xl font-bold">Logs de conexão</h3>
          </div>
          <div
            className="max-h-60 overflow-y-auto space-y-1 rounded-2xl p-3 text-xs font-mono"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            {wpp?.logs?.length ? (
              wpp.logs.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 text-muted">{new Date(entry.ts).toLocaleTimeString("pt-BR")}</span>
                  <span>{entry.message}</span>
                </div>
              ))
            ) : (
              <span className="text-muted">Nenhuma atividade registrada.</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Preview do Cardápio ───────────────────────────────────────────────── */}
      {menuPreview && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Preview do cardápio (formato WhatsApp)</h3>
            <button className="btn-secondary text-xs" onClick={() => setMenuPreview(null)}>
              Fechar
            </button>
          </div>
          <pre
            className="whitespace-pre-wrap rounded-2xl p-4 text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontFamily: "inherit" }}
          >
            {menuPreview}
          </pre>
        </div>
      )}

      {/* ── Pedidos WhatsApp ──────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Pedidos
            </p>
            <h3 className="mt-1 text-2xl font-bold">Pedidos via WhatsApp</h3>
          </div>
          <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="NOVO">Novo</option>
            <option value="AGUARDANDO_PAGAMENTO">Aguardando Pagamento</option>
            <option value="AGUARDANDO_CONFERENCIA">Aguardando Conferência</option>
            <option value="CONFIRMADO">Confirmado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-muted" style={{ border: "1px dashed var(--color-border)" }}>
            Nenhum pedido encontrado para o filtro selecionado.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
              <button
                key={order.id}
                className="rounded-2xl p-4 text-left transition hover:opacity-80"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{fmtPhone(order.phone)}</p>
                    {order.customerName && <p className="text-sm text-muted">{order.customerName}</p>}
                  </div>
                  <span
                    className="rounded-xl px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ background: ORDER_STATUS_COLOR[order.status] }}
                  >
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">{fmtDate(order.createdAt)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm">
                    {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                  </p>
                  <p className="font-bold">{fmt(order.totalAmount)}</p>
                </div>
                {order.paymentLinks[0] && (
                  <p className="mt-1 truncate text-xs text-muted">Pgto: {order.paymentLinks[0].status}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal de detalhe do pedido ────────────────────────────────────────── */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrder(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Detalhe do Pedido</h3>
              <button className="btn-secondary text-xs" onClick={() => setSelectedOrder(null)}>
                Fechar
              </button>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Telefone</span>
                <span className="font-medium">{fmtPhone(selectedOrder.phone)}</span>
              </div>
              {selectedOrder.customerName && (
                <div className="flex justify-between">
                  <span className="text-muted">Cliente</span>
                  <span className="font-medium">{selectedOrder.customerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <span
                  className="rounded-xl px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ background: ORDER_STATUS_COLOR[selectedOrder.status] }}
                >
                  {ORDER_STATUS_LABEL[selectedOrder.status]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Pagamento</span>
                <span className="font-medium">{selectedOrder.paymentStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Criado em</span>
                <span>{fmtDate(selectedOrder.createdAt)}</span>
              </div>
              {selectedOrder.confirmedAt && (
                <div className="flex justify-between">
                  <span className="text-muted">Confirmado em</span>
                  <span>{fmtDate(selectedOrder.confirmedAt)}</span>
                </div>
              )}
            </div>

            {/* Itens */}
            <div>
              <p className="mb-2 text-sm font-semibold">Itens</p>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span>
                      {item.quantity}x {item.productName}
                    </span>
                    <span className="font-medium">{fmt(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between px-3 font-bold">
                <span>Total</span>
                <span>{fmt(selectedOrder.totalAmount)}</span>
              </div>
            </div>

            {/* Links de pagamento */}
            {selectedOrder.paymentLinks.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">Link de pagamento</p>
                {selectedOrder.paymentLinks.map((lk) => (
                  <div
                    key={lk.id}
                    className="rounded-xl p-3 text-xs space-y-1"
                    style={{
                      background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{lk.status}</span>
                      <span>{fmt(lk.amount)}</span>
                    </div>
                    <a
                      href={lk.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate underline"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {lk.url}
                    </a>
                    {lk.paidAt && <p className="text-muted">Pago em: {fmtDate(lk.paidAt)}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Ações do funcionário */}
            {!["CONFIRMADO", "CANCELADO"].includes(selectedOrder.status) && (
              <div className="flex gap-3 pt-2">
                <button
                  className="btn-primary flex-1"
                  onClick={() => confirmPayment(selectedOrder.id)}
                  disabled={actionLoading === `confirm-${selectedOrder.id}`}
                >
                  {actionLoading === `confirm-${selectedOrder.id}` ? "Confirmando..." : "Confirmar Pagamento"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => cancelOrderAction(selectedOrder.id)}
                  disabled={actionLoading === `cancel-${selectedOrder.id}`}
                >
                  {actionLoading === `cancel-${selectedOrder.id}` ? "..." : "Cancelar"}
                </button>
              </div>
            )}

            {selectedOrder.status === "CONFIRMADO" && (
              <div className="rounded-2xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700">
                Pagamento confirmado por funcionário
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
