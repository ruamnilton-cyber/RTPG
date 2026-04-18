import { useEffect, useState } from "react";
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
    </div>
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
