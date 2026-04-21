import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type SaasPayment = {
  id: string;
  amount: number;
  paidAt: string;
  referenceMonth: string;
  notes: string;
};

type SaasClient = {
  id: string;
  businessName: string;
  contactName: string;
  accessLogin: string;
  temporaryPassword: string;
  linkedBarId: string;
  linkedUserId: string;
  linkedUserEmail: string;
  phone: string;
  email: string;
  planName: string;
  monthlyFee: number;
  billingDay: number;
  nextDueDate: string;
  lastPaymentDate: string;
  status: "ATIVO" | "TRIAL" | "ATRASADO" | "SUSPENSO" | "CANCELADO";
  accessStatus: "LIBERADO" | "BLOQUEIO_AVISO" | "BLOQUEADO";
  notes: string;
  payments: SaasPayment[];
  createdAt: string;
};

type SaasOverview = {
  cards: Array<{ label: string; value: number }>;
  summary: {
    activeCount: number;
    overdueCount: number;
    blockedCount: number;
    totalRevenue: number;
    mrr: number;
  };
};

const statusLabel: Record<SaasClient["status"], string> = {
  ATIVO: "Ativo", TRIAL: "Trial", ATRASADO: "Atrasado", SUSPENSO: "Suspenso", CANCELADO: "Cancelado"
};
const accessLabel: Record<SaasClient["accessStatus"], string> = {
  LIBERADO: "Liberado", BLOQUEIO_AVISO: "Aviso", BLOQUEADO: "Bloqueado"
};
const statusBg: Record<SaasClient["status"], { bg: string; color: string }> = {
  ATIVO:     { bg: "color-mix(in srgb, #16a34a 25%, #1b1b1f)", color: "#4ade80" },
  TRIAL:     { bg: "color-mix(in srgb, #2563eb 25%, #1b1b1f)", color: "#60a5fa" },
  ATRASADO:  { bg: "color-mix(in srgb, #f59e0b 25%, #1b1b1f)", color: "#fcd34d" },
  SUSPENSO:  { bg: "color-mix(in srgb, #dc2626 25%, #1b1b1f)", color: "#f87171" },
  CANCELADO: { bg: "color-mix(in srgb, #374151 35%, #1b1b1f)", color: "#9ca3af" },
};
const accessBg: Record<SaasClient["accessStatus"], { bg: string; color: string }> = {
  LIBERADO:       { bg: "color-mix(in srgb, #16a34a 25%, #1b1b1f)", color: "#4ade80" },
  BLOQUEIO_AVISO: { bg: "color-mix(in srgb, #f59e0b 25%, #1b1b1f)", color: "#fcd34d" },
  BLOQUEADO:      { bg: "color-mix(in srgb, #dc2626 25%, #1b1b1f)", color: "#f87171" },
};

function totalClientRevenue(client: SaasClient) {
  return client.payments.reduce((sum, p) => sum + p.amount, 0);
}

function daysOverdue(client: SaasClient): number | null {
  if (client.status !== "ATRASADO" && client.status !== "SUSPENSO") return null;
  if (!client.nextDueDate) return null;
  const due = new Date(client.nextDueDate);
  const today = new Date();
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

function OverdueBadge({ days }: { days: number }) {
  const color = days > 15 ? "#ef4444" : days > 7 ? "#f97316" : "#eab308";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ background: `${color}22`, color }}
    >
      {days}d atraso
    </span>
  );
}

function exportCSV(clients: SaasClient[]) {
  const headers = [
    "Restaurante", "Responsavel", "Email", "Telefone",
    "Plano", "Mensalidade (R$)", "Faturamento Total (R$)",
    "Status", "Acesso", "Proximo Vencimento", "Ultimo Pagamento", "Cadastro"
  ];
  const rows = clients.map(c => [
    c.businessName,
    c.contactName,
    c.email,
    c.phone,
    c.planName,
    c.monthlyFee.toFixed(2),
    totalClientRevenue(c).toFixed(2),
    statusLabel[c.status],
    accessLabel[c.accessStatus],
    c.nextDueDate || "",
    c.lastPaymentDate || "",
    c.createdAt ? c.createdAt.slice(0, 10) : ""
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-rtpg-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SaasClientsPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState<SaasClient[]>([]);
  const [overview, setOverview] = useState<SaasOverview | null>(null);
  const [selectedClient, setSelectedClient] = useState<SaasClient | null>(null);
  const [search, setSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");

  async function load(nextSearch = "") {
    const [list, summary] = await Promise.all([
      apiRequest<SaasClient[]>(`/saas-clients${nextSearch ? `?search=${encodeURIComponent(nextSearch)}` : ""}`, { token }),
      apiRequest<SaasOverview>("/saas-clients/overview", { token })
    ]);
    setClients(list);
    setOverview(summary);
    if (selectedClient) {
      setSelectedClient(list.find((item) => item.id === selectedClient.id) ?? null);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [token]);

  const topRevenue = useMemo(
    () => [...clients].sort((a, b) => totalClientRevenue(b) - totalClientRevenue(a)).slice(0, 5),
    [clients]
  );

  const filteredTable = useMemo(() => {
    if (!tableSearch) return clients;
    const q = tableSearch.toLowerCase();
    return clients.filter(c =>
      c.businessName.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.planName.toLowerCase().includes(q)
    );
  }, [clients, tableSearch]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Carteira"
        subtitle="Cadastre o restaurante uma vez e o sistema ja gera o acesso dele com login curto, senha inicial e restaurante vinculado."
        action={
          <Link to="/meu-gestor" className="btn-secondary">
            Voltar ao resumo
          </Link>
        }
      />

      {overview ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overview.cards.map((card) => (
            <div key={card.label} className="card">
              <p className="text-sm text-muted">{card.label}</p>
              <h3 className="mt-2 text-3xl font-bold">
                {card.label.includes("Receita") || card.label.includes("MRR") ? formatMoney(card.value) : String(card.value)}
              </h3>
            </div>
          ))}
        </div>
      ) : null}

      {/* Planilha geral */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Visao geral
            </p>
            <h3 className="mt-1 text-xl font-bold">Todos os clientes</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-56"
              placeholder="Filtrar tabela..."
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
            />
            <button className="btn-primary" type="button" onClick={() => exportCSV(filteredTable)}>
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl">
          <table className="table-base w-full min-w-[900px]">
            <thead>
              <tr>
                <th>Restaurante</th>
                <th>Responsavel</th>
                <th>Contato</th>
                <th>Plano</th>
                <th className="text-right">Mensalidade</th>
                <th className="text-right">Faturamento total</th>
                <th>Status</th>
                <th>Acesso</th>
                <th>Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {filteredTable.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted">Nenhum cliente encontrado.</td>
                </tr>
              ) : filteredTable.map(c => (
                <tr
                  key={c.id}
                  className="cursor-pointer transition hover:opacity-75"
                  onClick={() => setSelectedClient(c)}
                >
                  <td><strong>{c.businessName || "â€”"}</strong></td>
                  <td>{c.contactName || "â€”"}</td>
                  <td>
                    <span className="block text-sm">{c.email || "â€”"}</span>
                    <span className="block text-xs text-muted">{c.phone || ""}</span>
                  </td>
                  <td className="text-sm">{c.planName}</td>
                  <td className="text-right font-semibold">{formatMoney(c.monthlyFee)}</td>
                  <td className="text-right font-semibold">{formatMoney(totalClientRevenue(c))}</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className="rounded-full px-2 py-1 text-xs font-semibold"
                        style={{ background: statusBg[c.status].bg, color: statusBg[c.status].color }}>
                        {statusLabel[c.status]}
                      </span>
                      {(() => { const d = daysOverdue(c); return d !== null ? <OverdueBadge days={d} /> : null; })()}
                    </div>
                  </td>
                  <td>
                    <span className="rounded-full px-2 py-1 text-xs font-semibold"
                      style={{ background: accessBg[c.accessStatus].bg, color: accessBg[c.accessStatus].color }}>
                      {accessLabel[c.accessStatus]}
                    </span>
                  </td>
                  <td className="text-sm">{c.nextDueDate?.slice(0, 10) || "â€”"}</td>
                </tr>
              ))}
            </tbody>
            {filteredTable.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 font-semibold text-muted">
                    Total â€” {filteredTable.length} cliente{filteredTable.length !== 1 ? "s" : ""}
                  </td>
                  <td className="pt-3 text-right font-semibold">
                    {formatMoney(filteredTable.reduce((s, c) => s + c.monthlyFee, 0))}
                  </td>
                  <td className="pt-3 text-right font-semibold">
                    {formatMoney(filteredTable.reduce((s, c) => s + totalClientRevenue(c), 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <form
            className="card space-y-4"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              await apiRequest("/saas-clients", {
                method: "POST",
                token,
                body: {
                  businessName: String(formData.get("businessName") ?? ""),
                  contactName: String(formData.get("contactName") ?? ""),
                  phone: String(formData.get("phone") ?? ""),
                  email: String(formData.get("email") ?? ""),
                  accessLogin: String(formData.get("accessLogin")),
                  temporaryPassword: String(formData.get("temporaryPassword") ?? "12345"),
                  planName: String(formData.get("planName") ?? "Plano Base"),
                  monthlyFee: Number(formData.get("monthlyFee") ?? 0),
                  billingDay: Number(formData.get("billingDay") ?? 10),
                  nextDueDate: String(formData.get("nextDueDate")),
                  status: String(formData.get("status") ?? "TRIAL"),
                  accessStatus: String(formData.get("accessStatus") ?? "LIBERADO"),
                  notes: String(formData.get("notes") ?? ""),
                  lastPaymentDate: "",
                  payments: []
                }
              });
              event.currentTarget.reset();
              load(search);
            }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
                Gerar acesso inicial
              </p>
              <h3 className="mt-2 text-2xl font-bold">Novo restaurante</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="label">Nome do restaurante</span>
                <input className="input" name="businessName" placeholder="Ex: Restaurante do JoÃ£o" required />
              </label>
              <label className="space-y-1">
                <span className="label">ResponsÃ¡vel</span>
                <input className="input" name="contactName" placeholder="Nome do responsÃ¡vel" />
              </label>
              <label className="space-y-1">
                <span className="label">Telefone</span>
                <input className="input" name="phone" placeholder="(11) 99999-9999" />
              </label>
              <label className="space-y-1">
                <span className="label">E-mail</span>
                <input className="input" name="email" type="email" placeholder="contato@restaurante.com" />
              </label>
              <label className="space-y-1">
                <span className="label">Login do restaurante</span>
                <input className="input" name="accessLogin" placeholder="Ex: cura1" required />
              </label>
              <label className="space-y-1">
                <span className="label">Senha inicial</span>
                <input className="input" name="temporaryPassword" placeholder="Senha inicial" defaultValue="12345" required />
              </label>
              <label className="space-y-1">
                <span className="label">Plano</span>
                <input className="input" name="planName" placeholder="Plano contratado" defaultValue="Plano Base" />
              </label>
              <label className="space-y-1">
                <span className="label">Mensalidade</span>
                <input className="input" name="monthlyFee" type="number" step="0.01" placeholder="Valor mensal" required />
              </label>
              <label className="space-y-1">
                <span className="label">Dia do vencimento</span>
                <input className="input" name="billingDay" type="number" min="1" max="31" defaultValue="10" />
              </label>
              <label className="space-y-1">
                <span className="label">Proximo vencimento</span>
                <input className="input" name="nextDueDate" type="date" required />
              </label>
              <label className="space-y-1">
                <span className="label">Status do contrato</span>
                <select className="input" name="status" defaultValue="TRIAL">
                  <option value="TRIAL">Trial</option>
                  <option value="ATIVO">Ativo</option>
                  <option value="ATRASADO">Atrasado</option>
                  <option value="SUSPENSO">Suspenso</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Status de acesso</span>
                <select className="input" name="accessStatus" defaultValue="LIBERADO">
                  <option value="LIBERADO">Liberado</option>
                  <option value="BLOQUEIO_AVISO">Bloqueio com aviso</option>
                  <option value="BLOQUEADO">Bloqueado</option>
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="label">Observacoes internas</span>
                <textarea className="input min-h-24" name="notes" placeholder="Anotacoes de contrato, cobranca e combinados" />
              </label>
            </div>
            <button className="btn-primary">Criar restaurante e acesso</button>
          </form>

          <div className="card space-y-3">
            <h3 className="text-xl font-bold">Maior receita acumulada</h3>
            {topRevenue.length === 0 ? (
              <p className="text-sm text-muted">Ainda nao ha pagamentos registrados.</p>
            ) : (
              topRevenue.map((client) => (
                <div key={client.id} className="rounded-3xl p-4 surface-soft">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{client.businessName}</strong>
                    <span>{formatMoney(totalClientRevenue(client))}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {client.planName} Â· mensalidade {formatMoney(client.monthlyFee)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="input flex-1"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar restaurante, login, responsavel, email ou telefone..."
              />
              <button className="btn-secondary" type="button" onClick={() => load(search)}>
                Buscar
              </button>
            </div>
            <div className="space-y-3">
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="w-full rounded-3xl p-4 text-left surface-soft"
                  onClick={() => setSelectedClient(client)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <strong>{client.businessName}</strong>
                      <p className="text-sm text-muted">
                        {client.contactName} Â· {client.email || client.accessLogin} Â· vence {client.nextDueDate?.slice(0, 10) || "â€”"}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong>{formatMoney(client.monthlyFee)}</strong>
                      <p className="text-xs" style={{ color: statusBg[client.status].color }}>{statusLabel[client.status]}</p>
                      {(() => { const d = daysOverdue(client); return d !== null ? <OverdueBadge days={d} /> : null; })()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-4">
            {!selectedClient ? (
              <p className="text-sm text-muted">Clique em qualquer linha da tabela ou na lista para ver detalhes e editar.</p>
            ) : (
              <>
                <form
                  className="space-y-4"
                  onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    await apiRequest(`/saas-clients/${selectedClient.id}`, {
                      method: "PUT",
                      token,
                      body: {
                        businessName: String(formData.get("businessName")),
                        contactName: String(formData.get("contactName")),
                        accessLogin: String(formData.get("accessLogin") ?? ""),
                        temporaryPassword: String(formData.get("temporaryPassword") ?? ""),
                        phone: String(formData.get("phone") ?? ""),
                        email: String(formData.get("email") ?? ""),
                        planName: String(formData.get("planName") ?? ""),
                        monthlyFee: Number(formData.get("monthlyFee") ?? 0),
                        billingDay: Number(formData.get("billingDay") ?? 10),
                        nextDueDate: String(formData.get("nextDueDate") ?? ""),
                        lastPaymentDate: String(formData.get("lastPaymentDate") ?? ""),
                        status: String(formData.get("status") ?? "ATIVO"),
                        accessStatus: String(formData.get("accessStatus") ?? "LIBERADO"),
                        notes: String(formData.get("notes") ?? "")
                      }
                    });
                    load(search);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold">{selectedClient.businessName || "Cliente sem nome"}</h3>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={async () => {
                        if (!window.confirm("Excluir este cliente SaaS?")) return;
                        await apiRequest(`/saas-clients/${selectedClient.id}`, { method: "DELETE", token });
                        setSelectedClient(null);
                        load(search);
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input className="input" name="businessName" defaultValue={selectedClient.businessName} placeholder="Nome do restaurante" />
                    <input className="input" name="contactName" defaultValue={selectedClient.contactName} placeholder="Responsavel" />
                    <input className="input" name="accessLogin" defaultValue={selectedClient.accessLogin} placeholder="Login" />
                    <input className="input" name="temporaryPassword" placeholder="Nova senha temporaria (opcional)" />
                    <input className="input" name="phone" defaultValue={selectedClient.phone} placeholder="Telefone" />
                    <input className="input" name="email" defaultValue={selectedClient.email} placeholder="E-mail" />
                    <input className="input" name="planName" defaultValue={selectedClient.planName} placeholder="Plano" />
                    <input className="input" name="monthlyFee" type="number" step="0.01" defaultValue={selectedClient.monthlyFee} />
                    <input className="input" name="billingDay" type="number" min="1" max="31" defaultValue={selectedClient.billingDay} />
                    <input className="input" name="nextDueDate" type="date" defaultValue={selectedClient.nextDueDate} />
                    <input className="input" name="lastPaymentDate" type="date" defaultValue={selectedClient.lastPaymentDate} />
                    <select className="input" name="status" defaultValue={selectedClient.status}>
                      <option value="TRIAL">Trial</option>
                      <option value="ATIVO">Ativo</option>
                      <option value="ATRASADO">Atrasado</option>
                      <option value="SUSPENSO">Suspenso</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                    <select className="input" name="accessStatus" defaultValue={selectedClient.accessStatus}>
                      <option value="LIBERADO">Liberado</option>
                      <option value="BLOQUEIO_AVISO">Bloqueio com aviso</option>
                      <option value="BLOQUEADO">Bloqueado</option>
                    </select>
                    <textarea className="input md:col-span-2 min-h-24" name="notes" defaultValue={selectedClient.notes} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-3xl p-4 surface-soft">
                      <p className="text-xs text-muted">Mensalidade</p>
                      <strong>{formatMoney(selectedClient.monthlyFee)}</strong>
                    </div>
                    <div className="rounded-3xl p-4 surface-soft">
                      <p className="text-xs text-muted">Faturamento total</p>
                      <strong>{formatMoney(totalClientRevenue(selectedClient))}</strong>
                    </div>
                    <div className="rounded-3xl p-4 surface-soft">
                      <p className="text-xs text-muted">Acesso</p>
                      <strong style={{ color: accessBg[selectedClient.accessStatus].color }}>
                        {accessLabel[selectedClient.accessStatus]}
                      </strong>
                    </div>
                  </div>
                  <button className="btn-primary">Salvar alteracoes</button>
                </form>

                <form
                  className="rounded-3xl p-4 surface-soft"
                  onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    await apiRequest(`/saas-clients/${selectedClient.id}/payments`, {
                      method: "POST",
                      token,
                      body: {
                        amount: Number(formData.get("amount") ?? 0),
                        paidAt: String(formData.get("paidAt")),
                        referenceMonth: String(formData.get("referenceMonth") ?? ""),
                        notes: String(formData.get("notes") ?? "")
                      }
                    });
                    event.currentTarget.reset();
                    load(search);
                  }}
                >
                  <h4 className="text-lg font-bold">Registrar pagamento</h4>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input className="input" name="amount" type="number" step="0.01" placeholder="Valor recebido" required />
                    <input className="input" name="paidAt" type="date" required />
                    <input className="input" name="referenceMonth" placeholder="Referencia ex: 2026-04" />
                    <input className="input" name="notes" placeholder="Observacao do pagamento" />
                  </div>
                  <button className="btn-primary mt-3">Salvar pagamento</button>
                </form>

                <div className="space-y-3">
                  <h4 className="text-lg font-bold">Historico de receita</h4>
                  {selectedClient.payments.length === 0 ? (
                    <p className="text-sm text-muted">Nenhum pagamento registrado ainda.</p>
                  ) : (
                    selectedClient.payments.map((payment) => (
                      <div key={payment.id} className="rounded-3xl p-4 surface-soft">
                        <div className="flex items-center justify-between gap-3">
                          <strong>{formatMoney(payment.amount)}</strong>
                          <span className="text-sm text-muted">{payment.paidAt?.slice(0, 10)}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted">
                          {payment.referenceMonth || "Sem referencia"}{payment.notes ? ` Â· ${payment.notes}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
