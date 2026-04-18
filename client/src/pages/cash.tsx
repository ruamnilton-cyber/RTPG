import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type CashierMovement = {
  id: string;
  type: "SANGRIA" | "REFORCO" | "AJUSTE";
  amount: number;
  reason: string;
  createdAt: string;
};

type CashierSession = {
  id: string;
  userId: string;
  userName: string;
  branchId: string;
  status: "ABERTO" | "FECHADO";
  openingAmount: number;
  closingAmount: number;
  expectedAmount: number;
  divergenceAmount: number;
  openedAt: string;
  closedAt?: string;
  justification: string;
  movements: CashierMovement[];
};

export function CashPage() {
  const { token, user } = useAuth();
  const [sessions, setSessions] = useState<CashierSession[]>([]);

  async function load() {
    const result = await apiRequest<CashierSession[]>("/cashier/sessions", { token });
    setSessions(result);
  }

  useEffect(() => {
    load();
  }, [token]);

  const currentSession = useMemo(
    () => sessions.find((item) => item.status === "ABERTO" && item.userId === user?.id) ?? null,
    [sessions, user?.id]
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Caixa diario" subtitle="Abertura, reforcos, sangrias, divergencia e fechamento por operador." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-muted">Sessao atual</p>
          <h3 className="mt-2 text-3xl font-bold">{currentSession ? "Aberta" : "Fechada"}</h3>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Saldo esperado</p>
          <h3 className="mt-2 text-3xl font-bold">{formatMoney(currentSession?.expectedAmount ?? 0)}</h3>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Divergencia</p>
          <h3 className="mt-2 text-3xl font-bold">{formatMoney(currentSession?.divergenceAmount ?? 0)}</h3>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        {!currentSession ? (
          <form
            className="card space-y-4"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              await apiRequest("/cashier/sessions/open", {
                method: "POST",
                token,
                body: {
                  openingAmount: Number(formData.get("openingAmount"))
                }
              });
              event.currentTarget.reset();
              load();
            }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Abertura</p>
              <h3 className="mt-2 text-2xl font-bold">Iniciar caixa</h3>
            </div>
            <input className="input" name="openingAmount" type="number" step="0.01" placeholder="Saldo inicial" required />
            <button className="btn-primary">Abrir caixa</button>
          </form>
        ) : (
          <div className="space-y-5">
            <form
              className="card space-y-4"
              onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await apiRequest(`/cashier/sessions/${currentSession.id}/movements`, {
                  method: "POST",
                  token,
                  body: {
                    type: String(formData.get("type")),
                    amount: Number(formData.get("amount")),
                    reason: String(formData.get("reason"))
                  }
                });
                event.currentTarget.reset();
                load();
              }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Movimentacoes</p>
                <h3 className="mt-2 text-2xl font-bold">Sangria, reforco e ajuste</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select className="input" name="type" defaultValue="SANGRIA">
                  <option value="SANGRIA">Sangria</option>
                  <option value="REFORCO">Reforco</option>
                  <option value="AJUSTE">Ajuste</option>
                </select>
                <input className="input" name="amount" type="number" step="0.01" placeholder="Valor" required />
                <input className="input" name="reason" placeholder="Motivo" required />
              </div>
              <button className="btn-primary">Adicionar movimentacao</button>
            </form>

            <form
              className="card space-y-4"
              onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await apiRequest(`/cashier/sessions/${currentSession.id}/close`, {
                  method: "POST",
                  token,
                  body: {
                    closingAmount: Number(formData.get("closingAmount")),
                    justification: String(formData.get("justification") ?? "")
                  }
                });
                event.currentTarget.reset();
                load();
              }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Fechamento</p>
                <h3 className="mt-2 text-2xl font-bold">Encerrar sessao</h3>
              </div>
              <input className="input" name="closingAmount" type="number" step="0.01" placeholder="Valor contado" required />
              <textarea className="input min-h-24" name="justification" placeholder="Justificativa se houver divergencia" />
              <button className="btn-primary">Fechar caixa</button>
            </form>
          </div>
        )}

        <div className="space-y-5">
          <div className="card space-y-3">
            <h3 className="text-xl font-bold">Sessao atual</h3>
            {!currentSession ? <p className="text-sm text-muted">Nenhuma sessao aberta para este operador.</p> : (
              <>
                <div className="rounded-3xl p-4 surface-soft">
                  <p className="text-sm text-muted">Aberta em {formatDate(currentSession.openedAt)}</p>
                  <p className="mt-2 text-lg font-semibold">Saldo esperado {formatMoney(currentSession.expectedAmount)}</p>
                </div>
                {currentSession.movements.map((movement) => (
                  <div key={movement.id} className="rounded-3xl p-4 surface-soft">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{movement.type}</strong>
                      <span>{formatMoney(movement.amount)}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{movement.reason}</p>
                    <p className="mt-1 text-xs text-muted">{formatDate(movement.createdAt)}</p>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="card space-y-3">
            <h3 className="text-xl font-bold">Historico recente</h3>
            {sessions.slice(0, 6).map((session) => (
              <div key={session.id} className="rounded-3xl p-4 surface-soft">
                <div className="flex items-center justify-between gap-3">
                  <strong>{session.userName}</strong>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--color-badge)" }}>{session.status}</span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Abertura {formatMoney(session.openingAmount)} • Esperado {formatMoney(session.expectedAmount)} • Fechamento {formatMoney(session.closingAmount)}
                </p>
                <p className="mt-1 text-xs text-muted">{formatDate(session.openedAt)} {session.closedAt ? `• encerrado ${formatDate(session.closedAt)}` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
