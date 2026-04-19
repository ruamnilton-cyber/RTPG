import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type WppStatus = "DISCONNECTED" | "CONNECTING" | "QR_READY" | "CONNECTED" | "AUTH_FAILURE" | "RECONNECTING";

type WppState = {
  status: WppStatus;
  qrDataUrl: string | null;
  phone: string | null;
  connectedAt: string | null;
  retryCount: number;
  lastError: string | null;
  logs: Array<{ ts: string; message: string }>;
};

type WhatsappOrder = {
  id: string;
  phone: string;
  customerName: string | null;
  status: "NOVO" | "AGUARDANDO_PAGAMENTO" | "AGUARDANDO_CONFERENCIA" | "CONFIRMADO" | "CANCELADO";
  totalAmount: number;
  paymentStatus: string;
  createdAt: string;
  items?: Array<{ id: string; productName: string; quantity: number; totalPrice: number }>;
};

type PanelData = {
  panel: {
    assistantName: string;
    channels: Array<"WHATSAPP" | "INSTAGRAM" | "QR">;
    autoReplyEnabled: boolean;
    audioTranscriptionEnabled: boolean;
    handoffThreshold: number;
    upsellEnabled: boolean;
    estimatedAutomationRate: number;
    handoffReasons: string[];
  };
  operations: {
    channelsEnabled: string[];
    whatsappAutomationEnabled: boolean;
    recommendedActions: string[];
    metrics: Array<{ label: string; value: string }>;
  };
};

const emptyWppState: WppState = {
  status: "DISCONNECTED",
  qrDataUrl: null,
  phone: null,
  connectedAt: null,
  retryCount: 0,
  lastError: null,
  logs: []
};

const statusMeta: Record<WppStatus, { label: string; tone: string; helper: string }> = {
  DISCONNECTED: {
    label: "Desconectado",
    tone: "#dc2626",
    helper: "Clique em conectar para iniciar uma nova sessao e gerar o QR Code."
  },
  CONNECTING: {
    label: "Conectando",
    tone: "#f59e0b",
    helper: "O sistema esta abrindo a sessao no WhatsApp. Aguarde o QR aparecer."
  },
  QR_READY: {
    label: "QR pronto",
    tone: "#0ea5e9",
    helper: "Escaneie o QR Code com o WhatsApp Business do restaurante."
  },
  CONNECTED: {
    label: "Conectado",
    tone: "#16a34a",
    helper: "A IA de atendimento esta pronta para receber mensagens e montar pedidos."
  },
  AUTH_FAILURE: {
    label: "Sessao expirada",
    tone: "#ef4444",
    helper: "A autenticacao caiu. Use reconectar para limpar a sessao e gerar um novo QR."
  },
  RECONNECTING: {
    label: "Reconectando",
    tone: "#6366f1",
    helper: "O sistema esta tentando reconectar automaticamente."
  }
};

function optionalDate(value: string | null) {
  return value ? formatDate(value) : "Ainda nao conectado";
}

function orderStatusLabel(status: WhatsappOrder["status"]) {
  const labels: Record<WhatsappOrder["status"], string> = {
    NOVO: "Novo",
    AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
    AGUARDANDO_CONFERENCIA: "Aguardando conferencia",
    CONFIRMADO: "Confirmado",
    CANCELADO: "Cancelado"
  };
  return labels[status];
}

export function AiPanelPage() {
  const { token } = useAuth();
  const [data, setData] = useState<PanelData | null>(null);
  const [wpp, setWpp] = useState<WppState>(emptyWppState);
  const [orders, setOrders] = useState<WhatsappOrder[]>([]);
  const [menuPreview, setMenuPreview] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function loadPanel() {
    const result = await apiRequest<PanelData>("/ai/panel", { token });
    setData(result);
  }

  async function loadWhatsapp() {
    try {
      const [state, orderList, preview] = await Promise.all([
        apiRequest<WppState>("/whatsapp/status", { token }),
        apiRequest<WhatsappOrder[]>("/whatsapp/orders", { token }),
        apiRequest<{ menu: string }>("/whatsapp/menu-preview", { token })
      ]);
      setWpp(state);
      setOrders(orderList);
      setMenuPreview(preview.menu);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao consegui carregar o painel de WhatsApp.");
    }
  }

  async function loadAll() {
    await Promise.all([loadPanel(), loadWhatsapp()]);
  }

  async function runWppAction(action: "connect" | "disconnect" | "reconnect" | "reset-retries", successMessage: string) {
    try {
      setLoadingAction(action);
      await apiRequest(`/whatsapp/${action}`, { method: "POST", token, body: {} });
      setMessage(successMessage);
      await loadWhatsapp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao consegui executar a acao do WhatsApp.");
    } finally {
      setLoadingAction(null);
    }
  }

  useEffect(() => {
    loadAll();
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadWhatsapp();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [token]);

  if (!data) {
    return <div className="card">Carregando painel de WhatsApp...</div>;
  }

  const status = statusMeta[wpp.status];

  return (
    <div className="space-y-5">
      <PageHeader
        title="WhatsApp e IA"
        subtitle="Conecte o WhatsApp Business por QR Code, ligue o atendimento automatico e acompanhe os pedidos que entram pela conversa."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {data.operations.metrics.map((metric) => (
          <div key={metric.label} className="card">
            <p className="text-sm text-muted">{metric.label}</p>
            <h3 className="mt-2 text-3xl font-bold">{metric.value}</h3>
          </div>
        ))}
      </div>

      {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Conexao WhatsApp</p>
              <h3 className="mt-2 text-2xl font-bold">QR Code do restaurante</h3>
              <p className="mt-2 text-sm text-muted">{status.helper}</p>
            </div>
            <span
              className="rounded-full px-4 py-2 text-sm font-bold"
              style={{ background: `color-mix(in srgb, ${status.tone} 18%, var(--color-surface-alt))`, color: "var(--color-text)" }}
            >
              {status.label}
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            <div className="rounded-[2rem] border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
              {wpp.qrDataUrl ? (
                <img src={wpp.qrDataUrl} alt="QR Code para conectar WhatsApp" className="w-full rounded-[1.5rem] bg-white p-4" />
              ) : (
                <div className="flex h-[268px] items-center justify-center rounded-[1.5rem] surface-soft p-6 text-center text-sm text-muted">
                  {wpp.status === "CONNECTED"
                    ? "WhatsApp conectado. A sessao fica salva no servidor."
                    : wpp.lastError
                      ? `Sem QR no momento. Ultimo erro: ${wpp.lastError}`
                      : "Clique em conectar para o sistema gerar o QR Code."}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl p-4 surface-soft">
                  <p className="text-sm text-muted">Telefone conectado</p>
                  <strong>{wpp.phone || "Nao identificado"}</strong>
                </div>
                <div className="rounded-3xl p-4 surface-soft">
                  <p className="text-sm text-muted">Ultima conexao</p>
                  <strong>{optionalDate(wpp.connectedAt)}</strong>
                </div>
                <div className="rounded-3xl p-4 surface-soft">
                  <p className="text-sm text-muted">Tentativas de reconexao</p>
                  <strong>{wpp.retryCount}</strong>
                </div>
                <div className="rounded-3xl p-4 surface-soft">
                  <p className="text-sm text-muted">Ultimo erro</p>
                  <strong>{wpp.lastError || "Nenhum"}</strong>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="btn-primary"
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() => runWppAction("connect", "Conexao iniciada. Se o QR aparecer, escaneie pelo celular do restaurante.")}
                >
                  Conectar e gerar QR
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() => runWppAction("reconnect", "Sessao limpa. Gerando novo QR Code.")}
                >
                  Reconectar
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() => runWppAction("disconnect", "WhatsApp desconectado.")}
                >
                  Desconectar
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() => runWppAction("reset-retries", "Tentativas de reconexao zeradas.")}
                >
                  Zerar tentativas
                </button>
              </div>
            </div>
          </div>
        </div>

        <form
          className="card space-y-4"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            try {
              await apiRequest("/whatsapp/test-message", {
                method: "POST",
                token,
                body: {
                  phone: String(formData.get("phone")),
                  message: String(formData.get("message"))
                }
              });
              setMessage("Mensagem de teste enviada pelo WhatsApp.");
              form.reset();
              loadWhatsapp();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Nao consegui enviar a mensagem de teste.");
            }
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Teste do bot</p>
            <h3 className="mt-2 text-2xl font-bold">Enviar mensagem manual</h3>
            <p className="mt-2 text-sm text-muted">Use para validar se a sessao conectada consegue enviar mensagens antes de ligar o fluxo comercial.</p>
          </div>
          <input className="input" name="phone" placeholder="Telefone com DDD. Ex: 21999801001" required />
          <textarea className="input min-h-28" name="message" placeholder="Mensagem de teste" defaultValue="Teste do atendimento automatico RTPG." required />
          <button className="btn-primary" type="submit">Enviar teste</button>
        </form>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Cardapio da IA</p>
            <h3 className="mt-2 text-2xl font-bold">Previa enviada ao cliente</h3>
            <p className="mt-2 text-sm text-muted">Quando o cliente pede cardapio, a IA usa os produtos ativos cadastrados no restaurante.</p>
          </div>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[1.5rem] p-4 text-sm surface-soft">{menuPreview || "Cardapio ainda nao carregado."}</pre>
        </div>

        <div className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Pedidos WhatsApp</p>
              <h3 className="mt-2 text-2xl font-bold">Comandas geradas pela conversa</h3>
            </div>
            <button className="btn-secondary" type="button" onClick={loadWhatsapp}>Atualizar</button>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-3xl p-4 surface-soft text-sm text-muted">Nenhum pedido recebido pelo WhatsApp ainda.</div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 8).map((order) => (
                <div key={order.id} className="rounded-[1.5rem] border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong>{order.customerName || order.phone}</strong>
                      <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <strong>{formatMoney(order.totalAmount)}</strong>
                      <p className="text-xs text-muted">{orderStatusLabel(order.status)}</p>
                    </div>
                  </div>

                  {order.items?.length ? (
                    <ul className="mt-3 space-y-1 text-sm text-muted">
                      {order.items.map((item) => (
                        <li key={item.id}>{item.quantity}x {item.productName} - {formatMoney(item.totalPrice)}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.status !== "CONFIRMADO" && order.status !== "CANCELADO" ? (
                      <button
                        className="btn-secondary px-3 py-2 text-sm"
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/whatsapp/orders/${order.id}/confirm-payment`, { method: "POST", token, body: {} });
                          setMessage("Pedido confirmado e cliente avisado, se o WhatsApp estiver conectado.");
                          loadWhatsapp();
                        }}
                      >
                        Confirmar pagamento
                      </button>
                    ) : null}
                    {order.status !== "CANCELADO" && order.status !== "CONFIRMADO" ? (
                      <button
                        className="btn-secondary px-3 py-2 text-sm"
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/whatsapp/orders/${order.id}/cancel`, { method: "POST", token, body: {} });
                          setMessage("Pedido cancelado.");
                          loadWhatsapp();
                        }}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          className="card space-y-4"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            await apiRequest("/ai/panel", {
              method: "PUT",
              token,
              body: {
                assistantName: String(formData.get("assistantName")),
                handoffThreshold: Number(formData.get("handoffThreshold")),
                estimatedAutomationRate: Number(formData.get("estimatedAutomationRate")),
                autoReplyEnabled: formData.get("autoReplyEnabled") === "on",
                audioTranscriptionEnabled: formData.get("audioTranscriptionEnabled") === "on",
                upsellEnabled: formData.get("upsellEnabled") === "on"
              }
            });
            setMessage("Configuracoes da IA atualizadas.");
            loadPanel();
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>IA do atendimento</p>
            <h3 className="mt-2 text-2xl font-bold">Configuracoes do assistente</h3>
          </div>
          <input className="input" name="assistantName" defaultValue={data.panel.assistantName} />
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" name="handoffThreshold" type="number" defaultValue={data.panel.handoffThreshold} />
            <input className="input" name="estimatedAutomationRate" type="number" defaultValue={data.panel.estimatedAutomationRate} />
          </div>
          <label className="flex items-center gap-2 rounded-2xl border px-4 py-3">
            <input type="checkbox" name="autoReplyEnabled" defaultChecked={data.panel.autoReplyEnabled} />
            Resposta automatica habilitada
          </label>
          <label className="flex items-center gap-2 rounded-2xl border px-4 py-3">
            <input type="checkbox" name="audioTranscriptionEnabled" defaultChecked={data.panel.audioTranscriptionEnabled} />
            Interpretacao de audio
          </label>
          <label className="flex items-center gap-2 rounded-2xl border px-4 py-3">
            <input type="checkbox" name="upsellEnabled" defaultChecked={data.panel.upsellEnabled} />
            Upsell contextual
          </label>
          <button className="btn-primary">Salvar configuracoes</button>
        </form>

        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Eventos da sessao</p>
            <h3 className="mt-2 text-2xl font-bold">Logs recentes</h3>
          </div>
          {wpp.logs.length === 0 ? (
            <div className="rounded-3xl p-4 surface-soft text-sm text-muted">Nenhum evento recente.</div>
          ) : (
            <div className="max-h-[430px] space-y-3 overflow-auto pr-1">
              {wpp.logs.map((log) => (
                <div key={`${log.ts}-${log.message}`} className="rounded-3xl p-4 surface-soft">
                  <p className="text-xs text-muted">{formatDate(log.ts)}</p>
                  <p className="mt-2 text-sm">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
