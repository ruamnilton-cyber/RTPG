import { FormEvent, useEffect, useState } from "react";
import { EmptyState, PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate } from "../lib/format";
import { AppRole, roleLabelMap, roleOptions } from "../lib/roles";
import { useAuth } from "../state/auth";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  active: boolean;
  createdAt: string;
};

export function UsersPage() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setUsers(await apiRequest<UserRow[]>("/auth/users", { token }));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar usuários.");
    }
  }

  useEffect(() => {
    if (user?.role === "ADMIN") {
      load();
    }
  }, [token, user?.role]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await apiRequest(`/auth/users/${id}`, {
        method: "PUT",
        token,
        body: {
          name: String(formData.get("name")),
          email: String(formData.get("email")),
          role: String(formData.get("role")),
          active: formData.get("active") === "on"
        }
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Deseja realmente excluir este usuário?")) return;
    await apiRequest(`/auth/users/${id}`, { method: "DELETE", token });
    await load();
  }

  if (user?.role !== "ADMIN") {
    return <EmptyState message="Apenas administradores podem gerenciar usuários." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Usuários" subtitle="Criação, edição e controle de acesso por perfil operacional." />
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <form
        className="card grid gap-3 xl:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setSaving(true);
          try {
            await apiRequest("/auth/register", {
              method: "POST",
              token,
              body: {
                name: String(formData.get("name")),
                email: String(formData.get("email")),
                password: String(formData.get("password")),
                role: String(formData.get("role"))
              }
            });
            event.currentTarget.reset();
            await load();
          } finally {
            setSaving(false);
          }
        }}
      >
        <input className="input" name="name" placeholder="Nome" required />
        <input className="input" name="email" type="email" placeholder="E-mail" required />
        <input className="input" name="password" type="password" placeholder="Senha inicial" required />
        <select className="input" name="role" defaultValue="OPERADOR">
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
        <button className="btn-primary" disabled={saving}>Criar usuário</button>
      </form>

      <div className="space-y-4">
        {users.map((item) => (
          <form key={item.id} onSubmit={(event) => handleUpdate(event, item.id)} className="card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--color-badge)" }}>
                {roleLabelMap[item.role]}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: item.active ? "color-mix(in srgb, #16a34a 16%, white)" : "color-mix(in srgb, #991b1b 14%, white)",
                  color: item.active ? "#166534" : "#991b1b"
                }}
              >
                {item.active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="grid gap-3 xl:grid-cols-[1.2fr_1.2fr_1fr_0.7fr_auto]">
              <input className="input" name="name" defaultValue={item.name} />
              <input className="input" name="email" defaultValue={item.email} />
              <select className="input" name="role" defaultValue={item.role}>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2">
                <input type="checkbox" name="active" defaultChecked={item.active} />
                Ativo
              </label>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={saving}>Salvar</button>
                <button type="button" className="btn-secondary" onClick={() => handleDelete(item.id)}>Excluir</button>
              </div>
            </div>
            <p className="mt-3 text-xs text-stone-500">Criado em {formatDate(item.createdAt)}</p>
          </form>
        ))}
      </div>
    </div>
  );
}
