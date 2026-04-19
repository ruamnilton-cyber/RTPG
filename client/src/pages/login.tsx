import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";

const commercialCards = [
  { title: "Operacao visual", desc: "Mesas, comandas, pedidos e fechamento em poucos cliques." },
  { title: "Cardapio com insumos", desc: "Produto, ficha tecnica, estoque e CMV trabalhando juntos." },
  { title: "Gestao financeira", desc: "DRE, despesas, vendas e margem para enxergar o lucro real." },
  { title: "QR Code e WhatsApp", desc: "Base pronta para autoatendimento, chamadas e automacoes." }
];

const moduleBadges = ["Mesas", "Cardapio", "Estoque", "CMV", "DRE", "QR Code", "Equipe", "Clientes"];

type LoginTab = "login" | "trial" | "lead" | "forgot";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, signupTrial } = useAuth();
  const [tab, setTab] = useState<LoginTab>("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  function changeTab(next: LoginTab) {
    setTab(next);
    setError("");
    setMessage("");
    if (next !== "lead") {
      setLeadSent(false);
    }
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
        businessName: String(fd.get("businessName") ?? ""),
        contactName: String(fd.get("contactName") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? "")
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
    <div className="min-h-screen overflow-hidden bg-[#120c07] p-4 text-stone-950 md:p-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(244,200,87,0.28),transparent_26%),radial-gradient(circle_at_82%_12%,rgba(201,154,46,0.32),transparent_24%),linear-gradient(135deg,#120c07,#3a210e_48%,#f0dba7)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-[2rem] bg-stone-50 shadow-[0_30px_90px_rgba(0,0,0,0.38)] md:min-h-[calc(100vh-4rem)] md:grid-cols-[1.12fr_0.88fr]">
        <section className="relative overflow-hidden bg-[#211207] p-7 text-white md:p-10">
          <div className="absolute -right-24 top-8 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.35em] text-brand-100">
                RTPG Gestao
              </div>

              <h1 className="mt-8 max-w-xl text-4xl font-black leading-tight md:text-5xl">
                Venda na mesa, controle o estoque e acompanhe a margem em tempo real.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-brand-100">
                Uma plataforma comercial para bares e restaurantes que precisam operar rapido sem perder controle de produto, insumo, caixa e resultado.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {commercialCards.map((card) => (
                  <div key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 shadow-lg shadow-black/10">
                    <span className="mb-3 block h-1.5 w-10 rounded-full bg-brand-300" />
                    <strong className="block text-sm text-white">{card.title}</strong>
                    <p className="mt-2 text-xs leading-5 text-brand-100">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-200">Teste autonomo</p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <strong className="block text-3xl">3</strong>
                    <span className="text-xs text-brand-100">dias de teste</span>
                  </div>
                  <div>
                    <strong className="block text-3xl">12</strong>
                    <span className="text-xs text-brand-100">mesas criadas</span>
                  </div>
                  <div>
                    <strong className="block text-3xl">1</strong>
                    <span className="text-xs text-brand-100">painel pronto</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {moduleBadges.map((module) => (
                  <span key={module} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-50">
                    {module}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center bg-stone-50 p-6 md:p-9">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">Acesso ao sistema</p>
            <h2 className="mt-2 text-3xl font-black text-stone-950">
              {tab === "trial" ? "Crie seu teste gratis" : tab === "lead" ? "Fale com a gente" : tab === "forgot" ? "Recuperar acesso" : "Entrar no RTPG"}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {tab === "trial"
                ? "O restaurante cria o acesso sozinho e ja entra no painel operacional."
                : "Escolha como quer continuar."}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-3 rounded-2xl bg-stone-200/80 p-1 text-sm font-bold">
            <button type="button" className={`rounded-xl px-3 py-2 transition ${tab === "login" ? "bg-white text-brand-800 shadow" : "text-stone-600"}`} onClick={() => changeTab("login")}>
              Entrar
            </button>
            <button type="button" className={`rounded-xl px-3 py-2 transition ${tab === "trial" ? "bg-white text-brand-800 shadow" : "text-stone-600"}`} onClick={() => changeTab("trial")}>
              Teste gratis
            </button>
            <button type="button" className={`rounded-xl px-3 py-2 transition ${tab === "lead" ? "bg-white text-brand-800 shadow" : "text-stone-600"}`} onClick={() => changeTab("lead")}>
              Contato
            </button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input className="input" name="email" type="text" placeholder="E-mail ou usuario" required autoFocus />
              <input className="input" name="password" type="password" placeholder="Senha" required />
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
              <button type="button" className="w-full text-center text-xs text-stone-500 underline" onClick={() => changeTab("forgot")}>
                Esqueci minha senha
              </button>
            </form>
          ) : null}

          {tab === "trial" ? (
            <form onSubmit={handleTrial} className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Sem esperar atendimento: preencha os dados, escolha uma senha e entre no painel do restaurante.
              </div>
              <input className="input" name="businessName" type="text" placeholder="Nome do restaurante ou bar" required autoFocus />
              <input className="input" name="contactName" type="text" placeholder="Seu nome" required />
              <input className="input" name="phone" type="tel" placeholder="WhatsApp com DDD" required />
              <input className="input" name="email" type="email" placeholder="E-mail de acesso" required />
              <input className="input" name="password" type="password" placeholder="Crie uma senha" required />
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Criando teste..." : "Criar teste gratis"}
              </button>
            </form>
          ) : null}

          {tab === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <input className="input" name="email" type="email" placeholder="seu@email.com" required autoFocus />
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Enviando..." : "Solicitar recuperacao"}
              </button>
              <button type="button" className="w-full text-center text-xs text-stone-500 underline" onClick={() => changeTab("login")}>
                Voltar ao login
              </button>
            </form>
          ) : null}

          {tab === "lead" && !leadSent ? (
            <form onSubmit={handleLead} className="space-y-4">
              <p className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
                Prefere uma configuracao acompanhada? Deixe seus dados para contato comercial.
              </p>
              <input className="input" name="nome" type="text" placeholder="Seu nome" required autoFocus />
              <input className="input" name="restaurante" type="text" placeholder="Nome do restaurante ou bar" required />
              <input className="input" name="telefone" type="tel" placeholder="WhatsApp com DDD" required />
              <input className="input" name="email" type="email" placeholder="E-mail opcional" />
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <button className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Enviando..." : "Enviar contato"}
              </button>
            </form>
          ) : null}

          {tab === "lead" && leadSent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl font-black text-emerald-700">OK</div>
              <h3 className="text-xl font-bold text-stone-950">Contato recebido</h3>
              <p className="text-sm text-stone-500">Seus dados ficaram salvos para retorno comercial.</p>
              <button type="button" className="btn-secondary w-full" onClick={() => changeTab("login")}>
                Voltar ao login
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
