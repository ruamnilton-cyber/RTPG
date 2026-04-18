import { FormEvent, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";
import { useBar } from "../state/bar";

export function BarsPage() {
  const { token, user } = useAuth();
  const { bars, refreshBars } = useBar();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (user?.role !== "ADMIN") {
    return (
      <div className="card text-sm text-muted">Apenas administradores podem gerenciar bares.</div>
    );
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const code = String(fd.get("code") ?? "").trim().toLowerCase();
    const city = String(fd.get("city") ?? "").trim();
    setSaving(true);
    try {
      await apiRequest("/bars", {
        method: "POST",
        token,
        body: { name, code, city }
      });
      form.reset();
      setMessage("Bar cadastrado. Selecione-o no topo para operar nele.");
      await refreshBars();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar bar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bares"
        subtitle="Cada bar tem cardápio, insumos, estoque, mesas e DRE separados. Use o seletor no topo da tela para alternar."
      />

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

      <form className="card grid gap-3 md:grid-cols-2 lg:grid-cols-4" onSubmit={handleCreate}>
        <input className="input" name="name" placeholder="Nome do bar" required minLength={2} />
        <input
          className="input"
          name="code"
          placeholder="Código (ex: copacabana)"
          required
          minLength={2}
          maxLength={32}
          pattern="[a-zA-Z0-9\-]+"
          title="Letras, números e hífen"
        />
        <input className="input" name="city" placeholder="Cidade (opcional)" />
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Cadastrar bar"}
        </button>
      </form>

      <div className="card space-y-3">
        <p className="text-sm font-semibold">Bares cadastrados</p>
        <ul className="divide-y rounded-2xl border border-[var(--color-border)]">
          {bars.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-medium">{b.name}</span>
              <span className="text-muted">
                código <code className="rounded bg-black/5 px-2 py-0.5">{b.code}</code>
                {b.city ? ` • ${b.city}` : ""}
                {!b.active ? " • inativo" : ""}
              </span>
            </li>
          ))}
          {bars.length === 0 ? <li className="px-4 py-6 text-muted">Nenhum bar ainda.</li> : null}
        </ul>
      </div>
    </div>
  );
}
