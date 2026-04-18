import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type Category = { id: string; name: string; sortOrder: number };
type Product = {
  id: string;
  name: string;
  salePrice: number;
  saleUnit: string;
  active: boolean;
  description?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  recipeCost: number;
  imageUrl?: string | null;
};

const initialForm = {
  name: "",
  categoryId: "",
  salePrice: 0,
  saleUnit: "UNIDADE",
  active: true,
  description: "",
  imageUrl: ""
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProductsPage() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [form, setForm] = useState(initialForm);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");

  async function load() {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (selectedCategory !== "all") query.set("categoryId", selectedCategory);
    if (statusFilter !== "todos") query.set("status", statusFilter);
    if (minPrice) query.set("minPrice", minPrice);
    if (maxPrice) query.set("maxPrice", maxPrice);

    const [productsData, categoriesData] = await Promise.all([
      apiRequest<Product[]>(`/catalog/products?${query.toString()}`, { token }),
      apiRequest<Category[]>("/catalog/categories", { token })
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
  }

  useEffect(() => {
    load();
  }, [token, search, selectedCategory, statusFilter, minPrice, maxPrice]);

  const visibleProducts = useMemo(() => products, [products]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await apiRequest("/catalog/products", {
      method: "POST",
      token,
      body: {
        ...form,
        salePrice: Number(form.salePrice),
        categoryId: form.categoryId || null,
        imageUrl: previewImage
      }
    });
    setForm(initialForm);
    setPreviewImage(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este produto?")) return;
    await apiRequest(`/catalog/products/${id}`, { method: "DELETE", token });
    load();
  }

  async function handleEdit(product: Product) {
    const name = window.prompt("Nome do produto", product.name);
    if (!name) return;
    const salePrice = window.prompt("Preço de venda", String(product.salePrice));
    if (!salePrice) return;
    await apiRequest(`/catalog/products/${product.id}`, {
      method: "PUT",
      token,
      body: {
        name,
        categoryId: product.categoryId ?? null,
        salePrice: Number(salePrice),
        saleUnit: product.saleUnit,
        active: product.active,
        description: product.description ?? "",
        imageUrl: product.imageUrl ?? null
      }
    });
    load();
  }

  async function handleDuplicate(productId: string) {
    await apiRequest(`/catalog/products/${productId}/duplicate`, { method: "POST", token, body: {} });
    load();
  }

  async function handleToggle(productId: string) {
    await apiRequest(`/catalog/products/${productId}/toggle-active`, { method: "POST", token, body: {} });
    load();
  }

  async function createCategory() {
    if (!categoryName.trim()) return;
    await apiRequest("/catalog/categories", {
      method: "POST",
      token,
      body: { name: categoryName }
    });
    setCategoryName("");
    load();
  }

  async function renameCategory(category: Category) {
    const nextName = window.prompt("Novo nome da categoria", category.name);
    if (!nextName) return;
    await apiRequest(`/catalog/categories/${category.id}`, {
      method: "PUT",
      token,
      body: { name: nextName }
    });
    load();
  }

  async function deleteCategory(categoryId: string) {
    if (!window.confirm("Excluir esta categoria?")) return;
    await apiRequest(`/catalog/categories/${categoryId}`, { method: "DELETE", token });
    if (selectedCategory === categoryId) setSelectedCategory("all");
    load();
  }

  async function moveCategory(categoryId: string, direction: "up" | "down") {
    const index = categories.findIndex((item) => item.id === categoryId);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    await apiRequest("/catalog/categories/reorder", {
      method: "PUT",
      token,
      body: { orderedIds: reordered.map((item) => item.id) }
    });
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Produtos vendidos" subtitle="Grade visual por categoria, com filtros rápidos, imagem e ações de administração." />

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Novo item</p>
            <h3 className="mt-2 text-2xl font-bold">Cadastro rápido de produto</h3>
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <input className="input" placeholder="Nome do produto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid gap-3 md:grid-cols-2">
              <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Sem categoria</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <input className="input" type="number" step="0.01" placeholder="Preço" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} />
            </div>
            <select className="input" value={form.saleUnit} onChange={(e) => setForm({ ...form, saleUnit: e.target.value })}>
              <option value="UNIDADE">Unidade</option>
              <option value="PORCAO">Porção</option>
              <option value="COPO">Copo</option>
              <option value="GARRAFA">Garrafa</option>
            </select>
            <textarea className="input min-h-24" placeholder="Descrição opcional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="space-y-2">
              <label className="label">Imagem do produto</label>
              <input
                className="input"
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setPreviewImage(await fileToDataUrl(file));
                }}
              />
              <p className="text-xs text-muted">
                Esse campo serve apenas para a foto de um produto. Ele nao importa cardapio inteiro por imagem ou PDF.
              </p>
            </div>
            {previewImage ? <img src={previewImage} alt="Preview do produto" className="h-36 w-full rounded-3xl object-cover" /> : null}
            <button className="btn-primary w-full" disabled={user?.role !== "ADMIN"}>Salvar produto</button>
          </form>

          <div className="rounded-3xl p-4 surface-soft">
            <h4 className="font-semibold">Categorias editáveis</h4>
            <div className="mt-3 flex gap-2">
              <input className="input" placeholder="Nova categoria" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
              <button className="btn-primary" type="button" onClick={createCategory}>Criar</button>
            </div>
            <div className="mt-3 space-y-2">
              {categories.map((category, index) => (
                <div key={category.id} className="flex items-center justify-between rounded-2xl px-3 py-2 surface-soft">
                  <span>{category.name}</span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => moveCategory(category.id, "up")} disabled={index === 0}>↑</button>
                    <button onClick={() => moveCategory(category.id, "down")} disabled={index === categories.length - 1}>↓</button>
                    <button onClick={() => renameCategory(category)}>Renomear</button>
                    <button className="text-red-500" onClick={() => deleteCategory(category.id)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input className="input" placeholder="Buscar por nome" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="input" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="all">Todas as categorias</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="todos">Todos os status</option>
                <option value="ativos">Somente ativos</option>
                <option value="inativos">Somente inativos</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                <input className="input" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={`rounded-full px-4 py-2 text-sm ${selectedCategory === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setSelectedCategory("all")}>Todos</button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={`rounded-full px-4 py-2 text-sm ${selectedCategory === category.id ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <div key={product.id} className="card overflow-hidden">
                <div className="relative">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="h-40 w-full rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-2xl surface-soft text-sm text-muted">Sem imagem</div>
                  )}
                  <span className="badge-soft absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold">
                    {product.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{product.name}</h3>
                      <p className="text-sm text-muted">{product.category?.name ?? "Sem categoria"}</p>
                    </div>
                    <strong>{formatMoney(product.salePrice)}</strong>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-muted">{product.description || "Sem descrição cadastrada."}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="badge-soft rounded-full px-3 py-1">Custo estimado {formatMoney(product.recipeCost)}</span>
                    <span className="badge-soft rounded-full px-3 py-1">{product.saleUnit}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button className="btn-secondary" onClick={() => handleEdit(product)}>Editar</button>
                    <button className="btn-secondary" onClick={() => handleDuplicate(product.id)}>Duplicar</button>
                    <button className="btn-secondary" onClick={() => handleToggle(product.id)}>{product.active ? "Desativar" : "Ativar"}</button>
                    <button className="btn-secondary" onClick={() => handleDelete(product.id)}>Excluir</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
