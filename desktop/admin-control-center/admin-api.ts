import type {
  AdminDashboardSnapshot,
  AdminModelRecord,
  AdminProviderPublicView,
  FeatureMappingView,
  TypedSetting,
} from "./types";

const ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getStoredAdminToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setStoredAdminToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
    else sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearStoredAdminToken(): void {
  setStoredAdminToken("");
}

function adminAuthHeaders(): Record<string, string> {
  const token = getStoredAdminToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "x-kwizera-admin-token": token,
  };
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...adminAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const payload = data as { error?: string | { message?: string }; message?: string };
    const message = typeof payload.error === "string"
      ? payload.error
      : payload.error?.message || payload.message || `Admin API failed (${response.status})`;
    throw new AdminApiError(message, response.status);
  }
  return data as T;
}

export const adminApi = {
  dashboard: () => adminFetch<AdminDashboardSnapshot>("/api/admin/dashboard"),
  health: () => adminFetch<{
    ok: boolean;
    initialized: boolean;
    providers?: number;
    models?: number;
    features?: number;
    settings?: number;
  }>("/api/admin/health"),
  providers: () => adminFetch<{
    items: AdminProviderPublicView[];
    credentialVault?: { attached: boolean; unlocked: boolean };
  }>("/api/admin/providers"),
  saveProvider: (body: Record<string, unknown>) =>
    adminFetch<AdminProviderPublicView>("/api/admin/providers", { method: "POST", body: JSON.stringify(body) }),
  setProviderCredential: (id: string, secret: string, options?: { enable?: boolean }) =>
    adminFetch<AdminProviderPublicView>(`/api/admin/providers/${encodeURIComponent(id)}/credential`, {
      method: "POST",
      body: JSON.stringify({ secret, enable: options?.enable }),
    }),
  testProviderHealth: (id: string) =>
    adminFetch<{
      providerId: string;
      code: string;
      healthStatus: string;
      detail?: string;
      durationMs: number;
      requestId: string;
      httpStatus?: number;
      endpointHost?: string;
    }>(`/api/admin/providers/${encodeURIComponent(id)}/health`, { method: "POST", body: "{}" }),
  models: (params?: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "") continue;
        qs.set(key, String(value));
      }
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    return adminFetch<{ items: AdminModelRecord[]; total: number; page: number; pageSize: number }>(`/api/admin/models${suffix}`);
  },
  saveModel: (body: Record<string, unknown>) =>
    adminFetch<AdminModelRecord>("/api/admin/models", { method: "POST", body: JSON.stringify(body) }),
  setModelEnabled: (id: string, enabled: boolean) =>
    adminFetch<AdminModelRecord>(`/api/admin/models/${encodeURIComponent(id)}/enabled`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  features: () => adminFetch<{ items: FeatureMappingView[] }>("/api/admin/features"),
  saveFeature: (body: Record<string, unknown>) =>
    adminFetch("/api/admin/features", { method: "POST", body: JSON.stringify(body) }),
  resolveFeature: (feature: string) =>
    adminFetch<{
      ok: boolean;
      feature: string;
      status: string;
      selectedModelId: string | null;
      providerId: string | null;
      source: string;
      reason?: string;
    }>(`/api/admin/features/resolve/${encodeURIComponent(feature)}`),
  describeRuntime: (feature = "ONLINE_API_PROBE") =>
    adminFetch<Record<string, unknown>>(`/api/admin/runtime/describe?feature=${encodeURIComponent(feature)}`),
  executeRuntimeProbe: (body?: { prompt?: string }) =>
    adminFetch<Record<string, unknown>>("/api/admin/runtime/execute", {
      method: "POST",
      body: JSON.stringify({ feature: "ONLINE_API_PROBE", ...(body ?? {}) }),
    }),
  settings: (category?: string) => {
    const suffix = category ? `?category=${encodeURIComponent(category)}` : "";
    return adminFetch<{ items: TypedSetting[] }>(`/api/admin/settings${suffix}`);
  },
  saveSetting: (key: string, value: unknown) =>
    adminFetch<TypedSetting>("/api/admin/settings", { method: "POST", body: JSON.stringify({ key, value }) }),
  usage: () => adminFetch<{ items: unknown[]; note?: string }>("/api/admin/usage"),
};
