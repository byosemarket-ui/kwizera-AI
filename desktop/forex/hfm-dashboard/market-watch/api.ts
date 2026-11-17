/**
 * STEP 3A — authenticated HFM catalog / status reads for Market Watch.
 * Uses existing Forex admin token headers. Failures stay explicit (no substitute data).
 */

import {
  buildForexAdminHeaders,
  getForexAdminToken,
} from "../../admin-access/forex-admin-token";
import { HFM_CATALOG_CATEGORIES, type HfmCatalogCategory } from "../../../../ai/market-data/mt5-hfm/catalog-types";
import type { HfmMwCatalogSummary, HfmMwCategoryCount } from "./types";

const SYMBOLS_STATUS = "/api/forex/providers/mt5-hfm/symbols/status";
const SYMBOLS_CATEGORIES = "/api/forex/providers/mt5-hfm/symbols/categories";

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

async function hfmGetJson<T>(path: string): Promise<{ status: number; body: T }> {
  if (!getForexAdminToken()) {
    throw new HfmMwApiError("AUTH_REQUIRED", "Admin API token required for HFM Market Watch.");
  }
  const headers = buildForexAdminHeaders(path);
  let res: Response;
  try {
    res = await fetch(path, { method: "GET", headers, cache: "no-store" });
  } catch (err) {
    throw new HfmMwApiError(
      "NETWORK",
      err instanceof Error ? err.message : "Network error contacting HFM API",
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new HfmMwApiError("AUTH_REJECTED", "Admin token rejected for HFM catalog.", res.status);
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

/**
 * Load catalog summary from confirmed STEP 1/2 endpoints.
 * Prefers categories endpoint counts; falls back to status.categoryCounts.
 */
export async function fetchHfmMarketWatchCatalog(): Promise<HfmMwCatalogSummary> {
  const [statusRes, catsRes] = await Promise.all([
    hfmGetJson<{
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
    }>(`${SYMBOLS_STATUS}?probe=0`),
    hfmGetJson<{
      ok?: boolean;
      provider?: string;
      environment?: string;
      catalogVersion?: string | null;
      categories?: Array<{ category?: string; count?: number }>;
      unavailableReason?: string | null;
    }>(SYMBOLS_CATEGORIES),
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
