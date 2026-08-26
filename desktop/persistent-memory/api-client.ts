/**
 * Phase 7 Step 2 — client for /api/persistent-memory* (local disk via existing engines).
 */

export type StudioMemoryKind =
  | "PROJECT_MEMORY"
  | "PRODUCTION_MEMORY"
  | "USER_PREFERENCE"
  | "AI_DECISION"
  | "AI_CORRECTION"
  | "AI_LEARNING"
  | "WORKFLOW_MEMORY"
  | "CREATIVE_MEMORY"
  | "MARKETING_MEMORY"
  | "SYSTEM_MEMORY"
  | "KNOWLEDGE_REFERENCE";

export interface PersistentMemoryHealth {
  ready: boolean;
  memory: string;
  knowledge: string;
  database: string;
  backup: string;
  storageRoot: string;
  memoryRoot: string;
  knowledgeRoot: string;
  memoryCount: number;
  knowledgeCount: number;
  lastBackupId: string | null;
  issues: string[];
  offlineCapable: boolean;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Request failed ${res.status}`);
  }
  return body as T;
}

export const persistentMemoryApi = {
  health: () => api<PersistentMemoryHealth>("/api/persistent-memory/health"),
  searchMemory: (params: { q?: string; kind?: StudioMemoryKind; projectId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.kind) qs.set("kind", params.kind);
    if (params.projectId) qs.set("projectId", params.projectId);
    if (params.limit) qs.set("limit", String(params.limit));
    return api<{ records: unknown[]; count: number }>(`/api/persistent-memory/search?${qs}`);
  },
  saveMemory: (body: Record<string, unknown>) =>
    api<Record<string, unknown>>("/api/persistent-memory/save", { method: "POST", body: JSON.stringify(body) }),
  searchKnowledge: (params: { q?: string; topic?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.topic) qs.set("topic", params.topic);
    if (params.limit) qs.set("limit", String(params.limit));
    return api<{ records: unknown[]; count: number }>(`/api/persistent-knowledge/search?${qs}`);
  },
  saveKnowledge: (body: Record<string, unknown>) =>
    api<Record<string, unknown>>("/api/persistent-knowledge/save", { method: "POST", body: JSON.stringify(body) }),
  buildContext: (body: { projectId?: string; task?: string; limit?: number }) =>
    api<Record<string, unknown>>("/api/persistent-memory/context", { method: "POST", body: JSON.stringify(body) }),
  createBackup: () => api<{ ok: boolean; backupId: string; path: string }>("/api/persistent-memory/backup", { method: "POST", body: "{}" }),
  listBackups: () => api<{ backups: Array<{ backupId: string; createdAt: string }> }>("/api/persistent-memory/backups"),
  restoreBackup: (backupId: string, confirm: boolean) =>
    api<{ ok: boolean; error?: string; safetyCopy?: string }>("/api/persistent-memory/restore", {
      method: "POST",
      body: JSON.stringify({ backupId, confirm }),
    }),
  checkpoint: (label: string, data: Record<string, unknown>) =>
    api<{ ok: boolean; path: string }>("/api/persistent-memory/checkpoint", {
      method: "POST",
      body: JSON.stringify({ label, data }),
    }),
  listCheckpoints: () =>
    api<{ checkpoints: Array<{ id: string; label: string; createdAt: string }> }>("/api/persistent-memory/checkpoints"),
};

export interface OnlineKnowledgeStatus {
  ready: boolean;
  phase: string;
  network: {
    state: string;
    internetAvailable: boolean;
    latencyMs: number | null;
    checkedAt: string;
    detail: string;
    mode: string;
  };
  localKnowledge: { ready: boolean; knowledgeCount: number; memoryCount: number };
  historyCount: number;
  refreshQueueLength: number;
  lastError: string | null;
  offlineCapable: boolean;
  modelTraining: boolean;
  note: string;
}

export const onlineKnowledgeApi = {
  status: () => api<OnlineKnowledgeStatus>("/api/online-knowledge/status"),
  network: () => api<OnlineKnowledgeStatus["network"]>("/api/online-knowledge/network"),
  history: () => api<{ history: Array<Record<string, unknown>> }>("/api/online-knowledge/history"),
  research: (body: {
    query: string;
    topic?: string;
    domain?: string;
    persist?: boolean;
    maxSources?: number;
  }) =>
    api<Record<string, unknown>>("/api/online-knowledge/research", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  retrieveLocal: (query: string, limit = 10) =>
    api<{ records: unknown[]; count: number; mode: string }>("/api/online-knowledge/retrieve-local", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    }),
  enqueueRefresh: (knowledgeId: string, topic: string) =>
    api<{ ok: boolean }>("/api/online-knowledge/refresh-queue", {
      method: "POST",
      body: JSON.stringify({ knowledgeId, topic }),
    }),
};
