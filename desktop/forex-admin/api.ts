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

export interface ForexConnectProfilePublic {
  environment: "demo" | "live";
  sdkEnvironment: "demo" | "real";
  label: "DEMO" | "LIVE";
  usernameConfigured: boolean;
  passwordConfigured: boolean;
  usernameHint: string | null;
  configured: boolean;
  lastAuthStatus: string | null;
  lastAuthAt: string | null;
  lastAuthError: string | null;
  lastInstrumentCount: number | null;
  lastInstrumentAt: string | null;
  lastConnectedAt: string | null;
}

export interface ForexConnectProfilesState {
  ok: true;
  vaultUnlocked: boolean;
  storageMode: "encrypted-vault" | "memory-only";
  persistenceWarning: string | null;
  preferredEnvironment: "demo" | "live";
  activeEnvironment: "demo" | "live" | null;
  activeSessionStatus: string | null;
  profiles: {
    demo: ForexConnectProfilePublic;
    live: ForexConnectProfilePublic;
  };
  note: string;
}

export interface ForexConnectProfileActionResult {
  ok: boolean;
  environment: "demo" | "live";
  label: "DEMO" | "LIVE";
  status: {
    status: string;
    instrumentCount?: number;
    errorMessage?: string | null;
    errorCode?: string | null;
    environmentLabel?: string;
    sdkAvailable?: boolean;
    sidecarReachable?: boolean;
  };
  profiles: ForexConnectProfilesState;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  error?: { code: string; message: string };
}

/** Shared with Admin Control Center — browser session only, never persisted to disk by us. */
export const FOREX_ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";

export function getForexAdminSessionToken(): string {
  try {
    return sessionStorage.getItem(FOREX_ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setForexAdminSessionToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) sessionStorage.setItem(FOREX_ADMIN_TOKEN_STORAGE_KEY, trimmed);
    else sessionStorage.removeItem(FOREX_ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearForexAdminSessionToken(): void {
  setForexAdminSessionToken("");
}

function forexAdminAuthHeaders(): Record<string, string> {
  const token = getForexAdminSessionToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "x-kwizera-admin-token": token,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...forexAdminAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    let msg = data?.error?.message
      || data?.confirmationMessage
      || `Request failed (${res.status})`;
    if (res.status === 403 && /Admin API token/i.test(String(msg))) {
      msg = "Admin API token required. Enter the server KWIZERA_ADMIN_API_TOKEN below (same session token as Admin Control Center → API Access).";
    }
    const err = new Error(msg) as Error & {
      status?: number;
      code?: string;
      payload?: unknown;
    };
    err.status = res.status;
    err.code = data?.error?.code;
    err.payload = data;
    throw err;
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

/** Phase 25–31 — Market-data providers (Binance + FXCM). */
export const forexProvidersApi = {
  list: () =>
    request<{
      ok: true;
      generatedAt: string;
      providers: Array<{ info: Record<string, unknown>; health: Record<string, unknown> }>;
      note?: string;
    }>("/api/forex/providers"),
  unifiedStatus: () =>
    request<{
      ok: true;
      phase: number;
      providers: Array<Record<string, unknown>>;
      note?: string;
    }>("/api/forex/market-data/status"),
  fxcmStatus: () =>
    request<{
      ok: boolean;
      provider: Record<string, unknown>;
      health: Record<string, unknown>;
      authentication?: Record<string, unknown>;
      capabilities: Record<string, boolean>;
      liveStream: string;
      trading: string;
      marketData?: string;
      note?: string;
    }>("/api/forex/providers/fxcm/status"),
  fxcmAuthenticate: () =>
    request<{
      ok: boolean;
      authentication: Record<string, unknown>;
      liveStream: string;
      trading: string;
      marketData: string;
      note?: string;
    }>("/api/forex/providers/fxcm/authenticate", {
      method: "POST",
      body: "{}",
    }),
  forexConnectStatus: () =>
    request<{
      ok: boolean;
      status: string;
      enabled: boolean;
      configured: boolean;
      environmentLabel?: string;
      environment?: string;
      sdkAvailable?: boolean;
      sidecarReachable?: boolean;
      instrumentCount?: number;
      connectedAt?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      sdkImportError?: string | null;
      note?: string;
      profiles?: ForexConnectProfilesState | null;
      runtimeProbe?: Record<string, unknown> | null;
    }>("/api/forex/providers/forexconnect/status"),
  forexConnectProfiles: () =>
    request<ForexConnectProfilesState>("/api/forex/providers/forexconnect/profiles"),
  forexConnectAuthCheck: () =>
    request<{ ok: boolean; authorized: boolean; note?: string }>(
      "/api/forex/providers/forexconnect/profiles/auth-check",
      { method: "POST", body: "{}" },
    ),
  forexConnectSaveCredentials: (body: {
    environment: "demo" | "live";
    username: string;
    password: string;
  }) =>
    request<{
      ok: boolean;
      profile: ForexConnectProfilePublic;
      profiles: ForexConnectProfilesState;
      storageMode?: string;
      note?: string;
    }>("/api/forex/providers/forexconnect/profiles/credentials", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  forexConnectClearCredentials: (body: { environment: "demo" | "live" }) =>
    request<{
      ok: boolean;
      profile: ForexConnectProfilePublic;
      profiles: ForexConnectProfilesState;
      note?: string;
    }>("/api/forex/providers/forexconnect/profiles/credentials/clear", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  forexConnectTestProfile: (body: {
    environment: "demo" | "live";
    confirmSwitch?: boolean;
  }) =>
    request<ForexConnectProfileActionResult>(
      "/api/forex/providers/forexconnect/profiles/test",
      { method: "POST", body: JSON.stringify(body) },
    ),
  forexConnectActivateProfile: (body: {
    environment: "demo" | "live";
    confirmSwitch?: boolean;
  }) =>
    request<ForexConnectProfileActionResult>(
      "/api/forex/providers/forexconnect/profiles/activate",
      { method: "POST", body: JSON.stringify(body) },
    ),
  forexConnectDiscoverProfile: (body: { environment: "demo" | "live" }) =>
    request<{
      ok: boolean;
      count: number;
      instruments: Array<Record<string, unknown>>;
      fetchedAt?: string | null;
      environment?: string;
      label?: string;
      error?: { code: string; message: string };
      profiles?: ForexConnectProfilesState;
    }>("/api/forex/providers/forexconnect/profiles/discover", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  forexConnectConnect: (body?: {
    environment?: "demo" | "live";
    confirmSwitch?: boolean;
  }) =>
    request<{
      ok: boolean;
      status: string;
      instrumentCount?: number;
      errorMessage?: string | null;
      errorCode?: string | null;
      requiresConfirmation?: boolean;
      confirmationMessage?: string;
    }>("/api/forex/providers/forexconnect/connect", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  forexConnectDisconnect: () =>
    request<{
      ok: boolean;
      status?: string;
    }>("/api/forex/providers/forexconnect/disconnect", {
      method: "POST",
      body: "{}",
    }),
  forexConnectInstruments: () =>
    request<{
      ok: boolean;
      count: number;
      instruments: Array<Record<string, unknown>>;
      fetchedAt?: string | null;
      note?: string;
    }>("/api/forex/providers/forexconnect/instruments"),
  forexConnectCandles: (params: {
    symbol: string;
    timeframe: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    q.set("symbol", params.symbol);
    q.set("timeframe", params.timeframe);
    if (params.limit != null) q.set("limit", String(params.limit));
    return request<{
      ok: boolean;
      count: number;
      candles: Array<Record<string, unknown>>;
      providerSymbol?: string;
      timeframe?: string;
      periodId?: string;
      priceBasis?: string;
      fetchedAt?: string | null;
      lastHistoricalAt?: string | null;
      note?: string;
      supportedTimeframes?: string[];
      error?: { code: string; message: string };
    }>(`/api/forex/providers/forexconnect/candles?${q.toString()}`);
  },
  forexConnectStreamStatus: () =>
    request<{
      ok: boolean;
      sessionStatus: string;
      streamState: string;
      offersListenerActive: boolean;
      subscriptionCount: number;
      subscriptions: string[];
      maxSubscriptions: number;
      lastQuoteAt: string | null;
      lastQuoteAgeMs: number | null;
      lastStreamError: string | null;
      updateCount: number;
      priceBasis?: string;
      note?: string;
    }>("/api/forex/providers/forexconnect/stream/status"),
  forexConnectSubscribe: (symbol: string) =>
    request<{
      ok: boolean;
      providerSymbol?: string;
      error?: { code: string; message: string };
    }>("/api/forex/providers/forexconnect/subscribe", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  forexConnectUnsubscribe: (symbol: string) =>
    request<{ ok: boolean }>("/api/forex/providers/forexconnect/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  forexConnectQuotes: () =>
    request<{
      ok: boolean;
      count: number;
      quotes: Array<Record<string, unknown>>;
    }>("/api/forex/providers/forexconnect/quotes"),
  fxcmHistorical: (params: {
    symbol: string;
    timeframe: string;
    start?: string;
    end?: string;
    limit?: number;
    refresh?: boolean;
  }) => {
    const q = new URLSearchParams();
    q.set("symbol", params.symbol);
    q.set("timeframe", params.timeframe);
    if (params.start) q.set("start", params.start);
    if (params.end) q.set("end", params.end);
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.refresh) q.set("refresh", "1");
    return request<{
      ok: boolean;
      provider: "FXCM";
      environmentLabel: string;
      marketType: string;
      symbol: string;
      canonicalSymbol: string;
      providerSymbol: string;
      displaySymbol: string;
      timeframe: string;
      providerPeriod: string;
      source: string;
      mode: string;
      fetchedAt: string;
      count: number;
      candles: Array<Record<string, unknown>>;
      quality: Record<string, unknown>;
      note?: string;
      errorCode?: string | null;
      errorMessage?: string | null;
    }>(`/api/forex/providers/fxcm/historical?${q.toString()}`);
  },
  fxcmStreamStatus: () =>
    request<{
      ok: boolean;
      provider: "FXCM";
      environment: string;
      environmentLabel: string;
      stream: Record<string, unknown>;
      subscriptions: Array<Record<string, unknown>>;
      quotes: Array<Record<string, unknown>>;
      authenticationState: string;
      marketData: string;
      liveStream: string;
      trading: string;
      mode: string;
      note?: string;
      errorCode?: string | null;
      errorMessage?: string | null;
    }>("/api/forex/providers/fxcm/stream/status"),
  fxcmQuotes: (symbol?: string) => {
    const q = new URLSearchParams();
    if (symbol) q.set("symbol", symbol);
    const qs = q.toString();
    return request<{
      ok: boolean;
      provider: "FXCM";
      streamState: string;
      count: number;
      quotes: Array<Record<string, unknown>>;
      mode: string;
      trading: string;
    }>(`/api/forex/providers/fxcm/quotes${qs ? `?${qs}` : ""}`);
  },
  fxcmStreamSubscribe: (symbol: string) =>
    request<{
      ok: boolean;
      provider: "FXCM";
      subscription: Record<string, unknown>;
      quote: Record<string, unknown> | null;
      streamState: string;
      mode: string;
      trading: string;
      note?: string;
    }>("/api/forex/providers/fxcm/stream/subscribe", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  fxcmStreamUnsubscribe: (symbol: string) =>
    request<{
      ok: boolean;
      provider: "FXCM";
      symbol: string;
      streamState: string;
      subscriptions: Array<Record<string, unknown>>;
      mode: string;
      trading: string;
    }>("/api/forex/providers/fxcm/stream/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  fxcmLiveCandlesSubscribe: (symbol: string, timeframe: string) =>
    request<{
      ok: boolean;
      provider: "FXCM";
      providerSymbol: string;
      timeframe: string;
      mode: string;
      live: boolean;
      streamState: string;
      count: number;
      candles: Array<Record<string, unknown>>;
      forming: Record<string, unknown> | null;
      quality: Record<string, unknown>;
      trading: string;
      note?: string;
    }>("/api/forex/providers/fxcm/candles/live/subscribe", {
      method: "POST",
      body: JSON.stringify({ symbol, timeframe }),
    }),
  fxcmLiveCandles: (symbol: string, timeframe: string) => {
    const q = new URLSearchParams({ symbol, timeframe });
    return request<{
      ok: boolean;
      provider: "FXCM";
      providerSymbol: string;
      timeframe: string;
      mode: string;
      live: boolean;
      streamState: string;
      count: number;
      candles: Array<Record<string, unknown>>;
      forming: Record<string, unknown> | null;
      quality: Record<string, unknown>;
      trading: string;
    }>(`/api/forex/providers/fxcm/candles/live?${q.toString()}`);
  },
  fxcmInstruments: (params?: {
    refresh?: boolean;
    marketType?: string;
    search?: string;
    status?: string;
    baseAsset?: string;
    quoteAsset?: string;
    mappingStatus?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.refresh) q.set("refresh", "1");
    if (params?.marketType) q.set("marketType", params.marketType);
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.baseAsset) q.set("baseAsset", params.baseAsset);
    if (params?.quoteAsset) q.set("quoteAsset", params.quoteAsset);
    if (params?.mappingStatus) q.set("mappingStatus", params.mappingStatus);
    const qs = q.toString();
    return request<{
      ok: boolean;
      provider: "FXCM";
      environment: string;
      environmentLabel: string;
      discoveryStatus: string;
      freshness: string;
      source: string;
      fetchedAt: string | null;
      count: number;
      instruments: Array<Record<string, unknown>>;
      conflicts: Array<Record<string, unknown>>;
      authenticationState: string;
      marketData: string;
      liveStream: string;
      trading: string;
      errorCode: string | null;
      errorMessage: string | null;
      note?: string;
    }>(`/api/forex/providers/fxcm/instruments${qs ? `?${qs}` : ""}`);
  },
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
