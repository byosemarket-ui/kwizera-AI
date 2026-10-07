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
