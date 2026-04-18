import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { EmptyState, PageHeader } from "../components/common";
import { apiRequest } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAuth } from "../state/auth";

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type LoginSummary = {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  uniqueUsers: number;
  activeUsers: number;
};

type LoginByDay = {
  date: string;
  success: number;
  failure: number;
  total: number;
};

type LoginByUser = {
  userId: string | null;
  name: string;
  email: string | null;
  role: "ADMIN" | "OPERADOR" | "DESCONHECIDO";
  active: boolean | null;
  success: number;
  failure: number;
  total: number;
  lastLoginAt: string | null;
};

type RecentLogin = {
  id: string;
  action: "LOGIN_SUCCESS" | "LOGIN_FAILURE";
  createdAt: string;
  description?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "OPERADOR";
    active: boolean;
  } | null;
};

type LoginControlResponse = {
  summary: LoginSummary;
  byDay: LoginByDay[];
  byUser: LoginByUser[];
  recent: RecentLogin[];
};

type Period = "dia" | "semana" | "mes";
type Metric = "total" | "success" | "failure";
type Grouping = "day" | "user";
type ChartType = "bar" | "line";

const metricConfig: Record<Metric, { key: Metric; label: string; color: string }> = {
  total: { key: "total", label: "Total", color: "#0f766e" },
  success: { key: "success", label: "Sucessos", color: "#16a34a" },
  failure: { key: "failure", label: "Falhas", color: "#dc2626" }
};

export function LoginControlPage() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [data, setData] = useState<LoginControlResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [period, setPeriod] = useState<Period>("semana");
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [metric, setMetric] = useState<Metric>("total");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    apiRequest<UserOption[]>("/auth/users", { token })
      .then((rows) => {
        setUsers(rows.map((item) => ({ id: item.id, name: item.name, email: item.email })));
      })
      .catch(() => {
        setUsers([]);
      });
  }, [token, user?.role]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    const query = new URLSearchParams({
      period,
      limit: "80"
    });
    if (selectedUserId !== "all") {
      query.set("userId", selectedUserId);
    }

    setLoading(true);
    setError("");
    apiRequest<LoginControlResponse>(`/auth/login-control?${query.toString()}`, { token })
      .then((response) => {
        setData(response);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Falha ao carregar painel de logins.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [period, selectedUserId, token, user?.role]);

  const selectedMetric = metricConfig[metric];

  const chartData = useMemo(() => {
    if (!data) return [];
    if (grouping === "day") {
      return data.byDay.map((item) => ({
        label: formatDate(`${item.date}T00:00:00`),
        ...item
      }));
    }
    return data.byUser.slice(0, 12).map((item) => ({
      label: item.name,
      ...item
    }));
  }, [data, grouping]);

  if (user?.role !== "ADMIN") {
    return <EmptyState message="Apenas administradores podem visualizar o painel de logins." />;
  }

  const successRate = data?.summary.totalAttempts
    ? Math.round((data.summary.successCount / data.summary.totalAttempts) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Painel de logins"
        subtitle="Controle de acesso, falhas e comportamento de login por periodo e por usuario."
      />

      <div className="card grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Periodo</span>
          <select className="input" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            <option value="dia">Hoje</option>
            <option value="semana">Ultimos 7 dias</option>
            <option value="mes">Mes atual</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Usuario</span>
          <select className="input" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
            <option value="all">Todos</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Agrupamento</span>
          <select className="input" value={grouping} onChange={(event) => setGrouping(event.target.value as Grouping)}>
            <option value="day">Por dia</option>
            <option value="user">Por usuario</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Metrica</span>
          <select className="input" value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
            <option value="total">Total</option>
            <option value="success">Sucessos</option>
            <option value="failure">Falhas</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Grafico</span>
          <select className="input" value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
            <option value="bar">Barras</option>
            <option value="line">Linha</option>
          </select>
        </label>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-stone-600">Carregando painel...</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Tentativas" value={data?.summary.totalAttempts ?? 0} />
        <SummaryCard label="Sucessos" value={data?.summary.successCount ?? 0} />
        <SummaryCard label="Falhas" value={data?.summary.failureCount ?? 0} />
        <SummaryCard label="Usuarios unicos" value={data?.summary.uniqueUsers ?? 0} />
        <SummaryCard label="Taxa de sucesso" value={`${successRate}%`} />
      </div>

      <div className="card">
        <h3 className="mb-4 text-lg font-bold">
          Grafico ajustavel: {selectedMetric.label} {grouping === "day" ? "por dia" : "por usuario"}
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey={selectedMetric.key} fill={selectedMetric.color} name={selectedMetric.label} />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={selectedMetric.key}
                  stroke={selectedMetric.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={selectedMetric.label}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <h3 className="mb-4 text-lg font-bold">Top usuarios no periodo</h3>
          <table className="table-base">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Total</th>
                <th>Sucessos</th>
                <th>Falhas</th>
                <th>Ultimo login</th>
              </tr>
            </thead>
            <tbody>
              {(data?.byUser ?? []).slice(0, 10).map((item) => (
                <tr key={`${item.userId ?? "unknown"}-${item.name}`}>
                  <td>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-stone-500">{item.email ?? "sem e-mail"}</p>
                  </td>
                  <td>{item.total}</td>
                  <td>{item.success}</td>
                  <td>{item.failure}</td>
                  <td>{item.lastLoginAt ? formatDate(item.lastLoginAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-bold">Eventos recentes de login</h3>
          <div className="space-y-3">
            {(data?.recent ?? []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-stone-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className={item.action === "LOGIN_SUCCESS" ? "text-green-700" : "text-red-700"}>
                    {item.action === "LOGIN_SUCCESS" ? "Sucesso" : "Falha"}
                  </strong>
                  <span className="text-xs text-stone-500">{formatDate(item.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-stone-700">{item.user?.name ?? "Nao identificado"}</p>
                <p className="text-xs text-stone-500">{item.description ?? "Sem descricao."}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="text-sm text-stone-500">{label}</p>
      <h3 className="mt-3 text-2xl font-bold">{value}</h3>
    </div>
  );
}
