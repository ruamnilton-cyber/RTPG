import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type SaasClient = {
  id: string;
  businessName: string;
  contactName: string;
  monthlyFee: number;
  nextDueDate: string;
  status: "ATIVO" | "TRIAL" | "ATRASADO" | "SUSPENSO" | "CANCELADO";
  accessStatus: "LIBERADO" | "BLOQUEIO_AVISO" | "BLOQUEADO";
  payments?: Array<{ amount: number }>;
};

type OwnerManagerPayload = {
  cards: Array<{ label: string; value: number }>;
  actions: {
    dueToday: number;
    dueTomorrow: number;
    overdue: number;
    blocked: number;
    dueThisWeek: number;
  };
  lists: {
    dueToday: SaasClient[];
    dueTomorrow: SaasClient[];
    overdue: SaasClient[];
    blocked: SaasClient[];
    dueThisWeek: SaasClient[];
  };
  topRevenue: SaasClient[];
};

function actionTone(value: number, variant: "danger" | "warning" | "default" = "default") {
  if (variant === "danger") {
    return value > 0 ? "color-mix(in srgb, #dc2626 14%, white)" : "var(--color-surface-alt)";
  }

  if (variant === "warning") {
    return value > 0 ? "color-mix(in srgb, #d97706 16%, white)" : "var(--color-surface-alt)";
  }

  return "var(--color-surface-alt)";
}

function CompactClientList({
  title,
  description,
  items,
  emptyMessage,
  tone
}: {
  title: string;
  description: string;
  items: SaasClient[];
  emptyMessage: string;
  tone?: "default" | "danger" | "warning";
}) {
  return (
    <div className="card space-y-4">
      <div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-[1.75rem] p-4" style={{ background: actionTone(1, tone) }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <strong>{item.businessName}</strong>
                  <p className="text-sm text-muted">{item.contactName}</p>
                </div>
                <div className="text-right">
                  <strong>{formatMoney(item.monthlyFee)}</strong>
                  <p className="text-xs text-muted">{item.nextDueDate || "Sem vencimento"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
            Integracao de pagamentos
          </p>
          <h3 className="mt-1 text-xl font-bold">Configurar Asaas</h3>
          <p className="mt-1 text-sm text-muted">
            Configure sua conta Asaas para cobrar restaurantes via PIX automaticamente.
            A chave e armazenada criptografada e nunca e exibida novamente apos salvar.
          </p>
        </div>
        <AsaasConfigForm token={token} />
      </section>
    </div>
  );
}

function AsaasConfigForm({ token }: { token: string | null }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const apiKey = String(fd.get("apiKey") ?? "").trim();
    const webhookToken = String(fd.get("webhookToken") ?? "").trim();
    const sandbox = fd.get("sandbox") === "on";
    if (!apiKey) { setError("Informe a chave de API do Asaas."); return; }
    setLoading(true);
    try {
      await apiRequest("/saas-billing/platform-config", {
        method: "PUT", token,
        body: { apiKey, sandbox, ...(webhookToken ? { webhookToken } : {}) }
      });
      setSaved(true);
      e.currentTarget.reset();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar configuracao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className="label">Chave de API do Asaas</span>
          <input
            className="input font-mono text-sm"
            name="apiKey"
            type="password"
            placeholder="$aas_xxxxxxxxxxxxxxxxxxxxx"
            autoComplete="off"
            required
          />
          <p className="text-xs text-muted">Obtida em: Asaas &rarr; Configuracoes &rarr; Integracoes.</p>
        </label>
        <label className="space-y-1">
          <span className="label">Token do Webhook (opcional)</span>
          <input
            className="input font-mono text-sm"
            name="webhookToken"
            type="password"
            placeholder="Token secreto do webhook"
            autoComplete="off"
          />
          <p className="text-xs text-muted">Usado para validar notificacoes do Asaas.</p>
        </label>
        <label className="flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: "var(--color-border)" }}>
          <input name="sandbox" type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" defaultChecked />
          <div>
            <span className="font-semibold">Modo Sandbox</span>
            <p className="text-xs text-muted">Desmarque apenas em producao com conta Asaas real.</p>
          </div>
        </label>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-green-600">Configuracao salva com sucesso!</p>}
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Salvar configuracao do Asaas"}
      </button>
    </form>
  );
}


export function OwnerManagerPage() {
  const { token } = useAuth();
  const [data, setData] = useState<OwnerManagerPayload | null>(null);

  async function load() {
    const result = await apiRequest<OwnerManagerPayload>("/saas-clients/owner-dashboard", { token });
    setData(result);
  }

  useEffect(() => {
    load();
  }, [token]);

  if (!data) {
    return <div className="card">Carregando seu gestor...</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meu Gestor"
        subtitle="Sua area de controle do negocio SaaS, separada da operacao dos restaurantes."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/meu-gestor/carteira" className="btn-secondary">
              Abrir carteira
            </Link>
            <Link to="/painel-dono" className="btn-primary">
              Entrar no restaurante
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="card space-y-5">
          <div className="rounded-[2rem] p-5" style={{ background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-accent) 70%, #ffffff))", color: "var(--color-on-primary)" }}>
            <p className="text-xs uppercase tracking-[0.32em]" style={{ color: "color-mix(in srgb, var(--color-on-primary) 78%, transparent)" }}>Visao do dono</p>
            <h2 className="mt-3 text-3xl font-bold">O que precisa da sua atencao agora</h2>
            <p className="mt-3 max-w-2xl text-sm" style={{ color: "color-mix(in srgb, var(--color-on-primary) 86%, transparent)" }}>
              Aqui ficam apenas os pontos da sua gestao: vencimentos, clientes atrasados, bloqueios e a receita da sua carteira.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.cards.map((card) => (
              <div key={card.label} className="rounded-[1.75rem] p-4 surface-soft">
                <p className="text-sm text-muted">{card.label}</p>
                <h3 className="mt-2 text-3xl font-bold">
                  {card.label.includes("Clientes") ? String(card.value) : formatMoney(card.value)}
                </h3>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Vence hoje", value: data.actions.dueToday, tone: "warning" as const },
              { label: "Vence amanha", value: data.actions.dueTomorrow, tone: "default" as const },
              { label: "Na semana", value: data.actions.dueThisWeek, tone: "default" as const },
              { label: "Atrasados", value: data.actions.overdue, tone: "danger" as const },
              { label: "Bloqueados", value: data.actions.blocked, tone: "danger" as const }
            ].map((item) => (
              <div key={item.label} className="rounded-[1.75rem] p-4" style={{ background: actionTone(item.value, item.tone) }}>
                <p className="text-sm text-muted">{item.label}</p>
                <h3 className="mt-2 text-2xl font-bold">{item.value}</h3>
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Maior receita acumulada</h3>
              <p className="text-sm text-muted">Os clientes que mais retornaram receita para sua operacao.</p>
            </div>
            <Link to="/meu-gestor/carteira" className="btn-secondary">
              Gerir carteira
            </Link>
          </div>

          {data.topRevenue.length === 0 ? (
            <p className="text-sm text-muted">Ainda nao existem pagamentos registrados na carteira.</p>
          ) : (
            <div className="space-y-3">
              {data.topRevenue.map((client, index) => {
                const totalRevenue = client.payments?.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
                return (
                  <div key={client.id} className="rounded-[1.75rem] p-4 surface-soft">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--color-primary)" }}>
                          #{index + 1}
                        </p>
                        <strong>{client.businessName}</strong>
                        <p className="text-sm text-muted">{client.contactName}</p>
                      </div>
                      <div className="text-right">
                        <strong>{formatMoney(totalRevenue)}</strong>
                        <p className="text-xs text-muted">{client.status}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <CompactClientList
          title="Recebimentos de hoje"
          description="Clientes que vencem agora e pedem contato rapido."
          items={data.lists.dueToday}
          emptyMessage="Nenhum vencimento para hoje."
          tone="warning"
        />
        <CompactClientList
          title="Recebimentos de amanha"
          description="Fila de acompanhamento para evitar atraso."
          items={data.lists.dueTomorrow}
          emptyMessage="Nenhum vencimento previsto para amanha."
        />
        <CompactClientList
          title="Carteira em atraso"
          description="Prioridade maxima de cobranca."
          items={data.lists.overdue}
          emptyMessage="Nenhum cliente atrasado."
          tone="danger"
        />
        <CompactClientList
          title="Acesso bloqueado"
          description="Clientes com acesso travado e que merecem decisao sua."
          items={data.lists.blocked}
          emptyMessage="Nenhum cliente bloqueado."
          tone="danger"
        />
      </div>
    </div>
  );
}
