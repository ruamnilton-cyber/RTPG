import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  birthDate: string;
  preferredChannel: "WHATSAPP" | "INSTAGRAM" | "QR" | "BALCAO" | "SALAO" | "DELIVERY";
  origin: "WHATSAPP" | "INSTAGRAM" | "QR" | "BALCAO" | "SALAO" | "DELIVERY" | "MANUAL";
  status: "ATIVO" | "INATIVO" | "VIP";
  averageTicket: number;
  visitCount: number;
  lastOrderAt: string;
  notes: string;
  tags: string[];
  createdAt: string;
};

type CustomerInsights = {
  cards: Array<{ label: string; value: number }>;
  highlights: {
    whatsappLeads: number;
    frequentCustomers: number;
    inactiveCustomers: number;
  };
};

export function CustomersPage() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [insights, setInsights] = useState<CustomerInsights | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  async function load(nextSearch = "") {
    const [list, summary] = await Promise.all([
      apiRequest<Customer[]>(`/customers${nextSearch ? `?search=${encodeURIComponent(nextSearch)}` : ""}`, { token }),
      apiRequest<CustomerInsights>("/customers/insights", { token })
    ]);
    setCustomers(list);
    setInsights(summary);
    if (selectedCustomer) {
      setSelectedCustomer(list.find((item) => item.id === selectedCustomer.id) ?? null);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach((customer) => {
      customer.tags.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [customers]);

  return (
    <div className="space-y-5">
      <PageHeader title="Clientes e CRM" subtitle="Base real para operar online com WhatsApp, QR, delivery, recorrencia e relacionamento." />

      {insights ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {insights.cards.map((card) => (
            <div key={card.label} className="card">
              <p className="text-sm text-muted">{card.label}</p>
              <h3 className="mt-2 text-3xl font-bold">
                {card.label.includes("Ticket") ? formatMoney(card.value) : String(card.value)}
              </h3>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <form
            className="card space-y-4"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              await apiRequest("/customers", {
                method: "POST",
                token,
                body: {
                  name: String(formData.get("name")),
                  phone: String(formData.get("phone") ?? ""),
                  email: String(formData.get("email") ?? ""),
                  instagram: String(formData.get("instagram") ?? ""),
                  city: String(formData.get("city") ?? ""),
                  birthDate: String(formData.get("birthDate") ?? ""),
                  preferredChannel: String(formData.get("preferredChannel") ?? "WHATSAPP"),
                  origin: String(formData.get("origin") ?? "MANUAL"),
                  status: String(formData.get("status") ?? "ATIVO"),
                  averageTicket: Number(formData.get("averageTicket") ?? 0),
                  visitCount: Number(formData.get("visitCount") ?? 0),
                  lastOrderAt: String(formData.get("lastOrderAt") ?? ""),
                  notes: String(formData.get("notes") ?? ""),
                  tags: String(formData.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean)
                }
              });
              event.currentTarget.reset();
              load(search);
            }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>CRM</p>
              <h3 className="mt-2 text-2xl font-bold">Novo cliente</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="input" name="name" placeholder="Nome do cliente" required />
              <input className="input" name="phone" placeholder="WhatsApp / telefone" />
              <input className="input" name="email" placeholder="Email" />
              <input className="input" name="instagram" placeholder="Instagram" />
              <input className="input" name="city" placeholder="Cidade / bairro" />
              <input className="input" name="birthDate" type="date" />
              <select className="input" name="preferredChannel" defaultValue="WHATSAPP">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="QR">QR</option>
                <option value="BALCAO">Balcao</option>
                <option value="SALAO">Salao</option>
                <option value="DELIVERY">Delivery</option>
              </select>
              <select className="input" name="origin" defaultValue="MANUAL">
                <option value="MANUAL">Manual</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="QR">QR</option>
                <option value="BALCAO">Balcao</option>
                <option value="SALAO">Salao</option>
                <option value="DELIVERY">Delivery</option>
              </select>
              <select className="input" name="status" defaultValue="ATIVO">
                <option value="ATIVO">Ativo</option>
                <option value="VIP">VIP</option>
                <option value="INATIVO">Inativo</option>
              </select>
              <input className="input" name="averageTicket" type="number" step="0.01" placeholder="Ticket medio" />
              <input className="input" name="visitCount" type="number" min="0" placeholder="Visitas" />
              <input className="input" name="lastOrderAt" type="date" />
              <input className="input md:col-span-2" name="tags" placeholder="Tags separadas por virgula" />
              <textarea className="input md:col-span-2 min-h-24" name="notes" placeholder="Observacoes, alergias, preferencias, perfil de consumo" />
            </div>
            <button className="btn-primary">Salvar cliente</button>
          </form>

          <div className="card space-y-3">
            <h3 className="text-xl font-bold">Tags mais usadas</h3>
            <div className="flex flex-wrap gap-2">
              {topTags.length === 0 ? <span className="text-sm text-muted">Nenhuma tag cadastrada ainda.</span> : topTags.map(([tag, count]) => (
                <span key={tag} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--color-badge)" }}>
                  {tag} • {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="input flex-1"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, telefone, email ou Instagram"
              />
              <button className="btn-secondary" type="button" onClick={() => load(search)}>Buscar</button>
            </div>

            <div className="space-y-3">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="w-full rounded-3xl p-4 text-left surface-soft"
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <strong>{customer.name}</strong>
                      <p className="text-sm text-muted">{customer.phone || "Sem telefone"} • {customer.preferredChannel}</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: customer.status === "VIP" ? "color-mix(in srgb, #ca8a04 18%, white)" : "var(--color-badge)" }}>
                      {customer.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-4">
            {!selectedCustomer ? (
              <p className="text-sm text-muted">Selecione um cliente para ver e editar os detalhes.</p>
            ) : (
              <form
                className="space-y-4"
                onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  await apiRequest(`/customers/${selectedCustomer.id}`, {
                    method: "PUT",
                    token,
                    body: {
                      name: String(formData.get("name")),
                      phone: String(formData.get("phone") ?? ""),
                      email: String(formData.get("email") ?? ""),
                      instagram: String(formData.get("instagram") ?? ""),
                      city: String(formData.get("city") ?? ""),
                      birthDate: String(formData.get("birthDate") ?? ""),
                      preferredChannel: String(formData.get("preferredChannel") ?? "WHATSAPP"),
                      origin: String(formData.get("origin") ?? "MANUAL"),
                      status: String(formData.get("status") ?? "ATIVO"),
                      averageTicket: Number(formData.get("averageTicket") ?? 0),
                      visitCount: Number(formData.get("visitCount") ?? 0),
                      lastOrderAt: String(formData.get("lastOrderAt") ?? ""),
                      notes: String(formData.get("notes") ?? ""),
                      tags: String(formData.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean)
                    }
                  });
                  load(search);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold">{selectedCustomer.name}</h3>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={async () => {
                      if (!window.confirm("Excluir este cliente?")) return;
                      await apiRequest(`/customers/${selectedCustomer.id}`, { method: "DELETE", token });
                      setSelectedCustomer(null);
                      load(search);
                    }}
                  >
                    Excluir
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="input" name="name" defaultValue={selectedCustomer.name} />
                  <input className="input" name="phone" defaultValue={selectedCustomer.phone} />
                  <input className="input" name="email" defaultValue={selectedCustomer.email} />
                  <input className="input" name="instagram" defaultValue={selectedCustomer.instagram} />
                  <input className="input" name="city" defaultValue={selectedCustomer.city} />
                  <input className="input" name="birthDate" type="date" defaultValue={selectedCustomer.birthDate} />
                  <select className="input" name="preferredChannel" defaultValue={selectedCustomer.preferredChannel}>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="QR">QR</option>
                    <option value="BALCAO">Balcao</option>
                    <option value="SALAO">Salao</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                  <select className="input" name="origin" defaultValue={selectedCustomer.origin}>
                    <option value="MANUAL">Manual</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="QR">QR</option>
                    <option value="BALCAO">Balcao</option>
                    <option value="SALAO">Salao</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                  <select className="input" name="status" defaultValue={selectedCustomer.status}>
                    <option value="ATIVO">Ativo</option>
                    <option value="VIP">VIP</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                  <input className="input" name="averageTicket" type="number" step="0.01" defaultValue={selectedCustomer.averageTicket} />
                  <input className="input" name="visitCount" type="number" min="0" defaultValue={selectedCustomer.visitCount} />
                  <input className="input" name="lastOrderAt" type="date" defaultValue={selectedCustomer.lastOrderAt} />
                  <input className="input md:col-span-2" name="tags" defaultValue={selectedCustomer.tags.join(", ")} />
                  <textarea className="input md:col-span-2 min-h-24" name="notes" defaultValue={selectedCustomer.notes} />
                </div>
                <div className="rounded-3xl p-4 surface-soft">
                  <p className="text-sm text-muted">Resumo rapido</p>
                  <p className="mt-2 text-sm">Ticket medio: <strong>{formatMoney(selectedCustomer.averageTicket)}</strong></p>
                  <p className="text-sm">Visitas registradas: <strong>{selectedCustomer.visitCount}</strong></p>
                  <p className="text-sm">Ultimo pedido: <strong>{selectedCustomer.lastOrderAt || "Nao informado"}</strong></p>
                </div>
                <button className="btn-primary">Salvar alteracoes</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
