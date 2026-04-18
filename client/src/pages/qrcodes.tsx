import { useEffect, useState } from "react";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";

type QrTable = { id: string; number: number; name: string; url: string; imageDataUrl: string; logoUrl: string | null };

export function QrCodesPage() {
  const { token } = useAuth();
  const [tables, setTables] = useState<QrTable[]>([]);

  useEffect(() => {
    apiRequest<QrTable[]>("/operations/qr-codes", { token }).then(setTables);
  }, [token]);

  return (
    <div className="space-y-5">
      <PageHeader title="QR Codes das mesas" subtitle="QR Code com identidade visual, pronto para visualização e impressão do chamado do garçom." />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {tables.map((table) => (
          <div key={table.id} className="card text-center">
            <h3 className="text-lg font-bold">Mesa {table.number}</h3>
            <p className="mb-4 text-sm text-muted">{table.name}</p>
            <div className="relative mx-auto h-52 w-52 rounded-3xl bg-white p-4">
              <img src={table.imageDataUrl} alt={`QR Code mesa ${table.number}`} className="h-full w-full object-contain" />
              {table.logoUrl ? (
                <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
                  <img src={table.logoUrl} alt="Logo central do QR Code" className="h-full w-full rounded-xl object-contain" />
                </div>
              ) : null}
            </div>
            <a className="mt-4 block text-xs underline" style={{ color: "var(--color-primary)" }} href={table.url} target="_blank" rel="noreferrer">{table.url}</a>
          </div>
        ))}
      </div>
    </div>
  );
}
