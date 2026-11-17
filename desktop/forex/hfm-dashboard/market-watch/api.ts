/**
 * HFM Market Watch API client (STEP 3A summary + STEP 3B instruments/quotes/subscriptions).
 * Authenticated via Forex admin token. Failures stay explicit (no substitute data).
 */

import {
  buildForexAdminHeaders,
  getForexAdminToken,
} from "../../admin-access/forex-admin-token";
import {
  HFM_CATALOG_CATEGORIES,
  type HfmCatalogCategory,
  type HfmCatalogInstrument,
} from "../../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmCanonicalQuote, HfmQuoteServiceSnapshot } from "../../../../ai/market-data/mt5-hfm/quote-types";
import type { HfmSubscriptionRecord } from "../../../../ai/market-data/mt5-hfm/subscription-types";
import type { HfmMwCatalogSummary, HfmMwCategoryCount } from "./types";

const SYMBOLS = "/api/forex/providers/mt5-hfm/symbols";
const SYMBOLS_STATUS = "/api/forex/providers/mt5-hfm/symbols/status";
const SYMBOLS_CATEGORIES = "/api/forex/providers/mt5-hfm/symbols/categories";
const QUOTES = "/api/forex/providers/mt5-hfm/quotes";
const SUBSCRIPTIONS = "/api/forex/providers/mt5-hfm/subscriptions";

export type HfmMwApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_REJECTED"
  | "HTTP_ERROR"
  | "PROVIDER_MISMATCH"
  | "UNAVAILABLE"
  | "NETWORK";

export class HfmMwApiError extends Error {
  readonly code: HfmMwApiErrorCode;
  readonly httpStatus: number | null;

  constructor(code: HfmMwApiErrorCode, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = "HfmMwApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function assertHfmDemoIdentity(body: { provider?: unknown; environment?: unknown }): void {
  if (body.provider != null && body.provider !== "HFM_MT5") {
    throw new HfmMwApiError("PROVIDER_MISMATCH", `Unexpected provider: ${String(body.provider)}`);
  }
  if (body.environment != null && body.environment !== "demo") {
    throw new HfmMwApiError("PROVIDER_MISMATCH", `Unexpected environment: ${String(body.environment)}`);
  }
}

async function hfmRequestJson<T>(
  path: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<{ status: number; body: T }> {
  if (!getForexAdminToken()) {
    throw new HfmMwApiError("AUTH_REQUIRED", "Admin API token required for HFM Market Watch.");
  }
  const method = init?.method ?? "GET";
  const headers = buildForexAdminHeaders(path, {
    includeJsonContentType: init?.body !== undefined,
  });
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      cache: "no-store",
      signal: init?.signal,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    if (init?.signal?.aborted) throw err;
    throw new HfmMwApiError(
      "NETWORK",
      err instanceof Error ? err.message : "Network error contacting HFM API",
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new HfmMwApiError("AUTH_REJECTED", "Admin token rejected for HFM API.", res.status);
  }
  let body: T;
  try {
    body = (await res.json()) as T;
  } catch {
    throw new HfmMwApiError("HTTP_ERROR", `Invalid JSON from ${path}`, res.status);
  }
  return { status: res.status, body };
}

function normalizeCategoryCounts(
  rows: Array<{ category?: unknown; count?: unknown }> | null | undefined,
  fallback: Partial<Record<HfmCatalogCategory, number>> | null | undefined,
): HfmMwCategoryCount[] {
  const map = new Map<HfmCatalogCategory, number>();
  for (const name of HFM_CATALOG_CATEGORIES) map.set(name, 0);

  if (Array.isArray(rows)) {
    for (const row of rows) {
      const cat = typeof row.category === "string" ? row.category.toUpperCase() : "";
      const normalized = cat === "ENERGY" ? "ENERGIES" : cat;
      if ((HFM_CATALOG_CATEGORIES as readonly string[]).includes(normalized)) {
        const n = typeof row.count === "number" && Number.isFinite(row.count) ? row.count : 0;
        map.set(normalized as HfmCatalogCategory, n);
      }
    }
  } else if (fallback && typeof fallback === "object") {
    for (const name of HFM_CATALOG_CATEGORIES) {
      const n = fallback[name];
      if (typeof n === "number" && Number.isFinite(n)) map.set(name, n);
    }
  }

  return HFM_CATALOG_CATEGORIES.map((category) => ({
    category,
    count: map.get(category) ?? 0,
  }));
}

function sumCategoryCounts(categories: HfmMwCategoryCount[]): number {
  return categories.reduce((acc, row) => acc + (Number.isFinite(row.count) ? row.count : 0), 0);
}

export async function fetchHfmMarketWatchCatalog(
  signal?: AbortSignal,
): Promise<HfmMwCatalogSummary> {
  const [statusRes, catsRes] = await Promise.all([
    hfmRequestJson<{
      ok?: boolean;
      provider?: string;
      environment?: string;
      status?: {
        available?: boolean;
        discoveryStatus?: string;
        freshness?: string;
        brokerServer?: string | null;
        catalogVersion?: string | null;
        enumeratedCount?: number | null;
        validCount?: number | null;
        generalSymbolCount?: number | null;
        categoryCounts?: Partial<Record<HfmCatalogCategory, number>>;
        unavailableReason?: string | null;
        ingestedAt?: string | null;
        lastSuccessfulDiscoveryAt?: string | null;
      };
    }>(`${SYMBOLS_STATUS}?probe=0`, { signal }),
    hfmRequestJson<{
      ok?: boolean;
      provider?: string;
      environment?: string;
      catalogVersion?: string | null;
      categories?: Array<{ category?: string; count?: number }>;
      unavailableReason?: string | null;
    }>(SYMBOLS_CATEGORIES, { signal }),
  ]);

  assertHfmDemoIdentity(statusRes.body);
  assertHfmDemoIdentity(catsRes.body);

  const status = statusRes.body.status;
  const categories = normalizeCategoryCounts(
    catsRes.body.categories,
    status?.categoryCounts ?? null,
  );
  const fromCategories = sumCategoryCounts(categories);
  const enumerated =
    typeof status?.enumeratedCount === "number" && Number.isFinite(status.enumeratedCount)
      ? status.enumeratedCount
      : null;
  const valid =
    typeof status?.validCount === "number" && Number.isFinite(status.validCount)
      ? status.validCount
      : null;

  const catsOk = catsRes.status < 500 && catsRes.body.ok === true;
  const statusOk = statusRes.status < 500 && (status?.available === true || statusRes.body.ok === true);
  const available = Boolean(catsOk || statusOk);

  let totalInstruments: number | null = null;
  if (catsOk && fromCategories > 0) totalInstruments = fromCategories;
  else if (enumerated != null) totalInstruments = enumerated;
  else if (valid != null) totalInstruments = valid;
  else if (catsOk) totalInstruments = fromCategories;

  if (!available) {
    return {
      available: false,
      totalInstruments: null,
      catalogVersion: status?.catalogVersion ?? catsRes.body.catalogVersion ?? null,
      brokerServer: status?.brokerServer ?? null,
      freshness: status?.freshness ?? null,
      discoveryStatus: status?.discoveryStatus ?? null,
      categories,
      unavailableReason:
        status?.unavailableReason ??
        catsRes.body.unavailableReason ??
        `Catalog unavailable (status HTTP ${statusRes.status}, categories HTTP ${catsRes.status})`,
      ingestedAt: status?.ingestedAt ?? status?.lastSuccessfulDiscoveryAt ?? null,
    };
  }

  return {
    available: true,
    totalInstruments,
    catalogVersion: status?.catalogVersion ?? catsRes.body.catalogVersion ?? null,
    brokerServer: status?.brokerServer ?? null,
    freshness: status?.freshness ?? null,
    discoveryStatus: status?.discoveryStatus ?? null,
    categories,
    unavailableReason: null,
    ingestedAt: status?.ingestedAt ?? status?.lastSuccessfulDiscoveryAt ?? null,
  };
}

export type HfmMwSymbolsQuery = {
  q?: string;
  category?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
};

export type HfmMwSymbolsPage = {
  available: boolean;
  total: number;
  offset: number;
  limit: number;
  returned: number;
  symbols: HfmCatalogInstrument[];
  catalogVersion: string | null;
  freshness: string | null;
  unavailableReason: string | null;
};

export async function fetchHfmSymbolsPage(query: HfmMwSymbolsQuery = {}): Promise<HfmMwSymbolsPage> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category && query.category !== "ALL") params.set("category", query.category);
  params.set("offset", String(query.offset ?? 0));
  params.set("limit", String(query.limit ?? 200));
  const path = `${SYMBOLS}?${params.toString()}`;
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    freshness?: string;
    catalogVersion?: string | null;
    total?: number;
    offset?: number;
    limit?: number;
    returned?: number;
    symbols?: HfmCatalogInstrument[];
    unavailableReason?: string | null;
  }>(path, { signal: query.signal });
  assertHfmDemoIdentity(res.body);
  const available = res.status < 500 && res.body.ok === true;
  return {
    available,
    total: typeof res.body.total === "number" ? res.body.total : 0,
    offset: typeof res.body.offset === "number" ? res.body.offset : query.offset ?? 0,
    limit: typeof res.body.limit === "number" ? res.body.limit : query.limit ?? 200,
    returned: typeof res.body.returned === "number" ? res.body.returned : (res.body.symbols?.length ?? 0),
    symbols: Array.isArray(res.body.symbols) ? res.body.symbols : [],
    catalogVersion: res.body.catalogVersion ?? null,
    freshness: res.body.freshness ?? null,
    unavailableReason: available ? null : res.body.unavailableReason ?? `Symbols unavailable (HTTP ${res.status})`,
  };
}

/** Load full HFM catalog via offset pages (API max limit 200). */
export async function fetchHfmAllSymbols(opts?: {
  signal?: AbortSignal;
  category?: string;
  q?: string;
}): Promise<{ available: boolean; total: number; symbols: HfmCatalogInstrument[]; unavailableReason: string | null }> {
  const pageSize = 200;
  const first = await fetchHfmSymbolsPage({
    offset: 0,
    limit: pageSize,
    category: opts?.category,
    q: opts?.q,
    signal: opts?.signal,
  });
  if (!first.available) {
    return {
      available: false,
      total: 0,
      symbols: [],
      unavailableReason: first.unavailableReason,
    };
  }
  const out = [...first.symbols];
  let offset = first.returned;
  const total = first.total;
  while (offset < total) {
    if (opts?.signal?.aborted) break;
    const page = await fetchHfmSymbolsPage({
      offset,
      limit: pageSize,
      category: opts?.category,
      q: opts?.q,
      signal: opts?.signal,
    });
    if (!page.available) break;
    out.push(...page.symbols);
    if (page.returned <= 0) break;
    offset += page.returned;
    if (offset > 5000) break;
  }
  return { available: true, total, symbols: out, unavailableReason: null };
}

export async function fetchHfmSymbolDetail(
  symbol: string,
  signal?: AbortSignal,
): Promise<HfmCatalogInstrument | null> {
  const path = `${SYMBOLS}/${encodeURIComponent(symbol)}`;
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    symbol?: HfmCatalogInstrument;
    error?: { code?: string; message?: string };
  }>(path, { signal });
  if (res.status === 404) return null;
  assertHfmDemoIdentity(res.body);
  return res.body.symbol ?? null;
}

export async function fetchHfmQuotesSnapshot(signal?: AbortSignal): Promise<{
  available: boolean;
  snapshot: HfmQuoteServiceSnapshot | null;
  quotesBySymbol: Record<string, HfmCanonicalQuote>;
}> {
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    snapshot?: HfmQuoteServiceSnapshot;
  }>(QUOTES, { signal });
  assertHfmDemoIdentity(res.body);
  const snapshot = res.body.snapshot ?? null;
  const quotesBySymbol: Record<string, HfmCanonicalQuote> = {};
  for (const q of snapshot?.quotes ?? []) {
    if (q?.symbol) quotesBySymbol[q.symbol] = q;
  }
  return {
    available: res.status < 500 && res.body.ok === true,
    snapshot,
    quotesBySymbol,
  };
}

export async function fetchHfmQuote(
  symbol: string,
  signal?: AbortSignal,
): Promise<HfmCanonicalQuote | null> {
  const path = `${QUOTES}/${encodeURIComponent(symbol)}`;
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    quote?: HfmCanonicalQuote | null;
  }>(path, { signal });
  if (res.status === 404) return null;
  assertHfmDemoIdentity(res.body);
  return res.body.quote ?? null;
}

export type HfmMwSubscriptionsView = {
  available: boolean;
  capacity: {
    maxActive?: number;
    active?: number;
    paused?: number;
    pending?: number;
    failed?: number;
    recovering?: number;
    utilization?: number;
  } | null;
  subscriptions: HfmSubscriptionRecord[];
  bySymbol: Record<string, HfmSubscriptionRecord>;
};

export async function fetchHfmSubscriptions(signal?: AbortSignal): Promise<HfmMwSubscriptionsView> {
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    capacity?: HfmMwSubscriptionsView["capacity"];
    subscriptions?: HfmSubscriptionRecord[];
  }>(SUBSCRIPTIONS, { signal });
  assertHfmDemoIdentity(res.body);
  const subscriptions = Array.isArray(res.body.subscriptions) ? res.body.subscriptions : [];
  const bySymbol: Record<string, HfmSubscriptionRecord> = {};
  for (const row of subscriptions) {
    if (row?.symbol) bySymbol[row.symbol] = row;
  }
  return {
    available: res.status < 500 && res.body.ok === true,
    capacity: res.body.capacity ?? null,
    subscriptions,
    bySymbol,
  };
}

export async function subscribeHfmSymbols(symbols: string[]): Promise<{
  ok: boolean;
  accepted: unknown;
  rejected: unknown;
  capacity: unknown;
}> {
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    accepted?: unknown;
    rejected?: unknown;
    capacity?: unknown;
  }>(SUBSCRIPTIONS, { method: "POST", body: { symbols } });
  assertHfmDemoIdentity(res.body);
  return {
    ok: Boolean(res.body.ok),
    accepted: res.body.accepted,
    rejected: res.body.rejected,
    capacity: res.body.capacity,
  };
}

export async function unsubscribeHfmSymbols(symbols: string[]): Promise<{
  ok: boolean;
  removed: unknown;
  rejected: unknown;
}> {
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    removed?: unknown;
    rejected?: unknown;
  }>(SUBSCRIPTIONS, { method: "DELETE", body: { symbols } });
  assertHfmDemoIdentity(res.body);
  return {
    ok: Boolean(res.body.ok),
    removed: res.body.removed,
    rejected: res.body.rejected,
  };
}

export async function pauseHfmSubscription(symbol: string): Promise<{
  ok: boolean;
  reason?: string | null;
  subscription?: HfmSubscriptionRecord | null;
}> {
  const path = `${SUBSCRIPTIONS}/${encodeURIComponent(symbol)}/pause`;
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    reason?: string | null;
    subscription?: HfmSubscriptionRecord | null;
  }>(path, { method: "POST", body: {} });
  assertHfmDemoIdentity(res.body);
  return { ok: Boolean(res.body.ok), reason: res.body.reason, subscription: res.body.subscription };
}

export async function resumeHfmSubscription(symbol: string): Promise<{
  ok: boolean;
  reason?: string | null;
  subscription?: HfmSubscriptionRecord | null;
}> {
  const path = `${SUBSCRIPTIONS}/${encodeURIComponent(symbol)}/resume`;
  const res = await hfmRequestJson<{
    ok?: boolean;
    provider?: string;
    environment?: string;
    reason?: string | null;
    subscription?: HfmSubscriptionRecord | null;
  }>(path, { method: "POST", body: {} });
  assertHfmDemoIdentity(res.body);
  return { ok: Boolean(res.body.ok), reason: res.body.reason, subscription: res.body.subscription };
}
