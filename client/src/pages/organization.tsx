import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";

type Branch = {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  active: boolean;
  timezone: string;
  serviceFee: number;
  deliveryFee: number;
  channels: Array<"SALAO" | "BALCAO" | "DELIVERY" | "WHATSAPP" | "QR">;
};

type Organization = {
  companyName: string;
  tradeName: string;
  cnpj: string;
  operationModel: "MONOUNIDADE" | "MULTIUNIDADE_PREPARADO";
  primaryFocus: "HIBRIDO" | "SALAO" | "DELIVERY" | "BAR" | "RESTAURANTE";
  branches: Branch[];
  channelsEnabled: Array<"SALAO" | "BALCAO" | "DELIVERY" | "WHATSAPP" | "QR">;
  whatsappAutomationEnabled: boolean;
};

const channels = ["SALAO", "BALCAO", "DELIVERY", "WHATSAPP", "QR"] as const;

export function OrganizationPage() {
  const { token } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const result = await apiRequest<Organization>("/organization", { token });
    setOrganization(result);
  }

  useEffect(() => {
    load();
  }, [token]);

  if (!organization) {
    return <div className="card">Carregando organizacao...</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Organizacao e canais" subtitle="Base pronta para multiunidade, operacao omnichannel e governanca do produto." />

      <form
        className="card space-y-4"
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          await apiRequest("/organization", {
            method: "PUT",
            token,
            body: organization
          });
          setMessage("Organizacao atualizada com sucesso.");
        }}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input className="input" value={organization.companyName} onChange={(e) => setOrganization({ ...organization, companyName: e.target.value })} placeholder="Razao social / empresa" />
          <input className="input" value={organization.tradeName} onChange={(e) => setOrganization({ ...organization, tradeName: e.target.value })} placeholder="Nome fantasia" />
          <input className="input" value={organization.cnpj} onChange={(e) => setOrganization({ ...organization, cnpj: e.target.value })} placeholder="CNPJ" />
          <select className="input" value={organization.operationModel} onChange={(e) => setOrganization({ ...organization, operationModel: e.target.value as Organization["operationModel"] })}>
            <option value="MONOUNIDADE">Monounidade</option>
            <option value="MULTIUNIDADE_PREPARADO">Multiunidade preparado</option>
          </select>
          <select className="input" value={organization.primaryFocus} onChange={(e) => setOrganization({ ...organization, primaryFocus: e.target.value as Organization["primaryFocus"] })}>
            <option value="HIBRIDO">Hibrido</option>
            <option value="SALAO">Salao</option>
            <option value="DELIVERY">Delivery</option>
            <option value="BAR">Bar</option>
            <option value="RESTAURANTE">Restaurante</option>
          </select>
          <label className="flex items-center gap-2 rounded-2xl border px-4 py-3">
            <input
              type="checkbox"
              checked={organization.whatsappAutomationEnabled}
              onChange={(e) => setOrganization({ ...organization, whatsappAutomationEnabled: e.target.checked })}
            />
            Automacao no WhatsApp
          </label>
        </div>

        <div className="rounded-3xl p-4 surface-soft">
          <p className="text-sm font-semibold">Canais habilitados</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {channels.map((channel) => {
              const active = organization.channelsEnabled.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  className="rounded-full px-4 py-2 text-sm"
                  style={{
                    background: active ? "var(--color-primary)" : "var(--color-badge)",
                    color: active ? "var(--color-on-primary)" : "var(--color-on-badge)"
                  }}
                  onClick={() => {
                    setOrganization({
                      ...organization,
                      channelsEnabled: active
                        ? organization.channelsEnabled.filter((item) => item !== channel)
                        : [...organization.channelsEnabled, channel]
                    });
                  }}
                >
                  {channel}
                </button>
              );
            })}
          </div>
        </div>

        {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        <button className="btn-primary">Salvar organizacao</button>
      </form>

      <div className="grid gap-4 xl:grid-cols-2">
        {organization.branches.map((branch) => (
          <div key={branch.id} className="card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>{branch.code}</p>
                <h3 className="text-xl font-bold">{branch.name}</h3>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: branch.active ? "color-mix(in srgb, #16a34a 16%, white)" : "color-mix(in srgb, #991b1b 14%, white)" }}>
                {branch.active ? "Ativa" : "Inativa"}
              </span>
            </div>
            <p className="text-sm text-muted">{branch.city || "Cidade nao informada"} {branch.state ? `- ${branch.state}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {branch.channels.map((channel) => (
                <span key={channel} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--color-badge)" }}>
                  {channel}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
