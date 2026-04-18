import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type Supply = { id: string; name: string };
type Entry = { id: string; quantity: number; totalCost: number; unitCost: number; purchasedAt: string; supplierName?: string; supply: Supply };
type Movement = { id: string; type: string; quantity: number; previousStock: number; currentStock: number; reason: string; createdAt: string; supply: Supply };

export function InventoryPage() {
  const { token, user } = useAuth();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  async function load() {
    const [suppliesData, entriesData, movementsData] = await Promise.all([
      apiRequest<Supply[]>("/catalog/supplies", { token }),
      apiRequest<Entry[]>("/inventory/entries", { token }),
      apiRequest<Movement[]>("/inventory/movements", { token })
    ]);
    setSupplies(suppliesData);
    setEntries(entriesData);
    setMovements(movementsData);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handlePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await apiRequest("/inventory/entries", {
      method: "POST",
      token,
      body: {
        supplyId: String(formData.get("supplyId")),
        quantity: Number(formData.get("quantity")),
        totalCost: Number(formData.get("totalCost")),
        purchasedAt: String(formData.get("purchasedAt")),
        supplierName: String(formData.get("supplierName") || ""),
        notes: String(formData.get("notes") || "")
      }
    });
    event.currentTarget.reset();
    load();
  }

  async function handleAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await apiRequest("/inventory/adjustments", {
      method: "POST",
      token,
      body: {
        supplyId: String(formData.get("supplyId")),
        quantity: Number(formData.get("quantity")),
        reason: String(formData.get("reason"))
      }
    });
    event.currentTarget.reset();
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Estoque e compras" subtitle="Entradas, ajustes manuais e histórico de movimentações." />
      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={handlePurchase} className="card space-y-3">
          <h3 className="text-lg font-bold">Registrar compra</h3>
          <select className="input" name="supplyId" required>{supplies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <input className="input" name="quantity" type="number" step="0.0001" placeholder="Quantidade comprada" required />
          <input className="input" name="totalCost" type="number" step="0.01" placeholder="Custo total" required />
          <input className="input" name="purchasedAt" type="datetime-local" required />
          <input className="input" name="supplierName" placeholder="Fornecedor" />
          <textarea className="input min-h-20" name="notes" placeholder="Observações" />
          <button className="btn-primary" disabled={user?.role !== "ADMIN"}>Salvar compra</button>
        </form>

        <form onSubmit={handleAdjustment} className="card space-y-3">
          <h3 className="text-lg font-bold">Ajuste manual de estoque</h3>
          <select className="input" name="supplyId" required>{supplies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <input className="input" name="quantity" type="number" step="0.0001" placeholder="Use negativo para baixar" required />
          <textarea className="input min-h-20" name="reason" placeholder="Motivo do ajuste" required />
          <button className="btn-primary" disabled={user?.role !== "ADMIN"}>Aplicar ajuste</button>
        </form>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="card overflow-auto">
          <h3 className="mb-4 text-lg font-bold">Compras registradas</h3>
          <table className="table-base">
            <thead><tr><th>Insumo</th><th>Qtd.</th><th>Custo total</th><th>Unitário</th><th>Data</th></tr></thead>
            <tbody>
              {entries.map((item) => (
                <tr key={item.id}>
                  <td>{item.supply.name}</td>
                  <td>{Number(item.quantity).toFixed(4)}</td>
                  <td>{formatMoney(item.totalCost)}</td>
                  <td>{formatMoney(item.unitCost)}</td>
                  <td>{formatDate(item.purchasedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card overflow-auto">
          <h3 className="mb-4 text-lg font-bold">Movimentações</h3>
          <table className="table-base">
            <thead><tr><th>Tipo</th><th>Insumo</th><th>Qtd.</th><th>Saldo</th><th>Motivo</th></tr></thead>
            <tbody>
              {movements.map((item) => (
                <tr key={item.id}>
                  <td>{item.type}</td>
                  <td>{item.supply.name}</td>
                  <td>{Number(item.quantity).toFixed(4)}</td>
                  <td>{Number(item.currentStock).toFixed(4)}</td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
