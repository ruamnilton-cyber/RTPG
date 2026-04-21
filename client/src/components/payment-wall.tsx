import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useAuth } from "../state/auth";

type CheckoutResponse = {
  accessStatus: string;
  blocked: boolean;
  configMissing?: boolean;
  clientId?: string;
  businessName?: string;
  planName?: string;
  monthlyFee?: number;
  externalId?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
};

const POLL_INTERVALS = [4000, 6000, 10000, 15000, 20000];

export function PaymentWall({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuth();
  const [status, setStatus] = useState<CheckoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIndexRef = useRef(0);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiRequest<CheckoutResponse>("/saas-billing/checkout", { token })
      .then(setStatus)
      .catch(() => {
        setCheckoutError(true);
        setStatus({ accessStatus: "LIBERADO", blocked: false });
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!status?.blocked || !status.externalId) return;
    pollIndexRef.current = 0;

    function schedulePoll() {
      const delay = POLL_INTERVALS[Math.min(pollIndexRef.current, POLL_INTERVALS.length - 1)];
      pollRef.current = setTimeout(async () => {
        try {
          const r = await apiRequest<{ paid: boolean }>(
            `/saas-billing/check/${status!.externalId}`,
            { token: token! }
          );
          if (r.paid) {
            setPaid(true);
            setTimeout(() => window.location.reload(), 2500);
            return;
          }
        } catch (_) {}
        pollIndexRef.current++;
        schedulePoll();
      }, delay);
    }

    schedulePoll();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [status, token]);

  if (loading || !status?.blocked) return <>{children}</>;

  if (paid) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-50">
        <div className="mb-4 text-5xl">âœ…</div>
        <p className="text-xl font-bold text-green-700">Pagamento confirmado!</p>
        <p className="mt-1 text-base text-green-600">Sistema reativado</p>
        <p className="mt-2 text-sm text-green-500">Recarregando...</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{ background: "var(--color-background)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8 text-center shadow-xl"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="mb-3 text-4xl">ðŸ”’</div>
        <h2 className="mb-1 text-xl font-bold" style={{ color: "var(--color-foreground)" }}>
          Acesso suspenso
        </h2>
        <p className="mb-1 text-base font-semibold" style={{ color: "var(--color-foreground)" }}>
          Mensalidade em aberto
        </p>
        <p className="mb-5 text-sm text-muted">
          {status.businessName} {status.planName ? `Â· ${status.planName}` : ""}
        </p>

        {checkoutError ? (
          <p className="text-sm text-red-500">
            Erro ao carregar informaÃ§Ãµes de pagamento. Tente recarregar a pÃ¡gina.
          </p>
        ) : status.configMissing ? (
          <p className="text-sm text-red-500">
            Entre em contato com o suporte para regularizar sua conta.
          </p>
        ) : status.pixQrCodeBase64 ? (
          <>
            <p className="mb-4 text-sm text-muted">
              Pague{" "}
              <strong style={{ color: "var(--color-foreground)" }}>
                {formatMoney(status.monthlyFee ?? 0)}
              </strong>{" "}
              via PIX para reativar:
            </p>
            <img
              src={`data:image/png;base64,${status.pixQrCodeBase64}`}
              alt="QR Code PIX"
              className="mx-auto mb-4 h-52 w-52 rounded-xl"
            />
            {status.pixQrCode && (
              <button
                type="button"
                className="btn-secondary mb-4 w-full text-sm"
                onClick={() => {
                  navigator.clipboard.writeText(status.pixQrCode!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
              >
                {copied ? "âœ… Copiado!" : "Copiar cÃ³digo PIX"}
              </button>
            )}
            <p className="text-xs text-muted">
              ApÃ³s o pagamento o acesso volta automaticamente.
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50" />
            <p className="text-sm text-muted">Gerando cobranÃ§a, aguarde...</p>
          </div>
        )}

        <button
          type="button"
          className="mt-6 text-xs text-muted underline"
          onClick={logout}
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}
