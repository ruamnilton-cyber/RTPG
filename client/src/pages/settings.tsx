import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/common";
import { paletteMap } from "../lib/palettes";
import { apiRequest } from "../lib/api";
import { useThemeSettings } from "../state/theme";
import { useAuth } from "../state/auth";

type EstablishmentProfile = {
  tradeName: string;
  legalName: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  serviceFee: number;
  serviceFeeLocked: boolean;
  deliveryFee: number;
  currency: string;
  timeZone: string;
  instagram: string;
  facebook: string;
  website: string;
  notes: string;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const { token } = useAuth();
  const { paletteId, paletteOptions, setPreviewPalette, savePalette, logoUrl, saveLogo, removeLogo, refreshSettings } = useThemeSettings();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [securityMessage, setSecurityMessage] = useState("");
  const [profile, setProfile] = useState<EstablishmentProfile>({
    tradeName: "",
    legalName: "",
    cnpj: "",
    phone: "",
    email: "",
    address: "",
    openingHours: "",
    serviceFee: 0,
    serviceFeeLocked: false,
    deliveryFee: 0,
    currency: "BRL",
    timeZone: "America/Sao_Paulo",
    instagram: "",
    facebook: "",
    website: "",
    notes: ""
  });
  const selectedPalette = useMemo(() => paletteMap[paletteId] ?? paletteOptions[0], [paletteId, paletteOptions]);

  const [mpConfigured, setMpConfigured] = useState(false);
  const [mpHint, setMpHint] = useState<string | null>(null);
  const [mpSaving, setMpSaving] = useState(false);
  const [mpMessage, setMpMessage] = useState("");
  const mpTokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ mercadoPago: { configured: boolean; accessTokenHint: string | null } }>("/payments/config", { token })
      .then((r) => { setMpConfigured(r.mercadoPago.configured); setMpHint(r.mercadoPago.accessTokenHint); })
      .catch(() => {});
  }, [token]);

  async function handleSaveMp(event: FormEvent) {
    event.preventDefault();
    const accessToken = mpTokenRef.current?.value?.trim();
    if (!accessToken) return;
    setMpSaving(true);
    setMpMessage("");
    try {
      await apiRequest("/payments/config/mercadopago", { method: "PUT", token, body: { accessToken } });
      setMpConfigured(true);
      setMpHint(`...${accessToken.slice(-6)}`);
      setMpMessage("Access Token salvo com sucesso.");
      if (mpTokenRef.current) mpTokenRef.current.value = "";
    } catch (err) {
      setMpMessage(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setMpSaving(false);
    }
  }

  async function handleRemoveMp() {
    if (!window.confirm("Remover integração com Mercado Pago?")) return;
    await apiRequest("/payments/config/mercadopago", { method: "DELETE", token });
    setMpConfigured(false);
    setMpHint(null);
    setMpMessage("Integração removida.");
  }

  useEffect(() => {
    if (!token) return;
    apiRequest<{ establishment: EstablishmentProfile }>("/settings", { token }).then((settings) => {
      setProfile(settings.establishment);
    });
  }, [token]);

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(await fileToDataUrl(file));
  }

  async function handleSaveLogo() {
    if (!selectedFile || !previewUrl) return;
    await saveLogo({ fileName: selectedFile.name, dataUrl: previewUrl });
    setSelectedFile(null);
    await refreshSettings();
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    await apiRequest("/settings/establishment", {
      method: "PUT",
      token,
      body: {
        ...profile,
        serviceFee: Number(profile.serviceFee),
        serviceFeeLocked: Boolean(profile.serviceFeeLocked),
        deliveryFee: Number(profile.deliveryFee)
      }
    });
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityMessage("");
    const formData = new FormData(event.currentTarget);
    await apiRequest("/auth/reset-password", {
      method: "POST",
      token,
      body: {
        currentPassword: String(formData.get("currentPassword") ?? ""),
        newPassword: String(formData.get("newPassword") ?? "")
      }
    });
    event.currentTarget.reset();
    setSecurityMessage("Senha atualizada com sucesso.");
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Configurações" subtitle="Estabelecimento, identidade visual, tema e base institucional do produto." />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={handleSaveProfile} className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Estabelecimento</p>
            <h3 className="mt-2 text-2xl font-bold">Dados institucionais</h3>
            <p className="mt-2 text-sm text-muted">Centralize informações do bar/restaurante para identidade, operação e evolução futura multiunidade.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" placeholder="Nome do estabelecimento" value={profile.tradeName} onChange={(e) => setProfile({ ...profile, tradeName: e.target.value })} />
            <input className="input" placeholder="Razão social" value={profile.legalName} onChange={(e) => setProfile({ ...profile, legalName: e.target.value })} />
            <input className="input" placeholder="CNPJ" value={profile.cnpj} onChange={(e) => setProfile({ ...profile, cnpj: e.target.value })} />
            <input className="input" placeholder="Telefone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <input className="input" placeholder="E-mail" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <input className="input" placeholder="Horário de funcionamento" value={profile.openingHours} onChange={(e) => setProfile({ ...profile, openingHours: e.target.value })} />
            <input className="input" placeholder="Taxa de serviço (%)" type="number" step="0.01" value={profile.serviceFee} onChange={(e) => setProfile({ ...profile, serviceFee: Number(e.target.value) })} />
            <input className="input" placeholder="Taxa de entrega" type="number" step="0.01" value={profile.deliveryFee} onChange={(e) => setProfile({ ...profile, deliveryFee: Number(e.target.value) })} />
            <label className="md:col-span-2 flex items-center justify-between gap-3 rounded-3xl border px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
              <div>
                <strong className="block">Travar taxa de serviÃ§o nas comandas</strong>
                <p className="text-sm text-muted">Quando ativado, a taxa padrÃ£o do estabelecimento entra travada no fechamento e nÃ£o precisa ser alterada comanda por comanda.</p>
              </div>
              <input type="checkbox" checked={profile.serviceFeeLocked} onChange={(e) => setProfile({ ...profile, serviceFeeLocked: e.target.checked })} />
            </label>
            <input className="input" placeholder="Moeda" value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })} />
            <input className="input" placeholder="Fuso horário" value={profile.timeZone} onChange={(e) => setProfile({ ...profile, timeZone: e.target.value })} />
            <input className="input" placeholder="Instagram" value={profile.instagram} onChange={(e) => setProfile({ ...profile, instagram: e.target.value })} />
            <input className="input" placeholder="Facebook" value={profile.facebook} onChange={(e) => setProfile({ ...profile, facebook: e.target.value })} />
            <input className="input md:col-span-2" placeholder="Website" value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} />
            <input className="input md:col-span-2" placeholder="Endereço" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
            <textarea className="input md:col-span-2 min-h-24" placeholder="Observações institucionais" value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} />
          </div>

          <button className="btn-primary">Salvar dados do estabelecimento</button>
        </form>

        <div className="space-y-5">
          <div className="card space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Personalização visual</p>
              <h3 className="mt-2 text-2xl font-bold">Tema do sistema</h3>
            </div>
            <div className="grid gap-3">
              {paletteOptions.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  className="rounded-3xl border p-4 text-left transition"
                  style={{ borderColor: palette.id === paletteId ? "var(--color-primary)" : "var(--color-border)", background: "var(--color-surface-alt)" }}
                  onClick={() => setPreviewPalette(palette.id)}
                >
                  <div className="mb-3 flex gap-2">
                    {Object.values(palette.colors).slice(0, 4).map((color) => <span key={color} className="h-7 w-7 rounded-full" style={{ background: color }} />)}
                  </div>
                  <strong>{palette.name}</strong>
                  <p className="mt-1 text-sm text-muted">{palette.description}</p>
                </button>
              ))}
            </div>

            <div className="rounded-3xl p-5" style={{ background: selectedPalette.colors.background, border: `1px solid ${selectedPalette.colors.border}` }}>
              <div className="rounded-3xl p-5" style={{ background: selectedPalette.colors.surface, color: selectedPalette.colors.text }}>
                <p className="text-xs uppercase tracking-[0.3em]" style={{ color: selectedPalette.colors.primary }}>Preview visual</p>
                <h4 className="mt-2 text-xl font-bold">Ambiente do sistema</h4>
                <div className="mt-4 flex gap-3">
                  <div className="rounded-2xl px-4 py-3" style={{ background: selectedPalette.colors.primary, color: "var(--color-on-primary)" }}>Botão</div>
                  <div className="rounded-2xl px-4 py-3" style={{ background: selectedPalette.colors.badge, color: "var(--color-on-badge)" }}>Badge</div>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={() => savePalette(paletteId)}>Salvar paleta</button>
          </div>

          <div className="card space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Branding</p>
              <h3 className="mt-2 text-2xl font-bold">Logo principal</h3>
            </div>
            <div className="rounded-3xl p-6 text-center surface-soft">
              {(previewUrl ?? logoUrl) ? (
                <img src={previewUrl ?? logoUrl ?? ""} alt="Preview da logo" className="mx-auto h-40 w-40 rounded-3xl object-contain" />
              ) : (
                <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-3xl border border-dashed text-sm text-muted" style={{ borderColor: "var(--color-border)" }}>
                  Sem logo cadastrada
                </div>
              )}
            </div>
            <input className="input" type="file" accept=".png,.jpg,.jpeg,.svg" onChange={handleLogoChange} />
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={handleSaveLogo} disabled={!selectedFile}>Salvar logo</button>
              <button className="btn-secondary" type="button" onClick={() => removeLogo()}>Remover logo</button>
            </div>
          </div>

          <form className="card space-y-4" onSubmit={handlePasswordReset}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Segurança</p>
              <h3 className="mt-2 text-2xl font-bold">Atualizar senha</h3>
              <p className="mt-2 text-sm text-muted">Fluxo interno para redefinição segura enquanto a recuperação por e-mail fica preparada para a próxima etapa do produto.</p>
            </div>
            <input className="input" name="currentPassword" type="password" placeholder="Senha atual" required />
            <input className="input" name="newPassword" type="password" placeholder="Nova senha" required />
            {securityMessage ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{securityMessage}</p> : null}
            <button className="btn-primary">Atualizar senha</button>
          </form>

          <form className="card space-y-4" onSubmit={handleSaveMp}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Pagamentos</p>
              <h3 className="mt-2 text-2xl font-bold">Mercado Pago</h3>
              <p className="mt-2 text-sm text-muted">Cole o Access Token de produção da sua conta Mercado Pago para habilitar cobranças via Pix nas mesas.</p>
            </div>
            {mpConfigured ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                ✓ Integração ativa — token terminando em <strong>{mpHint}</strong>
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                Não configurado. Adicione o Access Token para habilitar Pix.
              </div>
            )}
            <input
              ref={mpTokenRef}
              className="input font-mono text-sm"
              type="password"
              placeholder="APP_USR-..."
              autoComplete="off"
            />
            {mpMessage ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{mpMessage}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="submit" disabled={mpSaving}>
                {mpSaving ? "Salvando..." : "Salvar Access Token"}
              </button>
              {mpConfigured ? (
                <button className="btn-secondary" type="button" onClick={handleRemoveMp}>Remover integração</button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
