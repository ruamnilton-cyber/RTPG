import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type Supply = {
  id: string;
  name: string;
  unit: string;
  averageCost: number;
  stockCurrent: number;
  stockMinimum: number;
  active: boolean;
};

const initialForm = { name: "", unit: "UNIDADE", averageCost: 0, stockCurrent: 0, stockMinimum: 0, active: true };

export function SuppliesPage() {
  const { token, user } = useAuth();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);

  async function load() {
    setSupplies(await apiRequest<Supply[]>(`/catalog/supplies?search=${encodeURIComponent(search)}`, { token }));
  }

  useEffect(() => {
    load();
  }, [token, search]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await apiRequest("/catalog/supplies", { method: "POST", token, body: form });
    setForm(initialForm);
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este insumo?")) return;
    await apiRequest(`/catalog/supplies/${id}`, { method: "DELETE", token });
    load();
  }

  async function handleUpdate(supply: Supply) {
    const name = window.prompt("Nome do insumo", supply.name);
    if (!name) return;
    const averageCost = window.prompt("Custo médio", String(supply.averageCost));
    if (!averageCost) return;
    await apiRequest(`/catalog/supplies/${supply.id}`, {
      method: "PUT",
      token,
      body: {
        name,
        unit: supply.unit,
        averageCost: Number(averageCost),
        stockCurrent: Number(supply.stockCurrent),
        stockMinimum: Number(supply.stockMinimum),
        active: supply.active
      }
    });
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Insumos" subtitle="Controle dos ingredientes e materiais usados nas receitas." />
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={handleCreate} className="card space-y-3">
          <h3 className="text-lg font-bold">Novo insumo</h3>
          <input className="input" placeholder="Nome do insumo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="UNIDADE">Unidade</option>
            <option value="KG">Kg</option>
            <option value="G">g</option>
            <option value="L">L</option>
            <option value="ML">ml</option>
          </select>
          <input className="input" type="number" step="0.0001" placeholder="Custo médio" value={form.averageCost} onChange={(e) => setForm({ ...form, averageCost: Number(e.target.value) })} />
          <input className="input" type="number" step="0.0001" placeholder="Estoque atual" value={form.stockCurrent} onChange={(e) => setForm({ ...form, stockCurrent: Number(e.target.value) })} />
          <input className="input" type="number" step="0.0001" placeholder="Estoque mínimo" value={form.stockMinimum} onChange={(e) => setForm({ ...form, stockMinimum: Number(e.target.value) })} />
          <button className="btn-primary" disabled={user?.role !== "ADMIN"}>Cadastrar insumo</button>
        </form>

        <div className="card">
          <input className="input mb-4" placeholder="Buscar insumo" value={search} onChange={(e) => setSearch(e.target.value)} />
          <table className="table-base">
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Unidade</th>
                <th>Custo médio</th>
                <th>Estoque</th>
                <th>Mínimo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {supplies.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.unit}</td>
                  <td>{formatMoney(item.averageCost)}</td>
                  <td className={Number(item.stockCurrent) <= Number(item.stockMinimum) ? "text-red-700" : ""}>{Number(item.stockCurrent).toFixed(2)}</td>
                  <td>{Number(item.stockMinimum).toFixed(2)}</td>
                  <td className="space-x-3">
                    <button className="text-sm text-brand-700" onClick={() => handleUpdate(item)}>Editar</button>
                    <button className="text-sm text-red-700" onClick={() => handleDelete(item.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
