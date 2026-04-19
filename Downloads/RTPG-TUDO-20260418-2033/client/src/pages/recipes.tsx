import { FormEvent, useEffect, useState } from "react";
import { EmptyState, PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type Supply = { id: string; name: string; unit: string };
type RecipeProduct = {
  id: string;
  name: string;
  recipeCost: number;
  recipeItems: Array<{ supplyId: string; quantityRequired: number; supply: Supply }>;
};

export function RecipesPage() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<RecipeProduct[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [supplyId, setSupplyId] = useState("");
  const [quantityRequired, setQuantityRequired] = useState(1);

  async function load() {
    const [productsData, suppliesData] = await Promise.all([
      apiRequest<RecipeProduct[]>("/catalog/recipes", { token }),
      apiRequest<Supply[]>("/catalog/supplies", { token })
    ]);
    setProducts(productsData);
    setSupplies(suppliesData);
    if (!selectedProductId && productsData[0]) {
      setSelectedProductId(productsData[0].id);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  const selectedProduct = products.find((item) => item.id === selectedProductId);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!selectedProductId || !supplyId) return;

    const currentItems = selectedProduct?.recipeItems.map((item) => ({
      supplyId: item.supplyId,
      quantityRequired: Number(item.quantityRequired)
    })) ?? [];

    const withoutCurrent = currentItems.filter((item) => item.supplyId !== supplyId);
    await apiRequest(`/catalog/products/${selectedProductId}/recipe`, {
      method: "PUT",
      token,
      body: {
        items: [...withoutCurrent, { supplyId, quantityRequired: Number(quantityRequired) }]
      }
    });
    setSupplyId("");
    setQuantityRequired(1);
    load();
  }

  async function handleRemove(targetSupplyId: string) {
    if (!selectedProductId || !selectedProduct) return;
    await apiRequest(`/catalog/products/${selectedProductId}/recipe`, {
      method: "PUT",
      token,
      body: {
        items: selectedProduct.recipeItems
          .filter((item) => item.supplyId !== targetSupplyId)
          .map((item) => ({ supplyId: item.supplyId, quantityRequired: Number(item.quantityRequired) }))
      }
    });
    load();
  }

  if (!products.length) {
    return <EmptyState message="Cadastre produtos antes de montar a ficha técnica." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Ficha técnica" subtitle="Relacionamento produto x insumos para cálculo de custo e baixa automática." />
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="card">
          <label className="label">Produto</label>
          <select className="input" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
            {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <p className="mt-4 text-sm text-stone-600">
            Custo estimado atual: <strong>{formatMoney(selectedProduct?.recipeCost ?? 0)}</strong>
          </p>
          <form onSubmit={handleAdd} className="mt-5 space-y-3">
            <select className="input" value={supplyId} onChange={(e) => setSupplyId(e.target.value)}>
              <option value="">Selecione um insumo</option>
              {supplies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input className="input" type="number" step="0.0001" value={quantityRequired} onChange={(e) => setQuantityRequired(Number(e.target.value))} />
            <button className="btn-primary" disabled={user?.role !== "ADMIN"}>Adicionar / atualizar insumo</button>
          </form>
        </div>

        <div className="card">
          <table className="table-base">
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Unidade</th>
                <th>Quantidade por venda</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {selectedProduct?.recipeItems.map((item) => (
                <tr key={item.supplyId}>
                  <td>{item.supply.name}</td>
                  <td>{item.supply.unit}</td>
                  <td>{Number(item.quantityRequired).toFixed(4)}</td>
                  <td><button className="text-sm text-red-700" onClick={() => handleRemove(item.supplyId)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
