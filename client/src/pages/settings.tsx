import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
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
  const { paletteId, paletteOptions, setPreviewPalette, savePalette, logoUrl, saveLogo, removeLogo, refreshSettings } =
    useThemeSettings();
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
      <PageHeader
        title="Configuracoes"
        subtitle="Estabelecimento, identidade visual, taxa da casa e base institucional do produto."
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={handleSaveProfile} className="card space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
              Estabelecimento
            </p>
            <h3 className="mt-2 text-2xl font-bold">Dados institucionais</h3>
            <p className="mt-2 text-sm text-muted">
              Centralize informacoes do bar/restaurante para identidade, operacao e configuracoes da casa.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="label">Nome do estabelecimento</span>
              <input
                className="input"
                placeholder="Nome que aparece no sistema e para a equipe"
                value={profile.tradeName}
                onChange={(e) => setProfile({ ...profile, tradeName: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Razao social</span>
              <input
                className="input"
                placeholder="Nome juridico da empresa, se houver"
                value={profile.legalName}
                onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
              />
            </label>
            <label>
              <span className="label">CNPJ</span>
              <input
                className="input"
                placeholder="Documento da empresa"
                value={profile.cnpj}
                onChange={(e) => setProfile({ ...profile, cnpj: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Telefone</span>
              <input
                className="input"
                placeholder="Telefone principal do restaurante"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </label>
            <label>
              <span className="label">E-mail</span>
              <input
                className="input"
                placeholder="E-mail de contato da casa"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Horario de funcionamento</span>
              <input
                className="input"
                placeholder="Ex.: Qua a Dom, 18h as 02h"
                value={profile.openingHours}
                onChange={(e) => setProfile({ ...profile, openingHours: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Taxa de entrega</span>
              <input
                className="input"
                placeholder="Valor cobrado em pedidos de entrega"
                type="number"
                step="0.01"
                value={profile.deliveryFee}
                onChange={(e) => setProfile({ ...profile, deliveryFee: Number(e.target.value) })}
              />
            </label>

            <div
              className="md:col-span-2 rounded-3xl border p-4"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--color-primary)" }}>
                Taxa de servico
              </p>
              <h4 className="mt-2 text-lg font-bold">Configuracao da taxa da casa</h4>
              <p className="mt-1 text-sm text-muted">
                Esse percentual aparece no fechamento da conta da mesa e pode ser cobrado ou nao em cada comanda.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Percentual (%)</span>
                  <input
                    className="input"
                    placeholder="Ex.: 10"
                    type="number"
                    step="0.01"
                    value={profile.serviceFee}
                    onChange={(e) => setProfile({ ...profile, serviceFee: Number(e.target.value) })}
                  />
                </label>

                <label
                  className="flex items-center justify-between gap-3 rounded-3xl border px-4 py-3"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div>
                    <strong className="block">Travar percentual nas comandas</strong>
                    <p className="text-sm text-muted">
                      O operador decide cobrar ou nao, mas o percentual fica fixo para a casa.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.serviceFeeLocked}
                    onChange={(e) => setProfile({ ...profile, serviceFeeLocked: e.target.checked })}
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-3xl border px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
                <div>
                  <strong className="block">Resumo da taxa</strong>
                  <p className="text-sm text-muted">Ela continua aparecendo no fechamento da mesa para cobrar ou nao.</p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-sm font-semibold"
                  style={{ background: "color-mix(in srgb, var(--color-primary) 12%, white)" }}
                >
                  {profile.serviceFee || 0}% {profile.serviceFeeLocked ? "travada" : "editavel"}
                </span>
              </div>
            </div>

            <label>
              <span className="label">Moeda</span>
              <input
                className="input"
                placeholder="Ex.: BRL"
                value={profile.currency}
                onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Fuso horario</span>
              <input
                className="input"
                placeholder="Ex.: America/Sao_Paulo"
                value={profile.timeZone}
                onChange={(e) => setProfile({ ...profile, timeZone: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Instagram</span>
              <input
                className="input"
                placeholder="@usuario ou link do Instagram"
                value={profile.instagram}
                onChange={(e) => setProfile({ ...profile, instagram: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Facebook</span>
              <input
                className="input"
                placeholder="Link ou nome da pagina"
                value={profile.facebook}
                onChange={(e) => setProfile({ ...profile, facebook: e.target.value })}
              />
            </label>
            <label>
              <span className="label">Website</span>
              <input
                className="input md:col-span-2"
                placeholder="Site oficial ou pagina principal"
                value={profile.website}
                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
              />
            </label>
            <label className="md:col-span-2">
              <span className="label">Endereco</span>
              <input
                className="input"
                placeholder="Endereco completo do estabelecimento"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              />
            </label>
            <label className="md:col-span-2">
              <span className="label">Observacoes institucionais</span>
              <textarea
                className="input min-h-24"
                placeholder="Informacoes importantes sobre a casa, atendimento ou comunicacao"
                value={profile.notes}
                onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
              />
            </label>
          </div>

          <button className="btn-primary">Salvar dados do estabelecimento</button>
        </form>

        <div className="space-y-5">
          <div className="card space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
                Personalizacao visual
              </p>
              <h3 className="mt-2 text-2xl font-bold">Tema do sistema</h3>
            </div>
            <div className="grid gap-3">
              {paletteOptions.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  className="rounded-3xl border p-4 text-left transition"
                  style={{
                    borderColor: palette.id === paletteId ? "var(--color-primary)" : "var(--color-border)",
                    background: "var(--color-surface-alt)"
                  }}
                  onClick={() => setPreviewPalette(palette.id)}
                >
                  <div className="mb-3 flex gap-2">
                    {Object.values(palette.colors)
                      .slice(0, 4)
                      .map((color) => (
                        <span key={color} className="h-7 w-7 rounded-full" style={{ background: color }} />
                      ))}
                  </div>
                  <strong>{palette.name}</strong>
                  <p className="mt-1 text-sm text-muted">{palette.description}</p>
                </button>
              ))}
            </div>

            <div
              className="rounded-3xl p-5"
              style={{ background: selectedPalette.colors.background, border: `1px solid ${selectedPalette.colors.border}` }}
            >
              <div className="rounded-3xl p-5" style={{ background: selectedPalette.colors.surface, color: selectedPalette.colors.text }}>
                <p className="text-xs uppercase tracking-[0.3em]" style={{ color: selectedPalette.colors.primary }}>
                  Preview visual
                </p>
                <h4 className="mt-2 text-xl font-bold">Ambiente do sistema</h4>
                <div className="mt-4 flex gap-3">
                  <div className="rounded-2xl px-4 py-3" style={{ background: selectedPalette.colors.primary, color: "var(--color-on-primary)" }}>
                    Botao
                  </div>
                  <div className="rounded-2xl px-4 py-3" style={{ background: selectedPalette.colors.badge, color: "var(--color-on-badge)" }}>
                    Badge
                  </div>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={() => savePalette(paletteId)}>
              Salvar paleta
            </button>
          </div>

          <div className="card space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
                Branding
              </p>
              <h3 className="mt-2 text-2xl font-bold">Logo principal</h3>
            </div>
            <div className="rounded-3xl p-6 text-center surface-soft">
              {previewUrl ?? logoUrl ? (
                <img src={previewUrl ?? logoUrl ?? ""} alt="Preview da logo" className="mx-auto h-40 w-40 rounded-3xl object-contain" />
              ) : (
                <div
                  className="mx-auto flex h-40 w-40 items-center justify-center rounded-3xl border border-dashed text-sm text-muted"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  Sem logo cadastrada
                </div>
              )}
            </div>
            <input className="input" type="file" accept=".png,.jpg,.jpeg,.svg" onChange={handleLogoChange} />
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={handleSaveLogo} disabled={!selectedFile}>
                Salvar logo
              </button>
              <button className="btn-secondary" type="button" onClick={() => removeLogo()}>
                Remover logo
              </button>
            </div>
          </div>

          <form className="card space-y-4" onSubmit={handlePasswordReset}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
                Seguranca
              </p>
              <h3 className="mt-2 text-2xl font-bold">Atualizar senha</h3>
              <p className="mt-2 text-sm text-muted">
                Fluxo interno para redefinicao segura enquanto a recuperacao por e-mail fica preparada para a proxima etapa.
              </p>
            </div>
            <input className="input" name="currentPassword" type="password" placeholder="Senha atual" required />
            <input className="input" name="newPassword" type="password" placeholder="Nova senha" required />
            {securityMessage ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{securityMessage}</p> : null}
            <button className="btn-primary">Atualizar senha</button>
          </form>
        </div>
      </div>
    </div>
  );
}
