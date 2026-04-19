import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAuth } from "../state/auth";

type Overview = {
  security: { jwtUsingDefaultSecret: boolean };
  paths: { storageDir: string; rtpgBaseDir: string; databaseFile: string };
  counts: {
    usersActive: number;
    usersTotal: number;
    barsTotal: number;
    barsActive: number;
    productsTotal: number;
    suppliesTotal: number;
    tablesTotal: number;
    salesLast30Days: number;
  };
  bars: Array<{
    id: string;
    name: string;
    code: string;
    city: string;
    active: boolean;
    products: number;
    supplies: number;
    tables: number;
    sales: number;
  }>;
  runtime: { port: number; node: string };
};

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  createdAt: string;
  user: { name: string; email: string; role: string } | null;
};

const shortcuts = [
  { to: "/usuarios", label: "Usuários e perfis", desc: "Criar, editar e desativar acessos" },
  { to: "/bares", label: "Bares e unidades", desc: "Cadastrar bares e alternar operação" },
  { to: "/organizacao", label: "Organização", desc: "Razão social, canais e filiais planejadas" },
  { to: "/configuracoes", label: "Configurações", desc: "Tema, marca e dados do estabelecimento" },
  { to: "/meu-gestor", label: "Meu Gestor (SaaS)", desc: "Carteira e visão do dono do produto" }
];

export function SystemControlPage() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const [ov, log] = await Promise.all([
          apiRequest<Overview>("/system/overview", { token }),
          apiRequest<AuditRow[]>("/system/audit-log?limit=120", { token })
        ]);
        if (!cancelled) {
          setOverview(ov);
          setAudit(log);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Falha ao carregar painel do sistema.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.role]);

  if (user?.role !== "ADMIN") {
    return <div className="card text-sm text-muted">Apenas administradores acessam o controle do sistema.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle do sistema"
        subtitle="Visão global da instalação, segurança, dados persistidos e auditoria. Atalhos para onde você define regras e cadastros mestres."
      />

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {overview?.security.jwtUsingDefaultSecret ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          role="status"
        >
          <strong className="font-semibold">Segurança:</strong> o servidor está usando o JWT secreto padrão de
          desenvolvimento. Para ambiente real, defina a variável de ambiente <code className="rounded bg-black/10 px-1">JWT_SECRET</code> com um valor forte antes de expor a rede.
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-bold">Atalhos de gestão</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="card block transition hover:opacity-95"
              style={{ border: "1px solid var(--color-border)" }}
            >
              <p className="font-semibold text-[var(--color-primary)]">{s.label}</p>
              <p className="mt-1 text-sm text-muted">{s.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {overview ? (
        <>
          <section>
            <h2 className="mb-3 text-lg font-bold">Resumo numérico</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Usuários ativos", value: overview.counts.usersActive, sub: `${overview.counts.usersTotal} cadastrados` },
                { label: "Bares", value: overview.counts.barsActive, sub: `${overview.counts.barsTotal} no total` },
                { label: "Produtos (todos os bares)", value: overview.counts.productsTotal, sub: `${overview.counts.suppliesTotal} insumos` },
                { label: "Vendas (30 dias)", value: overview.counts.salesLast30Days, sub: `${overview.counts.tablesTotal} mesas cadastradas` }
              ].map((c) => (
                <div key={c.label} className="card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.label}</p>
                  <p className="mt-2 text-3xl font-bold">{c.value}</p>
                  <p className="mt-1 text-sm text-muted">{c.sub}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold">Dados e ambiente</h2>
            <div className="card space-y-2 text-sm font-mono break-all">
              <p>
                <span className="text-muted">Pasta RTPG / dados:</span> {overview.paths.rtpgBaseDir}
              </p>
              <p>
                <span className="text-muted">Armazenamento (uploads, SQLite):</span> {overview.paths.storageDir}
              </p>
              <p>
                <span className="text-muted">Arquivo do banco:</span> {overview.paths.databaseFile}
              </p>
              <p className="text-muted">
                API na porta {overview.runtime.port} • {overview.runtime.node}
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold">Por bar</h2>
            <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[var(--color-surface-alt)] text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Bar</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3 text-right">Produtos</th>
                    <th className="px-4 py-3 text-right">Insumos</th>
                    <th className="px-4 py-3 text-right">Mesas</th>
                    <th className="px-4 py-3 text-right">Vendas (hist.)</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.bars.map((b) => (
                    <tr key={b.id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-3 font-medium">
                        {b.name}
                        {b.city ? <span className="block text-xs font-normal text-muted">{b.city}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-black/5 px-2 py-0.5 text-xs">{b.code}</code>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.products}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.supplies}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.tables}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.sales}</td>
                      <td className="px-4 py-3">{b.active ? "Ativo" : "Inativo"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : !error ? (
        <div className="card text-muted">Carregando visão do sistema...</div>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-bold">Auditoria recente</h2>
        <p className="mb-3 text-sm text-muted">
          Registro de ações relevantes (usuários, bares, produtos, etc.). Útil para conferir quem alterou o quê.
        </p>
        <div className="max-h-[480px] overflow-auto rounded-2xl border border-[var(--color-border)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 bg-[var(--color-surface-alt)] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Quem</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Entidade</th>
                <th className="px-3 py-2">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id} className="border-t border-[var(--color-border)] align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-2">
                    {row.user ? (
                      <>
                        {row.user.name}
                        <span className="block text-xs text-muted">{row.user.email}</span>
                      </>
                    ) : (
                      <span className="text-muted">Sistema</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.action}</td>
                  <td className="px-3 py-2">
                    {row.entityType}
                    {row.entityId ? (
                      <span className="block truncate text-xs text-muted" title={row.entityId}>
                        {row.entityId}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted">{row.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {audit.length === 0 && !error ? <p className="mt-2 text-sm text-muted">Nenhum evento registrado ainda.</p> : null}
      </section>
    </div>
  );
}
