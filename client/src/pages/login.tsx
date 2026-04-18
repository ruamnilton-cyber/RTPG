import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { roleOptions } from "../lib/roles";
import { useAuth } from "../state/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiRequest<{ needsBootstrap: boolean }>("/auth/bootstrap-status")
      .then((r) => setNeedsBootstrap(Boolean(r.needsBootstrap)))
      .catch(() => setNeedsBootstrap(false));
  }, []);

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
      role: String(formData.get("role") ?? "OPERADOR") as (typeof roleOptions)[number]["value"]
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
      } else {
        await register(payload);
        setMode("login");
        setMessage("Administrador criado. Faça login com as credenciais definidas.");
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
          <p className="text-sm uppercase tracking-[0.35em] text-brand-200">RTPG Gestão</p>
          <h1 className="mt-4 text-4xl font-bold">Sistema local para bar e restaurante</h1>
          <p className="mt-4 text-base text-brand-100">
            Controle de usuários, produtos, insumos, estoque, mesas, QR Codes e DRE com dados persistentes no seu computador.
          </p>
          <div className="mt-8 space-y-3 text-sm text-brand-100">
            <div className="rounded-2xl bg-white/10 p-4">Persistência real em SQLite dentro da pasta RTPG com fallback documentado.</div>
            <div className="rounded-2xl bg-white/10 p-4">Após o seed: use `admin@rtpg.local` / `admin123`, ou crie o primeiro admin se o banco estiver vazio.</div>
          </div>
        </section>

        <section className="p-8">
          <div className="mb-6 flex flex-wrap gap-2">
            <button type="button" className={mode === "login" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("login")}>
              Entrar
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

          {mode === "register" ? (
            <div className="mb-4">
              <label className="label">Nome</label>
              <input className="input" name="name" placeholder="Nome completo" />
            </div>
          ) : null}

          <div className="mb-4">
            <label className="label">Login ou e-mail</label>
            <input className="input" name="email" type="text" placeholder="cura1 ou admin@rtpg.local" required />
          </div>

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
            {loading ? "Processando..." : mode === "login" ? "Entrar" : mode === "forgot" ? "Solicitar recuperação" : "Cadastrar"}
          </button>
        </section>
      </form>
    </div>
  );
}
