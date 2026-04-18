import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAuth } from "../state/auth";

type WhatsAppStatus = {
  status: "CONECTADO" | "DESCONECTADO" | "AGUARDANDO_QR";
  qrCodeDataUrl: string | null;
  lastQrText?: string | null;
  connectedAt: string | null;
  phoneNumber: string | null;
  lastError?: string | null;
  recentMessages: Array<{ id: string; from: string; text: string; createdAt: string; direction: "IN" | "OUT" }>;
  handoffs: Array<{ id: string; from: string; reason: string; text: string; createdAt: string }>;
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
    whatsapp: WhatsAppStatus;
  };
  agentCenter: {
    architecture: {
      strategy: string;
      coreProduct: string[];
      integratedAgents: string[];
      optionalAutomations: string[];
      commercialReasoning: string[];
    };
    counts: {
      products: number;
      categories: number;
      supplies: number;
      recipeItems: number;
      openOrders: number;
      tables: number;
      expenses: number;
      receivables: number;
      payables: number;
      sales: number;
    };
    agents: Array<{
      id: string;
      name: string;
      status: "PRONTO" | "EM_ESTRUTURACAO" | "DEPENDENCIA_EXTERNA" | "FUTURO";
      objective: string;
      dataPoints: string[];
      dependencies: string[];
      nextAction: string;
    }>;
  };
  platformPositioning: {
    title: string;
    summary: string;
    pillars: string[];
  };
};

function statusBadge(status: WhatsAppStatus["status"]) {
  if (status === "CONECTADO") return { label: "Conectado", background: "color-mix(in srgb, #22c55e 18%, white)" };
  if (status === "AGUARDANDO_QR") return { label: "Aguardando QR", background: "color-mix(in srgb, #f59e0b 18%, white)" };
  return { label: "Desconectado", background: "color-mix(in srgb, #dc2626 16%, white)" };
}

function agentBadge(status: PanelData["agentCenter"]["agents"][number]["status"]) {
  if (status === "PRONTO") {
    return { label: "Pronto", background: "color-mix(in srgb, #22c55e 18%, white)" };
  }
  if (status === "EM_ESTRUTURACAO") {
    return { label: "Em estruturacao", background: "color-mix(in srgb, #f59e0b 18%, white)" };
  }
  if (status === "DEPENDENCIA_EXTERNA") {
    return { label: "Dependencia externa", background: "color-mix(in srgb, #6366f1 16%, white)" };
  }
  return { label: "Futuro", background: "color-mix(in srgb, #94a3b8 18%, white)" };
}

export function AiPanelPage() {
  const { token } = useAuth();
  const [data, setData] = useState<PanelData | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const result = await apiRequest<PanelData>("/ai/panel", { token });
    setData(result);
  }

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      load();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [token]);

  if (!data) {
    return <div className="card">Carregando painel de WhatsApp...</div>;
  }

  const badge = statusBadge(data.operations.whatsapp.status);

  return (
    <div className="space-y-5">
      <PageHeader
        title="WhatsApp e IA"
        subtitle="Conecte o WhatsApp Business do restaurante por QR Code e acompanhe pedidos, mensagens e handoffs."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {data.operations.metrics.map((metric) => (
          <div key={metric.label} className="card">
            <p className="text-sm text-muted">{metric.label}</p>
            <h3 className="mt-2 text-3xl font-bold">{metric.value}</h3>
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Modelo comercial</p>
          <h3 className="mt-2 text-2xl font-bold">{data.platformPositioning.title}</h3>
          <p className="mt-2 text-sm text-muted">{data.platformPositioning.summary}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.platformPositioning.pillars.map((pillar) => (
            <div key={pillar} className="rounded-3xl p-4 surface-soft">
              <strong className="text-sm">{pillar}</strong>
            </div>
          ))}
        </div>
        <div className="rounded-3xl p-4 surface-soft space-y-3">
          <p className="text-sm font-semibold">Estratégia recomendada</p>
          <p className="text-sm text-muted">{data.agentCenter.architecture.strategy}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Core do produto</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {data.agentCenter.architecture.coreProduct.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Automacoes opcionais</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {data.agentCenter.architecture.optionalAutomations.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Agentes integrados</p>
            <h3 className="mt-2 text-2xl font-bold">Base de IA do proprio produto</h3>
            <p className="mt-2 text-sm text-muted">Aqui fica o que o sistema ja sustenta no proprio backend, sem depender de automacao externa para o coracao da operacao.</p>
          </div>
          <div className="rounded-3xl px-4 py-3 surface-soft text-sm text-muted">
            {data.agentCenter.counts.openOrders} pedidos abertos • {data.agentCenter.counts.products} produtos • {data.agentCenter.counts.supplies} insumos
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.agentCenter.agents.map((agent) => {
            const badge = agentBadge(agent.status);
            return (
              <div key={agent.id} className="rounded-[1.8rem] border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold">{agent.name}</h4>
                    <p className="mt-2 text-sm text-muted">{agent.objective}</p>
                  </div>
                  <span className="rounded-full px-3 py-2 text-xs font-semibold" style={{ background: badge.background }}>
                    {badge.label}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold">Dados que ele enxerga</p>
                    <ul className="mt-2 space-y-2 text-sm text-muted">
                      {agent.dataPoints.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Dependencias</p>
                    <ul className="mt-2 space-y-2 text-sm text-muted">
                      {agent.dependencies.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-4 rounded-3xl bg-white/70 p-4 text-sm">
                  <span className="font-semibold">Proximo passo: </span>
                  {agent.nextAction}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Conexao WhatsApp</p>
                <h3 className="mt-2 text-2xl font-bold">QR Code do restaurante</h3>
                <p className="mt-2 text-sm text-muted">Escaneie com o WhatsApp Business do restaurante. A sessao fica salva e reconecta automaticamente se cair.</p>
              </div>
              <span className="rounded-full px-3 py-2 text-sm font-semibold" style={{ background: badge.background }}>
                {badge.label}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="rounded-[1.8rem] border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}>
                {data.operations.whatsapp.qrCodeDataUrl ? (
                  <img src={data.operations.whatsapp.qrCodeDataUrl} alt="QR Code do WhatsApp" className="w-full rounded-2xl bg-white p-3" />
                ) : (
                  <div className="flex h-[248px] items-center justify-center rounded-2xl surface-soft text-center text-sm text-muted">
                    {data.operations.whatsapp.status === "CONECTADO"
                      ? "WhatsApp conectado. Nao precisa escanear novamente."
                      : data.operations.whatsapp.lastError
                        ? `Nao consegui gerar o QR ainda. Motivo atual: ${data.operations.whatsapp.lastError}`
                        : "Clique em conectar para gerar o QR Code."}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-3xl p-4 surface-soft">
                  <p className="text-sm text-muted">Telefone conectado</p>
                  <strong>{data.operations.whatsapp.phoneNumber || "Ainda nao identificado"}</strong>
                </div>
                <div className="rounded-3xl p-4 surface-soft">
                  <p className="text-sm text-muted">Ultima conexao</p>
                  <strong>{data.operations.whatsapp.connectedAt ? formatDate(data.operations.whatsapp.connectedAt) : "Nenhuma conexao ativa"}</strong>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={async () => {
                      await apiRequest("/ai/whatsapp/connect", { method: "POST", token, body: {} });
                      setMessage("Conexao iniciada. Escaneie o QR Code se ele aparecer.");
                      load();
                    }}
                  >
                    Conectar
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={async () => {
                      await apiRequest("/ai/whatsapp/disconnect", { method: "POST", token, body: {} });
                      setMessage("WhatsApp desconectado.");
                      load();
                    }}
                  >
                    Desconectar
                  </button>
                </div>
                {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
              </div>
            </div>
          </div>

          <div className="card space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Mensagens recentes</p>
              <h3 className="mt-2 text-2xl font-bold">Fila do bot</h3>
            </div>
            {data.operations.whatsapp.recentMessages.length === 0 ? (
              <div className="rounded-3xl p-4 surface-soft text-sm text-muted">Nenhuma mensagem recente.</div>
            ) : (
              data.operations.whatsapp.recentMessages.map((item) => (
                <div key={item.id} className="rounded-3xl p-4 surface-soft">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{item.direction === "IN" ? "Cliente" : "Bot"}</strong>
                    <span className="text-xs text-muted">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted">{item.from}</p>
                  <p className="mt-3 text-sm">{item.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
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
              load();
            }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>IA do atendimento</p>
              <h3 className="mt-2 text-2xl font-bold">Configuracoes do assistente</h3>
            </div>
            <label>
              <span className="label">Nome do assistente</span>
              <input className="input" name="assistantName" defaultValue={data.panel.assistantName} />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="label">Limite de handoff (%)</span>
                <input className="input" name="handoffThreshold" type="number" defaultValue={data.panel.handoffThreshold} />
              </label>
              <label>
                <span className="label">Automacao estimada (%)</span>
                <input className="input" name="estimatedAutomationRate" type="number" defaultValue={data.panel.estimatedAutomationRate} />
              </label>
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

          <div className="card space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Handoffs</p>
              <h3 className="mt-2 text-2xl font-bold">Atendimento humano</h3>
            </div>
            {data.operations.whatsapp.handoffs.length === 0 ? (
              <div className="rounded-3xl p-4 surface-soft text-sm text-muted">Nenhum handoff pendente.</div>
            ) : (
              data.operations.whatsapp.handoffs.map((item) => (
                <div key={item.id} className="rounded-3xl p-4 surface-soft">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{item.from}</strong>
                    <span className="text-xs text-muted">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-red-700">{item.reason}</p>
                  <p className="mt-2 text-sm text-muted">{item.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
