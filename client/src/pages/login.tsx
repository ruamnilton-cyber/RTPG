import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";

const features = [
  { icon: "🍽️", title: "Mesas e comandas digitais", desc: "Abertura, pedidos e fechamento com Pix integrado." },
  { icon: "💳", title: "Pagamento via Pix", desc: "Mercado Pago e Asaas com fallback automático." },
  { icon: "📦", title: "Estoque e insumos", desc: "Controle de estoque com ficha técnica e CMV real." },
  { icon: "📊", title: "DRE em tempo real", desc: "Resultado por produto, despesas e lucro no dia." }
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [tab, setTab] = useState<"login" | "lead" | "forgot">("login");
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  useEffect(() => {
    apiRequest<{ needsBootstrap: boolean }>("/auth/bootstrap-status")
      .then((r) => { if (r.needsBootstrap) setTab("login"); })
      .catch(() => {});
  }, []);

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

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email: String(fd.get("email") ?? "") }
      });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao solicitar.");
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
          nome:        String(fd.get("nome") ?? ""),
          restaurante: String(fd.get("restaurante") ?? ""),
          telefone:    String(fd.get("telefone") ?? ""),
          email:       String(fd.get("email") ?? "")
        }
      });
      setLeadSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,_#1a0f05,_#7a4f18,_#e8c97a)] p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.35)] md:grid md:grid-cols-[1.15fr_0.85fr]">

        {/* ── Lado esquerdo: marketing ─────────────────────────────────── */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#1c1007] p-8 text-white md:p-10">
          {/* gradiente decorativo */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#a06820_0%,_transparent_60%)] opacity-40" />

          <div className="relative">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
              RTPG Gestão
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
              Gestão completa para<br />bar e restaurante
            </h1>
            <p className="mt-3 text-base leading-relaxed text-white/70">
              Do pedido ao fechamento — mesas, estoque, Pix e relatórios em um só sistema, simples de operar.
            </p>
          </div>

          <div className="relative mt-8 grid gap-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-2xl bg-white/8 p-4 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.07)" }}>
                <span className="mt-0.5 text-2xl leading-none">{f.icon}</span>
                <div>
                  <strong className="block text-sm font-semibold text-white">{f.title}</strong>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["🍺","🍕","🥩"].map((e, i) => (
                <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1c1007] bg-amber-700 text-sm">{e}</div>
              ))}
            </div>
            <p className="text-xs text-white/50">Restaurantes que já usam o sistema</p>
          </div>
        </section>

        {/* ── Lado direito: formulários ────────────────────────────────── */}
        <section className="flex flex-col justify-center p-8 md:p-10">
          <div className="mb-6 flex gap-1 rounded-2xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => { setTab("login"); setError(""); setMessage(""); }}
              className="flex-1 rounded-xl py-2 text-sm font-semibold transition"
              style={tab === "login" ? { background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" } : { color: "#6b7280" }}
            >
              Já sou cliente
            </button>
            <button
              type="button"
              onClick={() => { setTab("lead"); setError(""); setMessage(""); setLeadSent(false); }}
              className="flex-1 rounded-xl py-2 text-sm font-semibold transition"
              style={tab === "lead" ? { background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" } : { color: "#6b7280" }}
            >
              Quero experimentar
            </button>
          </div>

          {/* Login */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Acessar o sistema</h2>
                <p className="mt-1 text-sm text-gray-500">Entre com seu login e senha fornecidos.</p>
              </div>
              <input className="input" name="email" type="text" placeholder="E-mail ou usuário" required autoFocus />
              <input className="input" name="password" type="password" placeholder="Senha" required />
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
              <button type="button" className="w-full text-center text-xs text-gray-400 underline" onClick={() => { setTab("forgot"); setError(""); setMessage(""); }}>
                Esqueci minha senha
              </button>
            </form>
          )}

          {/* Esqueci a senha */}
          {tab === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Recuperar acesso</h2>
                <p className="mt-1 text-sm text-gray-500">Informe seu e-mail de cadastro.</p>
              </div>
              <input className="input" name="email" type="email" placeholder="seu@email.com" required autoFocus />
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Enviando..." : "Solicitar recuperação"}
              </button>
              <button type="button" className="w-full text-center text-xs text-gray-400 underline" onClick={() => { setTab("login"); setError(""); setMessage(""); }}>
                Voltar ao login
              </button>
            </form>
          )}

          {/* Solicitar acesso */}
          {tab === "lead" && !leadSent && (
            <form onSubmit={handleLead} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Solicitar acesso</h2>
                <p className="mt-1 text-sm text-gray-500">Preencha seus dados e entraremos em contato em breve.</p>
              </div>
              <input className="input" name="nome" type="text" placeholder="Seu nome" required autoFocus />
              <input className="input" name="restaurante" type="text" placeholder="Nome do restaurante ou bar" required />
              <input className="input" name="telefone" type="tel" placeholder="WhatsApp (com DDD)" required />
              <input className="input" name="email" type="email" placeholder="E-mail (opcional)" />
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Enviando..." : "Quero experimentar grátis"}
              </button>
            </form>
          )}

          {tab === "lead" && leadSent && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-4xl">✓</div>
              <h2 className="text-xl font-bold">Solicitação enviada!</h2>
              <p className="text-sm text-gray-500">
                Recebemos seus dados. Em breve entraremos em contato pelo WhatsApp para configurar seu acesso.
              </p>
              <button type="button" className="btn-secondary w-full" onClick={() => setTab("login")}>
                Já tenho acesso — Entrar
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
