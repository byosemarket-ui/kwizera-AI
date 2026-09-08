import type {
  AdminDashboardSnapshot,
  AdminModelRecord,
  AdminProviderPublicView,
  FeatureMappingView,
  TypedSetting,
} from "./types";

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminApiError(
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : `Admin API failed (${response.status})`,
      response.status,
    );
  }
  return data as T;
}

export const adminApi = {
  dashboard: () => adminFetch<AdminDashboardSnapshot>("/api/admin/dashboard"),
  health: () => adminFetch<{ ok: boolean; initialized: boolean }>("/api/admin/health"),
  providers: () => adminFetch<{ items: AdminProviderPublicView[] }>("/api/admin/providers"),
  saveProvider: (body: Record<string, unknown>) =>
    adminFetch<AdminProviderPublicView>("/api/admin/providers", { method: "POST", body: JSON.stringify(body) }),
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
  settings: (category?: string) => {
    const suffix = category ? `?category=${encodeURIComponent(category)}` : "";
    return adminFetch<{ items: TypedSetting[] }>(`/api/admin/settings${suffix}`);
  },
  saveSetting: (key: string, value: unknown) =>
    adminFetch<TypedSetting>("/api/admin/settings", { method: "POST", body: JSON.stringify({ key, value }) }),
  usage: () => adminFetch<{ items: unknown[]; note?: string }>("/api/admin/usage"),
};
