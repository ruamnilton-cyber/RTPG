import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";

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

  if (!data) {
    return <div className="card">Carregando painel de IA...</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="WhatsApp e IA"
        subtitle="Conecte o atendimento do restaurante, acompanhe automacao e prepare o fluxo de pedidos vindo do WhatsApp."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {data.operations.metrics.map((metric) => (
          <div key={metric.label} className="card">
            <p className="text-sm text-muted">{metric.label}</p>
            <h3 className="mt-2 text-3xl font-bold">{metric.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
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
            setMessage("Configuracoes de IA atualizadas.");
            load();
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Configuracao</p>
            <h3 className="mt-2 text-2xl font-bold">Assistente do restaurante</h3>
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
          {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
          <button className="btn-primary">Salvar configuracoes</button>
        </form>

        <div className="space-y-5">
          <div className="card space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Acoes recomendadas</p>
              <h3 className="mt-2 text-2xl font-bold">Prioridades do WhatsApp</h3>
            </div>
            {data.operations.recommendedActions.map((item) => (
              <div key={item} className="rounded-3xl p-4 surface-soft">{item}</div>
            ))}
          </div>

          <form
            className="card space-y-3"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const response = await apiRequest<{ handoffTicket: string; nextAction: string }>("/ai/handoff", {
                method: "POST",
                token,
                body: {
                  channel: String(formData.get("channel")),
                  customerName: String(formData.get("customerName")),
                  reason: String(formData.get("reason")),
                  summary: String(formData.get("summary"))
                }
              });
              setMessage(`Handoff gerado: ${response.handoffTicket}`);
            }}
          >
            <h3 className="text-xl font-bold">Simular conversa e handoff</h3>
            <select className="input" name="channel" defaultValue="WHATSAPP">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="QR">QR</option>
            </select>
            <input className="input" name="customerName" placeholder="Nome do cliente" required />
            <input className="input" name="reason" placeholder="Motivo do handoff" required />
            <textarea className="input min-h-28" name="summary" placeholder="Resumo do contexto para o humano" required />
            <button className="btn-primary">Gerar handoff</button>
          </form>
        </div>
      </div>
    </div>
  );
}
