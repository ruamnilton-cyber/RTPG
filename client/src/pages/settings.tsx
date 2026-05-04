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

  const [asaasConfigured, setAsaasConfigured] = useState(false);
  const [asaasHint, setAsaasHint] = useState<string | null>(null);
  const [asaasSandbox, setAsaasSandbox] = useState(true);
  const [asaasSaving, setAsaasSaving] = useState(false);
  const [asaasMessage, setAsaasMessage] = useState("");
  const asaasKeyRef = useRef<HTMLInputElement>(null);
  const asaasCpfRef = useRef<HTMLInputElement>(null);

  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFromName, setSmtpFromName] = useState("RTPG Gestão");
  const [smtpPassHint, setSmtpPassHint] = useState<string | null>(null);
  const smtpPassRef = useRef<HTMLInputElement>(null);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState("");
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<{
      mercadoPago: { configured: boolean; accessTokenHint: string | null };
      asaas: { configured: boolean; apiKeyHint: string | null; sandbox: boolean };
    }>("/payments/config", { token })
      .then((r) => {
        setMpConfigured(r.mercadoPago.configured);
        setMpHint(r.mercadoPago.accessTokenHint);
        setAsaasConfigured(r.asaas.configured);
        setAsaasHint(r.asaas.apiKeyHint);
        setAsaasSandbox(r.asaas.sandbox);
      })
      .catch(() => {});

    apiRequest<{
      configured: boolean; host: string; port: number; secure: boolean;
      user: string; fromName: string; passHint: string | null;
    }>("/email/config", { token })
      .then((r) => {
        setSmtpConfigured(r.configured);
        setSmtpHost(r.host || "smtp.gmail.com");
        setSmtpPort(r.port || 587);
        setSmtpSecure(r.secure);
        setSmtpUser(r.user || "");
        setSmtpFromName(r.fromName || "RTPG Gestão");
        setSmtpPassHint(r.passHint);
      })
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

  async function handleSaveAsaas(event: FormEvent) {
    event.preventDefault();
    const apiKey = asaasKeyRef.current?.value?.trim();
    if (!apiKey) return;
    setAsaasSaving(true);
    setAsaasMessage("");
    try {
      await apiRequest("/payments/config/asaas", {
        method: "PUT",
        token,
        body: { apiKey, sandbox: asaasSandbox, cpfCnpj: asaasCpfRef.current?.value?.trim() || undefined }
      });
      setAsaasConfigured(true);
      setAsaasHint(`...${apiKey.slice(-6)}`);
      setAsaasMessage("API Key salva com sucesso.");
      if (asaasKeyRef.current) asaasKeyRef.current.value = "";
    } catch (err) {
      setAsaasMessage(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setAsaasSaving(false);
    }
  }

  async function handleRemoveAsaas() {
    if (!window.confirm("Remover integração com Asaas?")) return;
    await apiRequest("/payments/config/asaas", { method: "DELETE", token });
    setAsaasConfigured(false);
    setAsaasHint(null);
    setAsaasMessage("Integração removida.");
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
              <p className="mt-2 text-sm text-muted">Cole o Access Token de produção. Se o Mercado Pago falhar e o Asaas estiver configurado, o sistema usa o Asaas automaticamente como fallback.</p>
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

          <form className="card space-y-4" onSubmit={handleSaveAsaas}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Pagamentos</p>
              <h3 className="mt-2 text-2xl font-bold">Asaas</h3>
              <p className="mt-2 text-sm text-muted">Cole a API Key da sua conta Asaas. Funciona como gateway principal (se MP não estiver configurado) ou fallback automático.</p>
            </div>
            {asaasConfigured ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                ✓ Integração ativa — chave terminando em <strong>{asaasHint}</strong>
                {asaasSandbox ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Sandbox</span> : <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Produção</span>}
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                Não configurado. Adicione a API Key para habilitar Pix via Asaas.
              </div>
            )}
            <input
              ref={asaasKeyRef}
              className="input font-mono text-sm"
              type="password"
              placeholder="$aact_..."
              autoComplete="off"
            />
            <input
              ref={asaasCpfRef}
              className="input text-sm"
              type="text"
              placeholder="CPF/CNPJ do pagador padrão (opcional, ex: 000.000.001-91)"
              autoComplete="off"
            />
            <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer" style={{ borderColor: "var(--color-border)" }}>
              <input
                type="checkbox"
                checked={asaasSandbox}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAsaasSandbox(e.target.checked)}
              />
              <div>
                <strong className="block text-sm">Modo sandbox (testes)</strong>
                <p className="text-xs text-muted">Desative para usar a API de produção e cobrar de verdade.</p>
              </div>
            </label>
            {asaasMessage ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{asaasMessage}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="submit" disabled={asaasSaving}>
                {asaasSaving ? "Salvando..." : "Salvar API Key"}
              </button>
              {asaasConfigured ? (
                <button className="btn-secondary" type="button" onClick={handleRemoveAsaas}>Remover integração</button>
              ) : null}
            </div>
          </form>
          <div className="card space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>E-mail</p>
              <h3 className="mt-2 text-2xl font-bold">Configuração SMTP</h3>
              <p className="mt-2 text-sm text-muted">
                Configure o servidor de e-mail para enviar boas-vindas aos leads e credenciais de acesso.
                No Gmail, use uma <strong>Senha de App</strong> (não a senha normal).
              </p>
            </div>

            {smtpConfigured ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                ✓ E-mail configurado — conta <strong>{smtpUser}</strong>
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                Não configurado. Sem isso, os leads não recebem e-mail de boas-vindas.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="label">Nome do remetente</span>
                <input className="input" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="RTPG Gestão" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="label">E-mail (usuário SMTP)</span>
                <input className="input" type="email" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="seu@gmail.com" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="label">Senha de App {smtpPassHint ? <span className="text-muted">— atual: {smtpPassHint}</span> : null}</span>
                <input ref={smtpPassRef} className="input font-mono text-sm" type="password" placeholder="Nova senha (deixe em branco para manter)" autoComplete="off" />
              </label>
              <label className="space-y-1">
                <span className="label">Servidor SMTP (host)</span>
                <input className="input" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
              </label>
              <label className="space-y-1">
                <span className="label">Porta</span>
                <input className="input" type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer md:col-span-2" style={{ borderColor: "var(--color-border)" }}>
                <input type="checkbox" checked={smtpSecure} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmtpSecure(e.target.checked)} />
                <div>
                  <strong className="block text-sm">SSL/TLS (porta 465)</strong>
                  <p className="text-xs text-muted">Ative apenas se usar porta 465. Para 587 (Gmail padrão), deixe desmarcado.</p>
                </div>
              </label>
            </div>

            {smtpMessage ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{smtpMessage}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                className="btn-primary"
                type="button"
                disabled={smtpSaving}
                onClick={async () => {
                  const pass = smtpPassRef.current?.value?.trim();
                  if (!smtpUser || !smtpHost) return;
                  if (!smtpConfigured && !pass) { setSmtpMessage("Informe a senha para configurar pela primeira vez."); return; }
                  setSmtpSaving(true);
                  setSmtpMessage("");
                  try {
                    const body: Record<string, unknown> = { host: smtpHost, port: smtpPort, secure: smtpSecure, user: smtpUser, fromName: smtpFromName };
                    if (pass) body.pass = pass;
                    else {
                      const cur = await apiRequest<{ pass?: string }>("/email/config", { token });
                      body.pass = (cur as unknown as { passHint?: string }).passHint ?? "";
                    }
                    await apiRequest("/email/config", { method: "PUT", token, body });
                    setSmtpConfigured(true);
                    setSmtpPassHint(pass ? `...${pass.slice(-4)}` : smtpPassHint);
                    if (smtpPassRef.current) smtpPassRef.current.value = "";
                    setSmtpMessage("Configuração salva.");
                  } catch (err) {
                    setSmtpMessage(err instanceof Error ? err.message : "Erro ao salvar.");
                  } finally {
                    setSmtpSaving(false);
                  }
                }}
              >
                {smtpSaving ? "Salvando..." : "Salvar configuração"}
              </button>
              {smtpConfigured ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={async () => {
                    await apiRequest("/email/config", { method: "DELETE", token });
                    setSmtpConfigured(false);
                    setSmtpPassHint(null);
                    setSmtpMessage("Configuração removida.");
                  }}
                >
                  Remover
                </button>
              ) : null}
            </div>

            {smtpConfigured ? (
              <div className="rounded-3xl p-4 surface-soft space-y-3">
                <p className="text-sm font-semibold">Enviar e-mail de teste</p>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    type="email"
                    placeholder="destinatario@email.com"
                    value={smtpTestEmail}
                    onChange={(e) => setSmtpTestEmail(e.target.value)}
                  />
                  <button
                    className="btn-secondary shrink-0"
                    type="button"
                    disabled={smtpTesting || !smtpTestEmail}
                    onClick={async () => {
                      setSmtpTesting(true);
                      setSmtpMessage("");
                      try {
                        await apiRequest("/email/test", { method: "POST", token, body: { to: smtpTestEmail } });
                        setSmtpMessage(`Teste enviado para ${smtpTestEmail}.`);
                      } catch (err) {
                        setSmtpMessage(err instanceof Error ? err.message : "Erro ao enviar teste.");
                      } finally {
                        setSmtpTesting(false);
                      }
                    }}
                  >
                    {smtpTesting ? "Enviando..." : "Testar"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
