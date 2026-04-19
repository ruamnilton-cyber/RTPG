import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type Category = { id: string; name: string; sortOrder: number };
type Supply = { id: string; name: string; unit: string; averageCost: number; active: boolean };
type RecipeItem = { id?: string; supplyId: string; quantityRequired: number; supply: Supply };
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
  recipeItems: RecipeItem[];
};

type ProductFormState = {
  name: string;
  categoryId: string;
  salePrice: number;
  saleUnit: string;
  active: boolean;
  description: string;
  imageUrl: string;
};

type RecipeDraftItem = { key: string; supplyId: string; quantityRequired: number };
type ParsedMenuItem = {
  nome: string;
  descricao: string | null;
  preco: number | null;
  preco_promocional: number | null;
  categoria: string;
  variacoes: Array<{ nome: string; preco: number | null }>;
  sabores: string[];
  adicionais: Array<{ nome: string; preco: number | null }>;
  disponibilidade: string;
  status_validacao: string;
  confianca_extracao: "alta" | "media" | "baixa";
};
type ParsedMenu = {
  importacao_id: string;
  texto_extraido?: string;
  categorias: Array<{ nome: string; itens: ParsedMenuItem[] }>;
  itens_pendentes_revisao: Array<{ linha_original: string; motivo: string }>;
  erros_encontrados: string[];
  resumo_importacao: {
    categorias_encontradas: number;
    itens_encontrados: number;
    itens_criados: number;
    itens_atualizados: number;
    itens_pendentes_revisao: number;
    erros: number;
  };
};

const createInitialForm = (): ProductFormState => ({
  name: "",
  categoryId: "",
  salePrice: 0,
  saleUnit: "UNIDADE",
  active: true,
  description: "",
  imageUrl: ""
});

function createRecipeDraft(): RecipeDraftItem {
  return { key: crypto.randomUUID(), supplyId: "", quantityRequired: 1 };
}

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
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [form, setForm] = useState<ProductFormState>(createInitialForm());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraftItem[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductFormState>(createInitialForm());
  const [editPreviewImage, setEditPreviewImage] = useState<string | null>(null);
  const [editRecipeDraft, setEditRecipeDraft] = useState<RecipeDraftItem[]>([]);
  const [rawMenuText, setRawMenuText] = useState("");
  const [selectedMenuFile, setSelectedMenuFile] = useState<File | null>(null);
  const [parsedMenu, setParsedMenu] = useState<ParsedMenu | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  async function load() {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (selectedCategory !== "all") query.set("categoryId", selectedCategory);
    if (statusFilter !== "todos") query.set("status", statusFilter);
    if (minPrice) query.set("minPrice", minPrice);
    if (maxPrice) query.set("maxPrice", maxPrice);

    const [productsData, categoriesData, suppliesData] = await Promise.all([
      apiRequest<Product[]>(`/catalog/products?${query.toString()}`, { token }),
      apiRequest<Category[]>("/catalog/categories", { token }),
      apiRequest<Supply[]>("/catalog/supplies", { token })
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
    setSupplies(suppliesData.filter((item) => item.active));
  }

  useEffect(() => {
    load();
  }, [token, search, selectedCategory, statusFilter, minPrice, maxPrice]);

  const visibleProducts = useMemo(() => products, [products]);

  const availableSupplies = useMemo(
    () => supplies.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [supplies]
  );

  function resetCreateForm() {
    setForm(createInitialForm());
    setPreviewImage(null);
    setRecipeDraft([]);
  }

  function normalizeRecipeItems(items: RecipeDraftItem[]) {
    return items
      .filter((item) => item.supplyId && Number(item.quantityRequired) > 0)
      .map((item) => ({
        supplyId: item.supplyId,
        quantityRequired: Number(item.quantityRequired)
      }));
  }

  async function saveRecipe(productId: string, items: RecipeDraftItem[]) {
    await apiRequest(`/catalog/products/${productId}/recipe`, {
      method: "PUT",
      token,
      body: { items: normalizeRecipeItems(items) }
    });
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const created = await apiRequest<Product>("/catalog/products", {
      method: "POST",
      token,
      body: {
        ...form,
        salePrice: Number(form.salePrice),
        categoryId: form.categoryId || null,
        imageUrl: previewImage
      }
    });
    await saveRecipe(created.id, recipeDraft);
    resetCreateForm();
    await load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este produto?")) return;
    await apiRequest(`/catalog/products/${id}`, { method: "DELETE", token });
    await load();
  }

  function openEdit(product: Product) {
    setEditingProductId(product.id);
    setEditForm({
      name: product.name,
      categoryId: product.categoryId ?? "",
      salePrice: Number(product.salePrice),
      saleUnit: product.saleUnit,
      active: product.active,
      description: product.description ?? "",
      imageUrl: product.imageUrl ?? ""
    });
    setEditPreviewImage(product.imageUrl ?? null);
    setEditRecipeDraft(
      product.recipeItems.length
        ? product.recipeItems.map((item) => ({
            key: item.id ?? crypto.randomUUID(),
            supplyId: item.supplyId,
            quantityRequired: Number(item.quantityRequired)
          }))
        : []
    );
  }

  function cancelEdit() {
    setEditingProductId(null);
    setEditForm(createInitialForm());
    setEditPreviewImage(null);
    setEditRecipeDraft([]);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingProductId) return;
    await apiRequest(`/catalog/products/${editingProductId}`, {
      method: "PUT",
      token,
      body: {
        ...editForm,
        salePrice: Number(editForm.salePrice),
        categoryId: editForm.categoryId || null,
        imageUrl: editPreviewImage
      }
    });
    await saveRecipe(editingProductId, editRecipeDraft);
    cancelEdit();
    await load();
  }

  async function handleDuplicate(productId: string) {
    await apiRequest(`/catalog/products/${productId}/duplicate`, { method: "POST", token, body: {} });
    await load();
  }

  async function handleToggle(productId: string) {
    await apiRequest(`/catalog/products/${productId}/toggle-active`, { method: "POST", token, body: {} });
    await load();
  }

  async function createCategory() {
    if (!categoryName.trim()) return;
    await apiRequest("/catalog/categories", {
      method: "POST",
      token,
      body: { name: categoryName }
    });
    setCategoryName("");
    await load();
  }

  async function renameCategory(category: Category) {
    const nextName = window.prompt("Novo nome da categoria", category.name);
    if (!nextName) return;
    await apiRequest(`/catalog/categories/${category.id}`, {
      method: "PUT",
      token,
      body: { name: nextName }
    });
    await load();
  }

  async function deleteCategory(categoryId: string) {
    if (!window.confirm("Excluir esta categoria?")) return;
    await apiRequest(`/catalog/categories/${categoryId}`, { method: "DELETE", token });
    if (selectedCategory === categoryId) setSelectedCategory("all");
    await load();
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
    await load();
  }

  async function previewMenuImport() {
    setImportMessage("");
    setImportLoading(true);
    try {
      const result = await apiRequest<ParsedMenu>("/catalog/menu-import/preview", {
        method: "POST",
        token,
        body: { rawText: rawMenuText }
      });
      setParsedMenu(result);
    } finally {
      setImportLoading(false);
    }
  }

  async function previewMenuFileImport() {
    if (!selectedMenuFile) return;
    setImportMessage("");
    setImportLoading(true);
    try {
      const dataUrl = await fileToDataUrl(selectedMenuFile);
      const result = await apiRequest<ParsedMenu>("/catalog/menu-import/preview-file", {
        method: "POST",
        token,
        body: {
          fileName: selectedMenuFile.name,
          mimeType: selectedMenuFile.type || "application/octet-stream",
          dataUrl
        }
      });
      setParsedMenu(result);
      setRawMenuText(result.texto_extraido ?? rawMenuText);
    } finally {
      setImportLoading(false);
    }
  }

  async function applyMenuImport() {
    if (!parsedMenu) return;
    setImportLoading(true);
    try {
      const result = await apiRequest<ParsedMenu>("/catalog/menu-import/apply", {
        method: "POST",
        token,
        body: { parsed: parsedMenu }
      });
      setParsedMenu(result);
      setImportMessage(
        `Importacao concluida: ${result.resumo_importacao.itens_criados} criado(s), ${result.resumo_importacao.itens_atualizados} atualizado(s), ${result.resumo_importacao.itens_pendentes_revisao} pendente(s).`
      );
      await load();
    } finally {
      setImportLoading(false);
    }
  }

  function updateRecipeDraft(
    setter: Dispatch<SetStateAction<RecipeDraftItem[]>>,
    key: string,
    patch: Partial<RecipeDraftItem>
  ) {
    setter((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeRecipeDraft(
    setter: Dispatch<SetStateAction<RecipeDraftItem[]>>,
    key: string
  ) {
    setter((current) => current.filter((item) => item.key !== key));
  }

  function RecipeEditor({
    items,
    onAdd,
    onChange,
    onRemove
  }: {
    items: RecipeDraftItem[];
    onAdd: () => void;
    onChange: (key: string, patch: Partial<RecipeDraftItem>) => void;
    onRemove: (key: string) => void;
  }) {
    return (
      <div className="space-y-3 rounded-3xl border p-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold">Insumos do produto</h4>
            <p className="text-sm text-muted">Defina a ficha tecnica direto no cadastro do item.</p>
          </div>
          <button className="btn-secondary" type="button" onClick={onAdd}>
            + Insumo
          </button>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl p-4 surface-soft text-sm text-muted">
            Nenhum insumo vinculado ainda. Se este produto consome estoque, adicione os insumos aqui.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.key} className="grid gap-3 rounded-2xl p-3 surface-soft md:grid-cols-[1fr_160px_80px]">
                <select
                  className="input"
                  value={item.supplyId}
                  onChange={(e) => onChange(item.key, { supplyId: e.target.value })}
                >
                  <option value="">Selecione o insumo</option>
                  {availableSupplies.map((supply) => (
                    <option key={supply.id} value={supply.id}>
                      {supply.name} ({supply.unit})
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  step="0.0001"
                  value={item.quantityRequired}
                  onChange={(e) => onChange(item.key, { quantityRequired: Number(e.target.value) })}
                  placeholder="Quantidade"
                />
                <button className="btn-secondary text-red-700" type="button" onClick={() => onRemove(item.key)}>
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Produtos vendidos" subtitle="Cadastre o item do cardapio e ja vincule os insumos dele na mesma tela." />

      <div className="card space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Importador automatico
            </p>
            <h2 className="mt-2 text-2xl font-bold">Cole um cardapio e revise antes de cadastrar</h2>
            <p className="mt-1 text-sm text-muted">
              O sistema identifica categorias, produtos, descricoes, precos, variacoes, sabores e adicionais. Campos duvidosos ficam pendentes para revisao.
            </p>
          </div>
          {parsedMenu ? (
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
              <div className="rounded-2xl p-3 surface-soft"><span className="text-muted">Categorias</span><strong className="block">{parsedMenu.resumo_importacao.categorias_encontradas}</strong></div>
              <div className="rounded-2xl p-3 surface-soft"><span className="text-muted">Itens</span><strong className="block">{parsedMenu.resumo_importacao.itens_encontrados}</strong></div>
              <div className="rounded-2xl p-3 surface-soft"><span className="text-muted">Criados</span><strong className="block">{parsedMenu.resumo_importacao.itens_criados}</strong></div>
              <div className="rounded-2xl p-3 surface-soft"><span className="text-muted">Atualizados</span><strong className="block">{parsedMenu.resumo_importacao.itens_atualizados}</strong></div>
              <div className="rounded-2xl p-3 surface-soft"><span className="text-muted">Revisao</span><strong className="block">{parsedMenu.resumo_importacao.itens_pendentes_revisao}</strong></div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <div className="rounded-3xl border p-4" style={{ borderColor: "var(--color-border)" }}>
              <label>
                <span className="label">Imagem, PDF ou arquivo de texto do cardapio</span>
                <input
                  className="input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,image/png,image/jpeg,image/webp,application/pdf,text/plain"
                  onChange={(event) => setSelectedMenuFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <p className="mt-2 text-xs text-muted">
                Envie uma foto nítida ou PDF do cardapio. O sistema extrai o texto, interpreta e mostra a previa antes de cadastrar.
              </p>
              <button
                className="btn-primary mt-3"
                type="button"
                onClick={previewMenuFileImport}
                disabled={user?.role !== "ADMIN" || !selectedMenuFile || importLoading}
              >
                {importLoading ? "Lendo arquivo..." : "Ler arquivo automaticamente"}
              </button>
            </div>

            <textarea
              className="input min-h-72 font-mono text-sm"
              placeholder={`Ou cole o texto manualmente:\nHAMBURGUERES\nX-Burguer - pao, carne, queijo e salada - R$ 24,90\n\nBEBIDAS\nRefrigerante lata - 6`}
              value={rawMenuText}
              onChange={(event) => setRawMenuText(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="button" onClick={previewMenuImport} disabled={user?.role !== "ADMIN" || rawMenuText.trim().length < 5 || importLoading}>
                {importLoading ? "Interpretando..." : "Interpretar texto colado"}
              </button>
              <button className="btn-secondary" type="button" onClick={applyMenuImport} disabled={user?.role !== "ADMIN" || !parsedMenu || importLoading}>
                Confirmar e cadastrar
              </button>
              <button className="btn-secondary" type="button" onClick={() => { setRawMenuText(""); setSelectedMenuFile(null); setParsedMenu(null); setImportMessage(""); }}>
                Limpar
              </button>
            </div>
            {importMessage ? <p className="rounded-2xl p-3 text-sm surface-soft">{importMessage}</p> : null}
          </div>

          <div className="max-h-[520px] space-y-3 overflow-auto rounded-3xl border p-4" style={{ borderColor: "var(--color-border)" }}>
            {!parsedMenu ? (
              <div className="rounded-3xl p-6 surface-soft text-sm text-muted">
                A previa estruturada aparece aqui antes de salvar. Nada sera cadastrado sem clicar em confirmar.
              </div>
            ) : (
              <>
                {parsedMenu.erros_encontrados.length ? (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {parsedMenu.erros_encontrados.map((error) => <p key={error}>{error}</p>)}
                  </div>
                ) : null}
                {parsedMenu.itens_pendentes_revisao.length ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <strong>Itens pendentes de revisao</strong>
                    <div className="mt-2 space-y-1">
                      {parsedMenu.itens_pendentes_revisao.slice(0, 6).map((item, index) => (
                        <p key={`${item.linha_original}-${index}`}>{item.linha_original} - {item.motivo}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {parsedMenu.categorias.map((category) => (
                  <div key={category.nome} className="rounded-3xl p-4 surface-soft">
                    <h3 className="text-lg font-bold">{category.nome}</h3>
                    <div className="mt-3 space-y-2">
                      {category.itens.map((item, index) => (
                        <div key={`${category.nome}-${item.nome}-${index}`} className="rounded-2xl bg-white/60 p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <strong>{item.nome}</strong>
                              <p className="text-muted">{item.descricao || "Sem descricao"}</p>
                            </div>
                            <span>{item.preco_promocional !== null ? formatMoney(item.preco_promocional) : item.preco !== null ? formatMoney(item.preco) : "Sem preco"}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="badge-soft rounded-full px-2 py-1">Confianca {item.confianca_extracao}</span>
                            <span className="badge-soft rounded-full px-2 py-1">{item.status_validacao}</span>
                            {item.variacoes.length ? <span className="badge-soft rounded-full px-2 py-1">{item.variacoes.length} variacao(oes)</span> : null}
                            {item.adicionais.length ? <span className="badge-soft rounded-full px-2 py-1">{item.adicionais.length} adicional(is)</span> : null}
                            {item.sabores.length ? <span className="badge-soft rounded-full px-2 py-1">{item.sabores.length} sabor(es)</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <div className="card space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Novo item</p>
              <h3 className="mt-2 text-2xl font-bold">Cadastro rapido de produto</h3>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <label>
                <span className="label">Nome do produto</span>
                <input className="input" placeholder="Ex.: Camaro ao catupiry, Chopp pilsen, Batata frita" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <span className="field-hint">Esse e o nome que aparece no cardapio e na comanda.</span>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  <span className="label">Categoria</span>
                  <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Sem categoria</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <span className="field-hint">Ajuda a organizar o cardapio e a busca dos itens.</span>
                </label>
                <label>
                  <span className="label">Preco de venda</span>
                  <input className="input" type="number" step="0.01" placeholder="Ex.: 39,90" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} />
                  <span className="field-hint">Valor cobrado do cliente por unidade vendida.</span>
                </label>
              </div>
              <label>
                <span className="label">Unidade de venda</span>
                <select className="input" value={form.saleUnit} onChange={(e) => setForm({ ...form, saleUnit: e.target.value })}>
                  <option value="UNIDADE">Unidade</option>
                  <option value="PORCAO">Porcao</option>
                  <option value="COPO">Copo</option>
                  <option value="GARRAFA">Garrafa</option>
                </select>
                <span className="field-hint">Define como o item sera vendido no cardapio e na comanda.</span>
              </label>
              <label>
                <span className="label">Descricao do produto</span>
                <textarea className="input min-h-24" placeholder="Explique rapidamente o prato, bebida ou combo" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <span className="field-hint">Descricao curta para ajudar no cardapio e no atendimento.</span>
              </label>
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

              <RecipeEditor
                items={recipeDraft}
                onAdd={() => setRecipeDraft((current) => [...current, createRecipeDraft()])}
                onChange={(key, patch) => updateRecipeDraft(setRecipeDraft, key, patch)}
                onRemove={(key) => removeRecipeDraft(setRecipeDraft, key)}
              />

              <button className="btn-primary w-full" disabled={user?.role !== "ADMIN"}>Salvar produto</button>
            </form>
          </div>

          {editingProductId ? (
            <div className="card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Edicao</p>
                  <h3 className="mt-2 text-2xl font-bold">Editar produto e insumos</h3>
                </div>
                <button className="btn-secondary" type="button" onClick={cancelEdit}>Fechar</button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                  <label>
                    <span className="label">Nome do produto</span>
                    <input className="input" placeholder="Nome que aparece no cardapio" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="label">Categoria</span>
                    <select className="input" value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
                      <option value="">Sem categoria</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="label">Preco de venda</span>
                    <input className="input" type="number" step="0.01" placeholder="Valor cobrado do cliente" value={editForm.salePrice} onChange={(e) => setEditForm({ ...editForm, salePrice: Number(e.target.value) })} />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="label">Unidade de venda</span>
                    <select className="input" value={editForm.saleUnit} onChange={(e) => setEditForm({ ...editForm, saleUnit: e.target.value })}>
                      <option value="UNIDADE">Unidade</option>
                      <option value="PORCAO">Porcao</option>
                      <option value="COPO">Copo</option>
                      <option value="GARRAFA">Garrafa</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
                    <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
                    <span>Produto ativo</span>
                  </label>
                </div>
                <label>
                  <span className="label">Descricao do produto</span>
                  <textarea className="input min-h-24" placeholder="Descricao curta do item" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </label>
                <div className="space-y-2">
                  <label className="label">Imagem do produto</label>
                  <input
                    className="input"
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setEditPreviewImage(await fileToDataUrl(file));
                    }}
                  />
                </div>
                {editPreviewImage ? <img src={editPreviewImage} alt="Preview do produto em edicao" className="h-36 w-full rounded-3xl object-cover" /> : null}

                <RecipeEditor
                  items={editRecipeDraft}
                  onAdd={() => setEditRecipeDraft((current) => [...current, createRecipeDraft()])}
                  onChange={(key, patch) => updateRecipeDraft(setEditRecipeDraft, key, patch)}
                  onRemove={(key) => removeRecipeDraft(setEditRecipeDraft, key)}
                />

                <button className="btn-primary w-full" disabled={user?.role !== "ADMIN"}>Salvar alteracoes</button>
              </form>
            </div>
          ) : null}

          <div className="rounded-3xl p-4 surface-soft">
            <h4 className="font-semibold">Categorias editaveis</h4>
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
                  <p className="mt-3 line-clamp-2 text-sm text-muted">{product.description || "Sem descricao cadastrada."}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="badge-soft rounded-full px-3 py-1">Custo estimado {formatMoney(product.recipeCost)}</span>
                    <span className="badge-soft rounded-full px-3 py-1">{product.saleUnit}</span>
                    <span className="badge-soft rounded-full px-3 py-1">{product.recipeItems.length} insumo(s)</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button className="btn-secondary" onClick={() => openEdit(product)}>Editar item</button>
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
