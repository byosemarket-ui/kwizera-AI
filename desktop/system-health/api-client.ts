/**
 * Phase 7 Step 4 — System Health client (local API only).
 */

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed ${res.status}`);
  return body as T;
}

export const systemHealthApi = {
  health: () => api<Record<string, unknown>>("/api/system-health"),
  full: () => api<Record<string, unknown>>("/api/system-health/full"),
  selfTest: () => api<{ checks: Array<{ id: string; ok: boolean; detail: string }>; passed: number; total: number }>(
    "/api/system-health/self-test",
    { method: "POST", body: "{}" },
  ),
  services: () => api<{ services: Array<Record<string, unknown>> }>("/api/system-health/services"),
  repair: (body: { action: string; component?: string; problem?: string }) =>
    api<Record<string, unknown>>("/api/system-health/repair", { method: "POST", body: JSON.stringify(body) }),
  repairs: () => api<{ repairs: Array<Record<string, unknown>> }>("/api/system-health/repairs"),
  diagnostic: () => api<{ ok: boolean; path: string }>("/api/system-health/diagnostic", { method: "POST", body: "{}" }),
  supportBundle: () => api<Record<string, unknown>>("/api/system-health/support-bundle", { method: "POST", body: "{}" }),
  update: () => api<Record<string, unknown>>("/api/system-health/update"),
  updateCheck: (body: Record<string, unknown>) =>
    api<Record<string, unknown>>("/api/system-health/update/check", { method: "POST", body: JSON.stringify(body) }),
  updateBackup: () => api<{ ok: boolean; backupId?: string; error?: string }>("/api/system-health/update/backup", { method: "POST", body: "{}" }),
  rollback: () => api<Record<string, unknown>>("/api/system-health/update/rollback", { method: "POST", body: "{}" }),
  session: () => api<{ interrupted: boolean; markerAt: string | null }>("/api/system-health/session"),
  ackSession: () => api<{ ok: boolean }>("/api/system-health/session/ack", { method: "POST", body: "{}" }),
  certification: async () => {
    const res = await fetch("/api/system-health/certification");
    const body = await res.json().catch(() => ({}));
    return body as {
      ok?: boolean;
      error?: string;
      verdict?: string;
      version?: string;
      generatedAt?: string;
      counts?: Record<string, number>;
      results?: Array<{ id: string; name: string; expected: string; actual: string; status: string }>;
    };
  },
};
