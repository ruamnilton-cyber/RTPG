import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type PlanDef = {
  name: string;
  price: string;
  color: string;
  features: string[];
  highlight?: boolean;
};

const PLANS: PlanDef[] = [
  {
    name: "Plano Base",
    price: "R$ 197/mês",
    color: "#6b7280",
    features: [
      "Mesas e comandas digitais",
      "Cardápio com categorias",
      "Fechamento de comanda + Pix",
      "Caixa e sangria",
      "DRE simplificado",
      "1 usuário operador"
    ]
  },
  {
    name: "Plano Pro",
    price: "R$ 297/mês",
    color: "#d97706",
    highlight: true,
    features: [
      "Tudo do Plano Base",
      "Controle de estoque e insumos",
      "Ficha técnica e CMV real",
      "DRE completo por produto",
      "Relatórios avançados",
      "Clientes e CRM",
      "QR Code de cardápio",
      "KDS / Tela de cozinha",
      "Até 3 usuários"
    ]
  },
  {
    name: "Plano Premium",
    price: "R$ 497/mês",
    color: "#7c3aed",
    features: [
      "Tudo do Plano Pro",
      "WhatsApp e IA integrados",
      "Reservas de mesa",
      "Automação de atendimento",
      "Multi-unidade preparado",
      "Usuários ilimitados",
      "Suporte prioritário"
    ]
  }
];

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

function totalClientRevenue(client: SaasClient) {
  return client.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function CredentialsEmailButton({ client, token }: { client: SaasClient; token: string | null }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [senha, setSenha] = useState(client.temporaryPassword || "12345");

  if (!client.email) {
    return (
      <div className="rounded-3xl p-4 surface-soft text-sm text-muted">
        Cadastre o e-mail do cliente para poder enviar as credenciais por e-mail.
      </div>
    );
  }

  return (
    <div className="rounded-3xl p-4 surface-soft space-y-3">
      <div>
        <h4 className="text-lg font-bold">Enviar credenciais por e-mail</h4>
        <p className="text-sm text-muted">
          Envia login e senha para <strong>{client.email}</strong> com um e-mail bonito de boas-vindas.
        </p>
      </div>
      <label className="space-y-1">
        <span className="label">Senha a enviar</span>
        <input className="input font-mono" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha inicial" />
      </label>
      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
      <button
        type="button"
        className="btn-primary w-full"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          setMessage("");
          try {
            await apiRequest(`/saas-clients/${client.id}/send-credentials`, {
              method: "POST",
              token,
              body: { senha }
            });
            setMessage(`E-mail enviado para ${client.email}.`);
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Erro ao enviar e-mail.");
          } finally {
            setSending(false);
          }
        }}
      >
        {sending ? "Enviando..." : "Enviar credenciais por e-mail"}
      </button>
    </div>
  );
}

export function SaasClientsPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState<SaasClient[]>([]);
  const [overview, setOverview] = useState<SaasOverview | null>(null);
  const [selectedClient, setSelectedClient] = useState<SaasClient | null>(null);
  const [search, setSearch] = useState("");
  const [chargeResult, setChargeResult] = useState<{ pixCode: string; pixQrCodeBase64: string; dueDate: string } | null>(null);
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeError, setChargeError] = useState("");

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

  useEffect(() => {
    load();
  }, [token]);

  const topRevenue = useMemo(
    () => [...clients].sort((a, b) => totalClientRevenue(b) - totalClientRevenue(a)).slice(0, 5),
    [clients]
  );

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
                  accessLogin: String(formData.get("accessLogin")),
                  temporaryPassword: String(formData.get("temporaryPassword") ?? "12345"),
                  planName: String(formData.get("planName") ?? "Plano Base"),
                  monthlyFee: Number(formData.get("monthlyFee") ?? 0),
                  billingDay: Number(formData.get("billingDay") ?? 10),
                  nextDueDate: String(formData.get("nextDueDate")),
                  status: String(formData.get("status") ?? "TRIAL"),
                  accessStatus: String(formData.get("accessStatus") ?? "LIBERADO"),
                  notes: String(formData.get("notes") ?? ""),
                  businessName: "",
                  contactName: "",
                  phone: "",
                  email: "",
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
                <select className="input" name="planName" defaultValue="Plano Base">
                  {PLANS.map((p) => (
                    <option key={p.name} value={p.name}>{p.name} — {p.price}</option>
                  ))}
                </select>
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
                <textarea
                  className="input min-h-24"
                  name="notes"
                  placeholder="Anotacoes de contrato, cobranca e combinados"
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              Aqui voce gera apenas o acesso inicial e os dados de cobranca. O restante do perfil do restaurante ele preenche no proprio sistema, e essas informacoes passam a aparecer aqui para voce acompanhar.
            </p>
            <button className="btn-primary">Criar restaurante e acesso</button>
          </form>

          <div className="card space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
                Referencia de planos
              </p>
              <h3 className="mt-2 text-2xl font-bold">O que cada plano inclui</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className="rounded-3xl p-4 space-y-3"
                  style={{
                    border: `2px solid ${plan.highlight ? plan.color : "var(--color-border)"}`,
                    background: plan.highlight ? `color-mix(in srgb, ${plan.color} 6%, white)` : "var(--color-surface-alt)"
                  }}
                >
                  <div>
                    <p
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: plan.color }}
                    >
                      {plan.name}
                    </p>
                    <p className="mt-1 text-lg font-bold">{plan.price}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 shrink-0" style={{ color: plan.color }}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

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
                    login {client.accessLogin} · mensalidade {formatMoney(client.monthlyFee)}
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
                  onClick={() => { setSelectedClient(client); setChargeResult(null); setChargeError(""); }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <strong>{client.businessName}</strong>
                      <p className="text-sm text-muted">
                        {client.contactName} · login {client.accessLogin} · vencimento {client.nextDueDate || "nao informado"}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong>{formatMoney(client.monthlyFee)}</strong>
                      <p className="text-xs text-muted">{client.status}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-4">
            {!selectedClient ? (
              <p className="text-sm text-muted">Selecione um restaurante para ver login, receita, vencimento e acesso.</p>
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
                    <h3 className="text-xl font-bold">{selectedClient.businessName}</h3>
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
                    <input className="input" name="accessLogin" defaultValue={selectedClient.accessLogin} />
                    <input className="input" name="temporaryPassword" placeholder="Nova senha temporaria (opcional)" />
                    <input className="input" name="phone" defaultValue={selectedClient.phone} />
                    <input className="input" name="email" defaultValue={selectedClient.email} />
                    <select className="input" name="planName" defaultValue={selectedClient.planName}>
                      {PLANS.map((p) => (
                        <option key={p.name} value={p.name}>{p.name} — {p.price}</option>
                      ))}
                    </select>
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
                      <p className="text-xs text-muted">Receita acumulada</p>
                      <strong>{formatMoney(totalClientRevenue(selectedClient))}</strong>
                    </div>
                    <div className="rounded-3xl p-4 surface-soft">
                      <p className="text-xs text-muted">Acesso</p>
                      <strong>{selectedClient.accessStatus}</strong>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-3xl p-4 surface-soft">
                      <p className="text-xs text-muted">Login do restaurante</p>
                      <strong>{selectedClient.accessLogin}</strong>
                    </div>
                    <div className="rounded-3xl p-4 surface-soft">
                      <p className="text-xs text-muted">Usuario tecnico</p>
                      <strong>{selectedClient.linkedUserEmail || "Ainda nao vinculado"}</strong>
                    </div>
                    <div className="rounded-3xl p-4 surface-soft">
                      <p className="text-xs text-muted">Restaurante vinculado</p>
                      <strong>{selectedClient.linkedBarId || "Ainda nao vinculado"}</strong>
                    </div>
                  </div>

                  <button className="btn-primary">Salvar alteracoes</button>
                </form>

                <CredentialsEmailButton client={selectedClient} token={token} />

                <div className="rounded-3xl p-4 surface-soft space-y-3">
                  <div>
                    <h4 className="text-lg font-bold">Gerar cobrança Pix</h4>
                    <p className="text-sm text-muted">
                      Gera um Pix via Asaas no valor da mensalidade ({formatMoney(selectedClient.monthlyFee)}) para copiar e enviar ao cliente.
                    </p>
                  </div>
                  {chargeResult ? (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <img
                          src={`data:image/png;base64,${chargeResult.pixQrCodeBase64}`}
                          alt="QR Code Pix"
                          className="h-40 w-40 rounded-2xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted">Código Pix copia e cola</p>
                        <div className="flex gap-2">
                          <input
                            className="input flex-1 font-mono text-xs"
                            readOnly
                            value={chargeResult.pixCode}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <button
                            type="button"
                            className="btn-secondary shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(chargeResult.pixCode);
                            }}
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted">Vence em: {chargeResult.dueDate}</p>
                      <button
                        type="button"
                        className="btn-secondary w-full"
                        onClick={() => setChargeResult(null)}
                      >
                        Fechar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chargeError ? (
                        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{chargeError}</p>
                      ) : null}
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={chargeLoading || selectedClient.monthlyFee <= 0}
                        onClick={async () => {
                          setChargeLoading(true);
                          setChargeError("");
                          try {
                            const result = await apiRequest<{ pixCode: string; pixQrCodeBase64: string; dueDate: string }>(
                              `/saas-clients/${selectedClient.id}/charge`,
                              { method: "POST", token, body: { dueDays: 3 } }
                            );
                            setChargeResult(result);
                          } catch (err) {
                            setChargeError(err instanceof Error ? err.message : "Erro ao gerar cobrança.");
                          } finally {
                            setChargeLoading(false);
                          }
                        }}
                      >
                        {chargeLoading ? "Gerando..." : `Gerar Pix de ${formatMoney(selectedClient.monthlyFee)}`}
                      </button>
                    </div>
                  )}
                </div>

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
                          <span className="text-sm text-muted">{payment.paidAt}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted">
                          {payment.referenceMonth || "Sem referencia"} {payment.notes ? `· ${payment.notes}` : ""}
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
