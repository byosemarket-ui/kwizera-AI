export interface ForexAdminOverview {
  documents: number;
  drafts: number;
  published: number;
  archived: number;
  indexed: number;
  indexing: number;
  stale: number;
  failed: number;
  notIndexed: number;
  categories: number;
  topics: number;
  chunks: number;
  recentUpdates: Array<{
    id: string;
    title: string;
    status: string;
    indexingStatus: string;
    updatedAt: string;
  }>;
}

export interface ForexAdminDocument {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  categoryId: string | null;
  topicId: string | null;
  tags: string[];
  knowledgeType: string;
  status: string;
  sourceType: string;
  sourceName: string;
  sourceReference: string;
  sourceUrl: string;
  language: string;
  version: number;
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  indexedAt: string | null;
  indexingStatus: string;
  indexingError: string | null;
}

export interface ForexAdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface ForexAdminTopic {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const forexAdminApi = {
  meta: () => request<{ ok: true; authentication: string; canonicalEntry: string }>("/api/forex-admin/meta"),
  overview: () => request<{ ok: true; overview: ForexAdminOverview }>("/api/forex-admin/overview"),
  categories: () => request<{ ok: true; categories: ForexAdminCategory[] }>("/api/forex-admin/categories"),
  createCategory: (body: { name: string; description?: string }) =>
    request<{ ok: true; category: ForexAdminCategory }>("/api/forex-admin/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  topics: (categoryId?: string) =>
    request<{ ok: true; topics: ForexAdminTopic[] }>(
      `/api/forex-admin/topics${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""}`,
    ),
  createTopic: (body: { categoryId: string; name: string; description?: string }) =>
    request<{ ok: true; topic: ForexAdminTopic }>("/api/forex-admin/topics", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listKnowledge: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") qs.set(key, String(value));
    }
    return request<{ ok: true; items: ForexAdminDocument[]; total: number; page: number; pageSize: number }>(
      `/api/forex-admin/knowledge?${qs.toString()}`,
    );
  },
  getKnowledge: (id: string) =>
    request<{ ok: true; document: ForexAdminDocument }>(`/api/forex-admin/knowledge/${encodeURIComponent(id)}`),
  createKnowledge: (body: Record<string, unknown>) =>
    request<{ ok: true; document: ForexAdminDocument }>("/api/forex-admin/knowledge", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateKnowledge: (id: string, body: Record<string, unknown>) =>
    request<{ ok: true; document: ForexAdminDocument }>(`/api/forex-admin/knowledge/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  publish: (id: string) =>
    request<{ ok: true; document: ForexAdminDocument }>(`/api/forex-admin/knowledge/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      body: "{}",
    }),
  unpublish: (id: string) =>
    request<{ ok: true; document: ForexAdminDocument }>(`/api/forex-admin/knowledge/${encodeURIComponent(id)}/unpublish`, {
      method: "POST",
      body: "{}",
    }),
  archive: (id: string) =>
    request<{ ok: true; document: ForexAdminDocument }>(`/api/forex-admin/knowledge/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      body: "{}",
    }),
  reindex: (id: string) =>
    request<{ ok: true; document: ForexAdminDocument }>(`/api/forex-admin/knowledge/${encodeURIComponent(id)}/reindex`, {
      method: "POST",
      body: "{}",
    }),
  retrieve: (body: { query: string; limit?: number }) =>
    request<{ ok: true; hits: Array<{ documentId: string; title: string; content: string; relevanceScore: number }>; count: number }>(
      "/api/forex-admin/knowledge/retrieve",
      { method: "POST", body: JSON.stringify(body) },
    ),
};

function memoryQs(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Phase 23 — Forex AI Memory / Journal / Learning (server-authoritative). */
export const forexAdminMemoryApi = {
  overview: () => request<{ ok: true; overview: Record<string, unknown> }>("/api/forex/memory/overview"),
  listAnalyses: (params: Record<string, string | number | undefined> = {}) =>
    request<{ ok: true; items: Array<Record<string, unknown>>; total: number }>(
      `/api/forex/memory/analysis${memoryQs(params)}`,
    ),
  getAnalysis: (id: string) =>
    request<{
      ok: true;
      analysis: Record<string, unknown>;
      outcomes: Array<Record<string, unknown>>;
      mistakes: Array<Record<string, unknown>>;
    }>(`/api/forex/memory/analysis/${encodeURIComponent(id)}`),
  listOutcomes: (params: Record<string, string | number | undefined> = {}) =>
    request<{ ok: true; items: Array<Record<string, unknown>>; total: number }>(
      `/api/forex/memory/outcomes${memoryQs(params)}`,
    ),
  listMistakes: (params: Record<string, string | number | undefined> = {}) =>
    request<{ ok: true; items: Array<Record<string, unknown>>; total: number }>(
      `/api/forex/memory/mistakes${memoryQs(params)}`,
    ),
  learning: () => request<{ ok: true; learning: Record<string, unknown> }>("/api/forex/memory/learning"),
  evaluate: (analysisId: string) =>
    request<{ ok: true; outcome: Record<string, unknown>; mistakes: Array<Record<string, unknown>> }>(
      "/api/forex/memory/evaluate",
      { method: "POST", body: JSON.stringify({ analysisId }) },
    ),
};

/** Phase 25 — Market-data providers (Binance + FXCM foundation). */
export const forexProvidersApi = {
  list: () =>
    request<{
      ok: true;
      generatedAt: string;
      providers: Array<{ info: Record<string, unknown>; health: Record<string, unknown> }>;
      note?: string;
    }>("/api/forex/providers"),
  fxcmStatus: () =>
    request<{
      ok: boolean;
      provider: Record<string, unknown>;
      health: Record<string, unknown>;
      capabilities: Record<string, boolean>;
      liveStream: string;
      trading: string;
    }>("/api/forex/providers/fxcm/status"),
  fxcmInstruments: (refresh = false) =>
    request<{
      ok: true;
      count: number;
      instruments: Array<Record<string, unknown>>;
      environmentLabel: string;
      note?: string;
    }>(`/api/forex/providers/fxcm/instruments${refresh ? "?refresh=1" : ""}`),
};

/** Phase 24 — Intelligence control center (config / diagnostics / health). */
export const forexIntelligenceApi = {
  health: (probe = true) =>
    request<{ ok: true; health: Record<string, unknown> }>(
      `/api/forex-admin/intelligence/health${probe ? "" : "?probe=0"}`,
    ),
  configuration: () =>
    request<{
      ok: true;
      readOnly: Record<string, unknown>;
      configurable: {
        knowledgeRagEnabled: boolean;
        memoryRetrievalEnabled: boolean;
        memoryMaxExamples: number;
        compactPromptMode: boolean;
        promptCharBudget: number;
      };
      audit: Array<Record<string, unknown>>;
      note: string;
    }>("/api/forex-admin/intelligence/configuration"),
  updateConfiguration: (body: Record<string, unknown>) =>
    request<{ ok: true; settings: Record<string, unknown>; changed: Array<Record<string, unknown>> }>(
      "/api/forex-admin/intelligence/configuration",
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  buildContext: (body: { symbol?: string; timeframes?: string[]; knowledgeQuery?: string }) =>
    request<{ ok: boolean; diagnostic: Record<string, unknown> }>(
      "/api/forex-admin/intelligence/build-context",
      { method: "POST", body: JSON.stringify(body) },
    ),
  testOllama: () =>
    request<{ ok: true; result: Record<string, unknown> }>(
      "/api/forex-admin/intelligence/test-ollama",
      { method: "POST", body: "{}" },
    ),
  rebuildLearning: () =>
    request<{ ok: true; learning: Record<string, unknown>; note: string }>(
      "/api/forex-admin/intelligence/rebuild-learning",
      { method: "POST", body: "{}" },
    ),
  memoryDiagnostics: () =>
    request<{ ok: true; diagnostics: Record<string, unknown> }>(
      "/api/forex-admin/intelligence/memory-diagnostics",
    ),
};
