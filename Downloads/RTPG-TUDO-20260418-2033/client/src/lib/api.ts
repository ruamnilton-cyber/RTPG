import { getStoredBarId } from "./bar-storage";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const API_BASE = "/api";

export async function apiRequest<T>(path: string, options?: { method?: HttpMethod; body?: unknown; token?: string | null }) {
  const barId = getStoredBarId();
  const response = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(barId ? { "X-Bar-Id": barId } : {})
    },
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const parsed = await response.json().catch(() => null) as { message?: string; issues?: { message: string }[] } | null;
    const detail = parsed?.issues?.[0]?.message ?? parsed?.message;
    throw new Error(detail ?? `Erro na requisição (${response.status}).`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
