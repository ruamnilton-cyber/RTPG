import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";
import {
  ANNUAL_DISCOUNT_RATE,
  SUBSCRIPTION_TRIAL_DAYS,
  getAnnualTotalPrice,
  getMonthlyEquivalentPrice,
  subscriptionPlans
} from "../../../shared/subscription-plans";
import type { BillingCycle, SubscriptionPlan, SubscriptionPlanId } from "../../../shared/subscription-plans";

type LoginTab = "login" | "trial" | "lead" | "forgot";
type IconName = "orders" | "stock" | "reports" | "delivery" | "menu" | "cash";

const proofItems = ["Bares", "Restaurantes", "Delivery", "Operacao de mesas", "Financeiro", "WhatsApp"];

const featureCards: Array<{ icon: IconName; title: string; desc: string }> = [
  { icon: "orders", title: "Gestao de pedidos", desc: "Abra mesas, lance itens e acompanhe comandas em uma tela visual." },
  { icon: "stock", title: "Estoque e insumos", desc: "Relacione cada produto aos insumos para entender consumo e CMV." },
  { icon: "reports", title: "Relatorios em tempo real", desc: "Veja vendas, margem, DRE e indicadores para decidir com seguranca." },
  { icon: "delivery", title: "Delivery e WhatsApp", desc: "Base pronta para atendimento, pedidos e automacao por WhatsApp." },
  { icon: "menu", title: "Cardapio digital", desc: "Produtos, categorias, precos e QR Codes separados por restaurante." },
  { icon: "cash", title: "Controle de caixa", desc: "Abertura, movimentacoes, fechamento e visao financeira da operacao." }
];

const processSteps = [
  { step: "01", title: "Cadastre o restaurante", desc: "Crie o teste, informe os dados principais e entre no painel em minutos." },
  { step: "02", title: "Configure cardapio e mesas", desc: "Monte categorias, produtos, insumos, mesas e QR Codes do ambiente." },
  { step: "03", title: "Opere com controle", desc: "Lance vendas, acompanhe estoque, financeiro, clientes e relatorios." }
];

const dashboardStats = [
  { label: "Vendas hoje", value: "R$ 4.820" },
  { label: "Mesas abertas", value: "18" },
  { label: "Margem estimada", value: "62%" }
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function Icon({ name }: { name: IconName }) {
  const common = "M4 7.5h16M7 4.5h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z";
  const paths: Record<IconName, string[]> = {
    orders: [common, "M8 11h4M8 14h7"],
    stock: ["M12 3 4.5 7.2 12 11.4l7.5-4.2L12 3Z", "M4.5 7.2v8.5L12 20l7.5-4.3V7.2", "M12 11.4V20"],
    reports: ["M5 19V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14", "M8 16v-4M12 16V8M16 16v-6", "M4 19h16"],
    delivery: ["M4 16h2.5M17.5 16H20V9h-3l-2-3H4v10h2.5", "M8.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M15 6v4h5"],
    menu: ["M6 4h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z", "M8 8h8M8 12h8M8 16h5"],
    cash: ["M4 7h16v10H4V7Z", "M7 10h3M14 14h3", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"]
  };

  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[name].map((path) => (
        <path key={path} d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] rounded-[2rem] border border-white/10 bg-[#15110d] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="rounded-[1.4rem] bg-[#f7f0e4] p-4 text-[#21170f] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#e8dcc9] pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8f5f31]">Painel RTPG</p>
            <h3 className="mt-1 text-xl font-black">Operacao de hoje</h3>
          </div>
          <div className="rounded-full bg-[#21170f] px-3 py-2 text-xs font-bold text-white">Ao vivo</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {dashboardStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#e6d8c3] bg-white p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#826b55]">{stat.label}</p>
              <strong className="mt-2 block text-xl font-black">{stat.value}</strong>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-[#e6d8c3] bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-black">Mesas</span>
              <span className="text-xs font-bold text-[#8f5f31]">18 abertas</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, index) => (
                <span
                  key={index}
                  className={`flex aspect-square items-center justify-center rounded-xl text-xs font-black ${
                    index % 3 === 0 ? "bg-[#21170f] text-white" : index % 3 === 1 ? "bg-[#c99a2e] text-[#17110b]" : "bg-[#efe4d2] text-[#5b4632]"
                  }`}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e6d8c3] bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-black">Comanda mesa 07</span>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Aberta</span>
            </div>
            {[
              ["2x Camarao crocante", "R$ 260,00"],
              ["1x Batata cheddar", "R$ 55,00"],
              ["3x Refrigerante", "R$ 36,00"]
            ].map(([item, price]) => (
              <div key={item} className="flex justify-between border-t border-[#f0e6d9] py-2 text-sm">
                <span>{item}</span>
                <strong>{price}</strong>
              </div>
            ))}
            <div className="mt-3 rounded-xl bg-[#21170f] px-3 py-2 text-sm font-black text-white">Total: R$ 351,00</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessPanel({
  tab,
  changeTab,
  handleLogin,
  handleTrial,
  handleForgot,
  handleLead,
  loading,
  error,
  message,
  leadSent,
  selectedPlan
}: {
  tab: LoginTab;
  changeTab: (tab: LoginTab) => void;
  handleLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleTrial: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleForgot: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleLead: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  loading: boolean;
  error: string;
  message: string;
  leadSent: boolean;
  selectedPlan: SubscriptionPlan;
}) {
  const [trialForm, setTrialForm] = useState({
    businessName: "",
    contactName: "",
    phone: "",
    email: "",
    password: ""
  });

  return (
    <div id="acesso" className="rounded-[1.75rem] border border-stone-200 bg-white p-5 text-stone-950 shadow-[0_22px_70px_rgba(28,18,10,0.16)] sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8f5f31]">Acesso ao sistema</p>
        <h2 className="mt-2 text-2xl font-black">
          {tab === "trial" ? "Crie seu teste gratis" : tab === "lead" ? "Solicite uma demonstracao" : tab === "forgot" ? "Recuperar acesso" : "Entrar no RTPG"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {tab === "trial"
            ? "O restaurante cria o acesso sozinho e ja entra no painel operacional."
            : "Entre, crie um teste ou fale com a gente para configurar acompanhado."}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-3 rounded-2xl bg-stone-100 p-1 text-sm font-bold">
        <button type="button" className={`rounded-xl px-3 py-2 transition ${tab === "login" ? "bg-white text-[#8f5f31] shadow" : "text-stone-600"}`} onClick={() => changeTab("login")}>
          Entrar
        </button>
        <button type="button" className={`rounded-xl px-3 py-2 transition ${tab === "trial" ? "bg-white text-[#8f5f31] shadow" : "text-stone-600"}`} onClick={() => changeTab("trial")}>
          Teste
        </button>
        <button type="button" className={`rounded-xl px-3 py-2 transition ${tab === "lead" ? "bg-white text-[#8f5f31] shadow" : "text-stone-600"}`} onClick={() => changeTab("lead")}>
          Demo
        </button>
      </div>

      {tab === "login" ? (
        <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
          <input className="input !bg-white !text-stone-950 placeholder:text-stone-400" name="email" type="text" placeholder="E-mail ou usuario" autoComplete="username" required />
          <input className="input !bg-white !text-stone-950 placeholder:text-stone-400" name="password" type="password" placeholder="Senha" autoComplete="current-password" required />
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button className="btn-primary w-full py-3" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
          <button type="button" className="w-full text-center text-xs font-semibold text-stone-500 underline" onClick={() => changeTab("forgot")}>Esqueci minha senha</button>
        </form>
      ) : null}

      {tab === "trial" ? (
        <form onSubmit={handleTrial} className="space-y-4" autoComplete="off">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Sem esperar atendimento: teste gratis do Plano {selectedPlan.name} por {SUBSCRIPTION_TRIAL_DAYS} dias.
          </div>
          <input type="hidden" name="planId" value={selectedPlan.id} />
          <input
            className="input !bg-white !text-stone-950 placeholder:text-stone-400"
            name="trialBusinessName"
            type="text"
            placeholder="Nome do restaurante ou bar"
            value={trialForm.businessName}
            autoComplete="organization"
            onChange={(event) => setTrialForm((current) => ({ ...current, businessName: event.target.value }))}
            required
          />
          <input
            className="input !bg-white !text-stone-950 placeholder:text-stone-400"
            name="trialContactName"
            type="text"
            placeholder="Seu nome"
            value={trialForm.contactName}
            autoComplete="name"
            onChange={(event) => setTrialForm((current) => ({ ...current, contactName: event.target.value }))}
            required
          />
          <input
            className="input !bg-white !text-stone-950 placeholder:text-stone-400"
            name="trialPhone"
            type="tel"
            placeholder="WhatsApp com DDD"
            value={trialForm.phone}
            autoComplete="tel"
            onChange={(event) => setTrialForm((current) => ({ ...current, phone: event.target.value }))}
            required
          />
          <input
            className="input !bg-white !text-stone-950 placeholder:text-stone-400"
            name="trialAccessEmail"
            type="email"
            placeholder="E-mail de acesso"
            value={trialForm.email}
            autoComplete="off"
            autoCapitalize="none"
            onChange={(event) => setTrialForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
          <input
            className="input !bg-white !text-stone-950 placeholder:text-stone-400"
            name="trialAccessPassword"
            type="password"
            placeholder="Crie sua senha"
            value={trialForm.password}
            autoComplete="new-password"
            onChange={(event) => setTrialForm((current) => ({ ...current, password: event.target.value }))}
            required
          />
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button className="btn-primary w-full py-3" disabled={loading}>{loading ? "Criando teste..." : "Comecar agora"}</button>
        </form>
      ) : null}

      {tab === "forgot" ? (
        <form onSubmit={handleForgot} className="space-y-4">
          <input className="input !bg-white !text-stone-950 placeholder:text-stone-400" name="email" type="email" placeholder="seu@email.com" required />
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
          <button className="btn-primary w-full py-3" disabled={loading}>{loading ? "Enviando..." : "Solicitar recuperacao"}</button>
          <button type="button" className="w-full text-center text-xs font-semibold text-stone-500 underline" onClick={() => changeTab("login")}>Voltar ao login</button>
        </form>
      ) : null}

      {tab === "lead" && !leadSent ? (
        <form onSubmit={handleLead} className="space-y-4">
          <p className="rounded-2xl bg-[#f6edd8] p-4 text-sm text-[#4b351f]">Prefere uma configuracao acompanhada? Deixe seus dados para contato comercial.</p>
          <input className="input !bg-white !text-stone-950 placeholder:text-stone-400" name="nome" type="text" placeholder="Seu nome" required />
          <input className="input !bg-white !text-stone-950 placeholder:text-stone-400" name="restaurante" type="text" placeholder="Nome do restaurante ou bar" required />
          <input className="input !bg-white !text-stone-950 placeholder:text-stone-400" name="telefone" type="tel" placeholder="WhatsApp com DDD" required />
          <input className="input !bg-white !text-stone-950 placeholder:text-stone-400" name="email" type="email" placeholder="E-mail opcional" />
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button className="btn-primary w-full py-3" disabled={loading}>{loading ? "Enviando..." : "Solicitar demonstracao"}</button>
        </form>
      ) : null}

      {tab === "lead" && leadSent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-xl font-black text-emerald-700">OK</div>
          <h3 className="text-xl font-bold text-stone-950">Contato recebido</h3>
          <p className="text-sm text-stone-500">Seus dados ficaram salvos para retorno comercial.</p>
          <button type="button" className="btn-secondary w-full !bg-stone-900 !text-white" onClick={() => changeTab("login")}>Voltar ao login</button>
        </div>
      ) : null}
    </div>
  );
}

function PricingSection({
  billingCycle,
  setBillingCycle,
  onStart
}: {
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  onStart: (planId: SubscriptionPlanId) => void;
}) {
  const annualDiscountPercent = Math.round(ANNUAL_DISCOUNT_RATE * 100);

  return (
    <section id="planos" aria-labelledby="pricing-title" className="bg-[#fffaf2] px-5 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#8f5f31]">Planos</p>
            <h2 id="pricing-title" className="mt-3 text-4xl font-black tracking-tight text-[#21170f] md:text-5xl">
              Escolha o plano certo para o tamanho da sua operacao.
            </h2>
            <p className="mt-4 text-lg leading-8 text-stone-600">
              Comece simples e evolua para estoque, delivery, multiunidades e relatorios avancados quando precisar.
            </p>
          </div>

          <div className="w-fit rounded-full border border-[#e2d1ba] bg-[#f6efe4] p-1" role="group" aria-label="Periodo de cobranca">
            <button
              type="button"
              aria-pressed={billingCycle === "monthly"}
              className={`rounded-full px-5 py-2 text-sm font-black transition ${billingCycle === "monthly" ? "bg-[#21170f] text-white" : "text-stone-600"}`}
              onClick={() => setBillingCycle("monthly")}
            >
              Mensal
            </button>
            <button
              type="button"
              aria-pressed={billingCycle === "annual"}
              className={`rounded-full px-5 py-2 text-sm font-black transition ${billingCycle === "annual" ? "bg-[#21170f] text-white" : "text-stone-600"}`}
              onClick={() => setBillingCycle("annual")}
            >
              Anual -{annualDiscountPercent}%
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {subscriptionPlans.map((plan) => {
            const price = getMonthlyEquivalentPrice(plan, billingCycle);
            const annualTotal = getAnnualTotalPrice(plan);
            const isHighlighted = Boolean(plan.highlighted);

            return (
              <article
                key={plan.id}
                className={`relative flex rounded-[1.75rem] border bg-white p-6 shadow-[0_18px_55px_rgba(55,35,16,0.08)] ${
                  isHighlighted ? "border-[#c99a2e] ring-4 ring-[#c99a2e]/15 lg:-mt-4 lg:mb-4" : "border-[#e2d1ba]"
                }`}
              >
                {plan.badge ? (
                  <span className="absolute right-5 top-5 rounded-full bg-[#c99a2e] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#21170f]">
                    {plan.badge}
                  </span>
                ) : null}

                <div className="flex w-full flex-col">
                  <div className="pr-24">
                    <h3 className="text-2xl font-black text-[#21170f]">{plan.name}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-stone-600">{plan.audience}</p>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-end gap-2">
                      <strong className="text-4xl font-black tracking-tight text-[#21170f]">{formatCurrency(price)}</strong>
                      <span className="pb-1 text-sm font-bold text-stone-500">/mes</span>
                    </div>
                    {billingCycle === "annual" ? (
                      <p className="mt-2 text-sm text-emerald-700">
                        Cobrado anualmente: {formatCurrency(annualTotal)}. Voce economiza {annualDiscountPercent}%.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-stone-500">Cobranca mensal, ideal para comecar.</p>
                    )}
                  </div>

                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm leading-6 text-stone-700">
                        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700" aria-hidden="true">
                          OK
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className={`mt-7 rounded-full px-5 py-3 text-sm font-black transition ${
                      isHighlighted ? "bg-[#c99a2e] text-[#21170f] hover:bg-[#d8aa40]" : "bg-[#21170f] text-white hover:bg-[#3a2a1e]"
                    }`}
                    onClick={() => onStart(plan.id)}
                  >
                    Comecar agora
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-stone-600">
          Todos os planos incluem {SUBSCRIPTION_TRIAL_DAYS} dias gratis. Sem cartao de credito.
        </p>
      </div>
    </section>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, signupTrial } = useAuth();
  const [tab, setTab] = useState<LoginTab>("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>("professional");
  const selectedPlan = subscriptionPlans.find((plan) => plan.id === selectedPlanId) ?? subscriptionPlans[1];

  function changeTab(next: LoginTab) {
    setTab(next);
    setError("");
    setMessage("");
    if (next !== "lead") setLeadSent(false);
  }

  function focusAccess(next: LoginTab, planId?: SubscriptionPlanId) {
    if (planId) {
      setSelectedPlanId(planId);
    }
    changeTab(next);
    window.setTimeout(() => document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(event.currentTarget);
    try {
      const logged = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
      navigate(logged.email === "admin@rtpg.local" ? "/meu-gestor" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(event.currentTarget);
    try {
      await signupTrial({
        businessName: String(fd.get("trialBusinessName") ?? ""),
        contactName: String(fd.get("trialContactName") ?? ""),
        phone: String(fd.get("trialPhone") ?? ""),
        email: String(fd.get("trialAccessEmail") ?? ""),
        password: String(fd.get("trialAccessPassword") ?? ""),
        planId: String(fd.get("planId") ?? selectedPlanId)
      });
      navigate("/painel-dono");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar o teste.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const fd = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email: String(fd.get("email") ?? "") }
      });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao solicitar recuperacao.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(event.currentTarget);
    try {
      await apiRequest("/auth/lead", {
        method: "POST",
        body: {
          nome: String(fd.get("nome") ?? ""),
          restaurante: String(fd.get("restaurante") ?? ""),
          telefone: String(fd.get("telefone") ?? ""),
          email: String(fd.get("email") ?? "")
        }
      });
      setLeadSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar contato.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6efe4] text-stone-950">
      <header className="border-b border-stone-200/80 bg-[#fffaf2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#21170f] text-lg font-black text-[#f4c857]">R</div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#8f5f31]">RTPG</p>
              <p className="text-xs font-semibold text-stone-500">PDV e gestao para restaurantes</p>
            </div>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-bold text-stone-600 md:flex">
            <a href="#features" className="hover:text-[#8f5f31]">Funcionalidades</a>
            <a href="#planos" className="hover:text-[#8f5f31]">Planos</a>
            <a href="#como-funciona" className="hover:text-[#8f5f31]">Como funciona</a>
            <a href="#acesso" className="hover:text-[#8f5f31]">Entrar</a>
          </nav>
          <button type="button" className="rounded-full bg-[#21170f] px-4 py-2 text-sm font-black text-white" onClick={() => focusAccess("trial")}>Comecar agora</button>
        </div>
      </header>

      <main>
        <section className="bg-[#fffaf2]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit rounded-full border border-[#ead9bf] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#8f5f31]">
                PDV completo para operacao real
              </div>
              <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-[#21170f] md:text-6xl lg:text-7xl">
                Gerencie seu restaurante com total controle.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600 md:text-xl">
                PDV completo, relatorios em tempo real, controle de estoque por insumos e gestao de pedidos integrada para vender melhor e enxergar o lucro.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" className="rounded-full bg-[#c99a2e] px-7 py-4 text-base font-black text-[#17110b] shadow-[0_16px_36px_rgba(201,154,46,0.28)] transition hover:bg-[#d8aa40]" onClick={() => focusAccess("trial")}>
                  Comecar agora
                </button>
                <button type="button" className="rounded-full border border-[#21170f] px-7 py-4 text-base font-black text-[#21170f] transition hover:bg-[#21170f] hover:text-white" onClick={() => focusAccess("lead")}>
                  Solicitar demonstracao
                </button>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-t border-stone-200 pt-6">
                <div><strong className="block text-2xl font-black">{SUBSCRIPTION_TRIAL_DAYS} dias</strong><span className="text-sm text-stone-500">teste autonomo</span></div>
                <div><strong className="block text-2xl font-black">12 mesas</strong><span className="text-sm text-stone-500">criadas no inicio</span></div>
                <div><strong className="block text-2xl font-black">24h</strong><span className="text-sm text-stone-500">dados salvos</span></div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-rows-[auto_1fr]">
              <DashboardMockup />
              <AccessPanel
                tab={tab}
                changeTab={changeTab}
                handleLogin={handleLogin}
                handleTrial={handleTrial}
                handleForgot={handleForgot}
                handleLead={handleLead}
                loading={loading}
                error={error}
                message={message}
                leadSent={leadSent}
                selectedPlan={selectedPlan}
              />
            </div>
          </div>
        </section>

        <section className="border-y border-[#e3d4bf] bg-[#21170f] px-5 py-5 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#f3e1a8]">Pronto para operar em varios modelos</p>
            <div className="flex flex-wrap gap-2">
              {proofItems.map((item) => (
                <span key={item} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-[#f9f3e4]">{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-[#f6efe4] px-5 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#8f5f31]">Funcionalidades</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-[#21170f] md:text-5xl">Tudo que o restaurante precisa para parar de operar no escuro.</h2>
              <p className="mt-4 text-lg leading-8 text-stone-600">Do primeiro pedido ao fechamento financeiro, o RTPG conecta venda, estoque, equipe e resultado em uma experiencia simples.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {featureCards.map((feature) => (
                <article key={feature.title} className="rounded-[1.5rem] border border-[#e2d1ba] bg-[#fffaf2] p-6 shadow-[0_18px_45px_rgba(55,35,16,0.08)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#21170f] text-[#f4c857]"><Icon name={feature.icon} /></div>
                  <h3 className="mt-5 text-xl font-black text-[#21170f]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{feature.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <PricingSection
          billingCycle={billingCycle}
          setBillingCycle={setBillingCycle}
          onStart={(planId) => focusAccess("trial", planId)}
        />

        <section id="como-funciona" className="bg-[#fffaf2] px-5 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-[#8f5f31]">Como funciona</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight text-[#21170f] md:text-5xl">Da configuracao ao atendimento em tres passos.</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {processSteps.map((step) => (
                  <div key={step.step} className="rounded-[1.5rem] border border-[#e2d1ba] bg-white p-6">
                    <span className="text-sm font-black text-[#8f5f31]">{step.step}</span>
                    <h3 className="mt-4 text-xl font-black text-[#21170f]">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-stone-600">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f6efe4] px-5 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-8 rounded-[2rem] bg-[#21170f] p-6 text-white shadow-[0_26px_80px_rgba(33,23,15,0.24)] md:grid-cols-[0.7fr_1.3fr] md:p-10">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#c99a2e] text-2xl font-black text-[#21170f]">MR</div>
              <div>
                <h3 className="text-xl font-black">Marina Rocha</h3>
                <p className="text-sm text-[#f3e1a8]">Restaurante Mar de Dentro</p>
              </div>
            </div>
            <blockquote className="text-2xl font-black leading-snug md:text-3xl">
              "O RTPG juntou mesa, cardapio, estoque e financeiro num lugar so. A operacao ficou mais rapida e a margem deixou de ser chute."
            </blockquote>
          </div>
        </section>

        <section className="bg-[#c99a2e] px-5 py-16 text-[#21170f] lg:px-8 lg:py-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.22em]">Pronto para vender com controle?</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Coloque seu restaurante no RTPG hoje.</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className="rounded-full bg-[#21170f] px-7 py-4 font-black text-white" onClick={() => focusAccess("trial")}>Comecar teste</button>
              <button type="button" className="rounded-full border border-[#21170f] px-7 py-4 font-black" onClick={() => focusAccess("lead")}>Falar com comercial</button>
            </div>
          </div>
        </section>

      <footer className="border-t border-[#e3d4bf] bg-[#21170f] px-5 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-[#a8936e]">
          <p>RTPG &copy; {new Date().getFullYear()} &mdash; PDV e gestao para restaurantes</p>
          <div className="flex gap-5">
            <a href="/privacidade" className="hover:text-[#f3e1a8] transition">Politica de Privacidade</a>
            <a href="/termos" className="hover:text-[#f3e1a8] transition">Termos de Uso</a>
          </div>
        </div>
      </footer>
      </main>
    </div>
  );
}

