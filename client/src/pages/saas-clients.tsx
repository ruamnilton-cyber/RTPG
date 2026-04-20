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

type SaasBillingCharge = {
  id: string;
  provider: "ASAAS";
  externalId: string;
  amount: number;
  dueDate: string;
  referenceMonth: string;
  description: string;
  status: "PENDENTE" | "PAGO" | "VENCIDO" | "CANCELADO" | "FALHOU";
  invoiceUrl: string;
  bankSlipUrl: string;
  pixQrCode: string;
  pixQrCodeBase64: string;
  paidAt: string;
  createdAt: string;
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
  cpfCnpj: string;
  asaasCustomerId: string;
  planName: string;
  monthlyFee: number;
  billingDay: number;
  nextDueDate: string;
  lastPaymentDate: string;
  status: "ATIVO" | "TRIAL" | "ATRASADO" | "SUSPENSO" | "CANCELADO";
  accessStatus: "LIBERADO" | "BLOQUEIO_AVISO" | "BLOQUEADO";
  notes: string;
  payments: SaasPayment[];
  billingCharges: SaasBillingCharge[];
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

function currentReferenceMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function SaasClientsPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState<SaasClient[]>([]);
  const [overview, setOverview] = useState<SaasOverview | null>(null);
  const [selectedClient, setSelectedClient] = useState<SaasClient | null>(null);
  const [search, setSearch] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingResult, setBillingResult] = useState<{ client: SaasClient | null; charge: SaasBillingCharge } | null>(null);

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
                  businessName: String(formData.get("businessName") ?? ""),
                  contactName: String(formData.get("contactName") ?? ""),
                  phone: String(formData.get("phone") ?? ""),
                  email: String(formData.get("email") ?? ""),
                  cpfCnpj: String(formData.get("cpfCnpj") ?? ""),
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
                  payments: [],
                  billingCharges: []
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
                <span className="label">Nome do restaurante</span>
                <input className="input" name="businessName" placeholder="Ex: Bar Cura Ressaca" />
              </label>
              <label className="space-y-1">
                <span className="label">Responsavel</span>
                <input className="input" name="contactName" placeholder="Nome do cliente" />
              </label>
              <label className="space-y-1">
                <span className="label">WhatsApp</span>
                <input className="input" name="phone" placeholder="DDD + numero" />
              </label>
              <label className="space-y-1">
                <span className="label">Email de cobranca</span>
                <input className="input" name="email" type="email" placeholder="cliente@email.com" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="label">CPF/CNPJ para Asaas</span>
                <input className="input" name="cpfCnpj" inputMode="numeric" placeholder="CPF ou CNPJ do pagador" />
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
                  onClick={() => {
                    setSelectedClient(client);
                    setBillingResult(null);
                  }}
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
                        cpfCnpj: String(formData.get("cpfCnpj") ?? ""),
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
                    <input className="input" name="cpfCnpj" defaultValue={selectedClient.cpfCnpj} placeholder="CPF/CNPJ para cobranca Asaas" />
                    <input className="input" name="planName" defaultValue={selectedClient.planName} />
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
                    <div className="rounded-3xl p-4 surface-soft">
                      <p className="text-xs text-muted">Cliente Asaas</p>
                      <strong>{selectedClient.asaasCustomerId || "Ainda nao criado"}</strong>
                    </div>
                  </div>

                  <button className="btn-primary">Salvar alteracoes</button>
                </form>

                <form
                  className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4"
                  onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    setBillingLoading(true);
                    try {
                      const result = await apiRequest<{ client: SaasClient | null; charge: SaasBillingCharge }>(
                        `/saas-clients/${selectedClient.id}/billing/asaas-pix`,
                        {
                          method: "POST",
                          token,
                          body: {
                            amount: Number(formData.get("amount") ?? selectedClient.monthlyFee),
                            dueDate: String(formData.get("dueDate") ?? selectedClient.nextDueDate),
                            referenceMonth: String(formData.get("referenceMonth") ?? currentReferenceMonth()),
                            description: String(formData.get("description") ?? "")
                          }
                        }
                      );
                      setBillingResult(result);
                      if (result.client) setSelectedClient(result.client);
                      load(search);
                    } finally {
                      setBillingLoading(false);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Asaas</p>
                      <h4 className="mt-1 text-lg font-bold">Gerar cobranca Pix automatica</h4>
                      <p className="text-sm text-muted">
                        Essa cobranca cai na sua conta Asaas da plataforma. Quando o Asaas confirmar, o pagamento entra no historico automaticamente.
                      </p>
                    </div>
                    {!selectedClient.cpfCnpj ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        Informe CPF/CNPJ antes
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input className="input" name="amount" type="number" step="0.01" defaultValue={selectedClient.monthlyFee} placeholder="Valor" required />
                    <input className="input" name="dueDate" type="date" defaultValue={selectedClient.nextDueDate} required />
                    <input className="input" name="referenceMonth" defaultValue={currentReferenceMonth()} placeholder="Referencia ex: 2026-04" />
                    <input className="input" name="description" placeholder="Descricao opcional da cobranca" />
                  </div>

                  <button className="btn-primary mt-3" disabled={billingLoading}>
                    {billingLoading ? "Gerando Pix..." : "Gerar Pix Asaas"}
                  </button>

                  {billingResult?.charge && billingResult.client?.id === selectedClient.id ? (
                    <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
                      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                        {billingResult.charge.pixQrCodeBase64 ? (
                          <img
                            className="h-40 w-40 rounded-2xl border border-stone-200 bg-white object-contain p-2"
                            src={`data:image/png;base64,${billingResult.charge.pixQrCodeBase64}`}
                            alt="QR Code Pix Asaas"
                          />
                        ) : null}
                        <div className="min-w-0 space-y-3">
                          <div>
                            <p className="text-xs text-muted">Status</p>
                            <strong>{billingResult.charge.status}</strong>
                          </div>
                          <textarea className="input min-h-24 text-xs" readOnly value={billingResult.charge.pixQrCode} />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => navigator.clipboard.writeText(billingResult.charge.pixQrCode)}
                            >
                              Copiar Pix
                            </button>
                            {billingResult.charge.invoiceUrl ? (
                              <a className="btn-secondary" href={billingResult.charge.invoiceUrl} target="_blank" rel="noreferrer">
                                Abrir cobranca
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </form>

                <div className="rounded-3xl p-4 surface-soft">
                  <h4 className="text-lg font-bold">Cobrancas Asaas</h4>
                  <div className="mt-3 space-y-3">
                    {selectedClient.billingCharges.length === 0 ? (
                      <p className="text-sm text-muted">Nenhuma cobranca Asaas gerada ainda.</p>
                    ) : (
                      selectedClient.billingCharges.map((charge) => (
                        <div key={charge.id} className="rounded-3xl bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <strong>{formatMoney(charge.amount)}</strong>
                              <p className="text-sm text-muted">
                                {charge.referenceMonth || "Sem referencia"} - vence {charge.dueDate} - {charge.status}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {charge.invoiceUrl ? (
                                <a className="btn-secondary" href={charge.invoiceUrl} target="_blank" rel="noreferrer">
                                  Abrir
                                </a>
                              ) : null}
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={async () => {
                                  const client = await apiRequest<SaasClient>(
                                    `/saas-clients/${selectedClient.id}/billing/${charge.id}/refresh`,
                                    { method: "POST", token }
                                  );
                                  setSelectedClient(client);
                                  load(search);
                                }}
                              >
                                Atualizar status
                              </button>
                            </div>
                          </div>
                          {charge.paidAt ? <p className="mt-2 text-xs text-emerald-700">Pago em {charge.paidAt.slice(0, 10)}</p> : null}
                        </div>
                      ))
                    )}
                  </div>
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
