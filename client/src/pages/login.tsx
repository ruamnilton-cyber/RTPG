import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { roleOptions } from "../lib/roles";
import { useAuth } from "../state/auth";

type LoginMode = "login" | "trial" | "register" | "forgot";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, signupTrial } = useAuth();
  const [mode, setMode] = useState<LoginMode>("login");
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiRequest<{ needsBootstrap: boolean }>("/auth/bootstrap-status")
      .then((r) => setNeedsBootstrap(Boolean(r.needsBootstrap)))
      .catch(() => setNeedsBootstrap(false));
  }, []);

  function submitLabel() {
    if (loading) return "Processando...";
    if (mode === "login") return "Entrar";
    if (mode === "forgot") return "Solicitar recuperacao";
    if (mode === "trial") return "Criar restaurante e iniciar teste";
    return "Cadastrar";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "OPERADOR") as (typeof roleOptions)[number]["value"],
      businessName: String(formData.get("businessName") ?? ""),
      contactName: String(formData.get("contactName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      cpfCnpj: String(formData.get("cpfCnpj") ?? ""),
      accessLogin: String(formData.get("accessLogin") ?? "")
    };

    try {
      if (mode === "login") {
        const logged = await login(payload.email, payload.password);
        navigate(logged.email === "admin@rtpg.local" ? "/meu-gestor" : "/");
      } else if (mode === "forgot") {
        const result = await apiRequest<{ message: string }>("/auth/forgot-password", {
          method: "POST",
          body: { email: payload.email }
        });
        setMessage(result.message);
      } else if (mode === "trial") {
        await signupTrial({
          businessName: payload.businessName,
          contactName: payload.contactName,
                  phone: payload.phone,
                  email: payload.email,
                  cpfCnpj: payload.cpfCnpj,
                  accessLogin: payload.accessLogin,
          password: payload.password
        });
        navigate("/painel-dono");
      } else {
        await register(payload);
        setMode("login");
        setMessage("Administrador criado. Faca login com as credenciais definidas.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,_#2f1f11,_#9a6b26,_#f0dba7)] p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-card md:grid md:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-brand-900 p-8 text-white">
          <p className="text-sm uppercase tracking-[0.35em] text-brand-200">RTPG Gestao</p>
          <h1 className="mt-4 text-4xl font-bold">Sistema para bar e restaurante vender, operar e controlar margem</h1>
          <p className="mt-4 text-base text-brand-100">
            Mesas, comandas, cardapio, estoque, DRE, WhatsApp e IA no mesmo painel do restaurante.
          </p>
          <div className="mt-8 space-y-3 text-sm text-brand-100">
            <div className="rounded-2xl bg-white/10 p-4">Teste gratis com criacao automatica do restaurante, usuario e mesas iniciais.</div>
            <div className="rounded-2xl bg-white/10 p-4">Depois do trial, a cobranca aparece dentro do painel com Pix, cartao e Play Store preparada.</div>
            <div className="rounded-2xl bg-white/10 p-4">Acesso admin da plataforma: `admin@rtpg.local` / `admin123`.</div>
          </div>
        </section>

        <section className="p-8">
          <div className="mb-6 flex flex-wrap gap-2">
            <button type="button" className={mode === "login" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("login")}>
              Entrar
            </button>
            <button type="button" className={mode === "trial" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("trial")}>
              Teste gratis
            </button>
            {needsBootstrap ? (
              <button type="button" className={mode === "register" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("register")}>
                Primeiro administrador
              </button>
            ) : null}
            <button type="button" className={mode === "forgot" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("forgot")}>
              Recuperar acesso
            </button>
          </div>

          {mode === "trial" ? (
            <div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
              Comece com 3 dias de teste. O restaurante entra direto no painel dele, sem acessar o seu gestor SaaS.
            </div>
          ) : null}

          {mode === "register" ? (
            <div className="mb-4">
              <label className="label">Nome</label>
              <input className="input" name="name" placeholder="Nome completo" />
            </div>
          ) : null}

          {mode === "trial" ? (
            <>
              <div className="mb-4">
                <label className="label">Nome do restaurante</label>
                <input className="input" name="businessName" placeholder="Ex.: Cura Ressaca" required />
              </div>
              <div className="mb-4">
                <label className="label">Seu nome</label>
                <input className="input" name="contactName" placeholder="Nome do responsavel" required />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="mb-4">
                  <label className="label">WhatsApp</label>
                  <input className="input" name="phone" placeholder="(21) 99999-9999" required />
                </div>
                <div className="mb-4">
                  <label className="label">E-mail comercial</label>
                  <input className="input" name="email" type="email" placeholder="dono@restaurante.com" required />
                </div>
              </div>
              <div className="mb-4">
                <label className="label">CPF ou CNPJ para cobranca</label>
                <input className="input" name="cpfCnpj" placeholder="Somente numeros" />
              </div>
              <div className="mb-4">
                <label className="label">Login desejado</label>
                <input className="input" name="accessLogin" placeholder="Ex.: curaressaca" required />
                <span className="field-hint">Esse sera o login simples do restaurante. A senha pode ser alterada depois.</span>
              </div>
            </>
          ) : (
            <div className="mb-4">
              <label className="label">Login ou e-mail</label>
              <input className="input" name="email" type="text" placeholder="cura1 ou admin@rtpg.local" required />
            </div>
          )}

          {mode !== "forgot" ? (
            <div className="mb-4">
              <label className="label">Senha</label>
              <input className="input" name="password" type="password" placeholder="******" required />
            </div>
          ) : null}

          {mode === "register" ? (
            <div className="mb-4">
              <label className="label">Perfil</label>
              <select className="input" name="role" defaultValue="OPERADOR">
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

          <button className="btn-primary w-full" disabled={loading}>
            {submitLabel()}
          </button>
        </section>
      </form>
    </div>
  );
}
