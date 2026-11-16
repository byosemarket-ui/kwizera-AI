/**
 * HFM MT5 catalog sync + query service.
 * Pulls chunked NDJSON via agent; persists last-known-good; never falls back to other brokers.
 */
import { createHash } from "node:crypto";
import { callMt5HfmAgent } from "./agent-client.js";
import {
  catalogCategoryToMarketType,
  classifyHfmCatalogSymbol,
  HFM_CLASSIFIER_VERSION,
} from "./catalog-classify.js";
import { HfmCatalogStore, computeCatalogPayloadChecksum } from "./catalog-store.js";
import type {
  HfmCatalogCategory,
  HfmCatalogChangeSummary,
  HfmCatalogInstrument,
  HfmCatalogLifecycle,
  HfmCatalogSnapshot,
  HfmCatalogStatusView,
  HfmRawCatalogSymbol,
} from "./catalog-types.js";
import {
  HFM_CATALOG_CATEGORIES,
  HFM_CATALOG_ENVIRONMENT,
  HFM_CATALOG_PROVIDER,
  HFM_CATALOG_SPEC_KEYS,
} from "./catalog-types.js";

const METADATA_FIELDS = [
  "description",
  "path",
  "isin",
  "categoryRaw",
  "sector",
  "industry",
  "digits",
  "point",
  "tickSize",
  "tickValue",
  "tickValueProfit",
  "tickValueLoss",
  "contractSize",
  "volumeMin",
  "volumeMax",
  "volumeStep",
  "volumeLimit",
  "tradeCalcMode",
  "tradeMode",
  "orderMode",
  "executionMode",
  "fillingMode",
  "expirationMode",
  "stopsLevel",
  "freezeLevel",
  "marginInitial",
  "marginMaintenance",
  "currencyBase",
  "currencyProfit",
  "currencyMargin",
  "selected",
  "visible",
  "customSymbol",
  "sessions",
] as const;

let singleton: HfmCatalogService | null = null;
let syncInFlight: Promise<HfmCatalogSyncResult> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function asNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length ? s : null;
}

function asNullableBoolean(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  return null;
}

export function normalizeRawCatalogSymbol(row: Record<string, unknown>): HfmRawCatalogSymbol | null {
  const symbol = asNullableString(row.symbol);
  if (!symbol) return null;
  const fieldErrors =
    row.fieldErrors && typeof row.fieldErrors === "object" && !Array.isArray(row.fieldErrors)
      ? Object.fromEntries(
          Object.entries(row.fieldErrors as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
        )
      : {};
  return {
    symbol,
    symbolExists: asNullableBoolean(row.symbolExists),
    customSymbol: asNullableBoolean(row.customSymbol),
    description: asNullableString(row.description),
    path: asNullableString(row.path),
    isin: asNullableString(row.isin),
    categoryRaw: asNullableString(row.categoryRaw),
    sector: asNullableNumber(row.sector),
    industry: asNullableNumber(row.industry),
    sectorName: asNullableString(row.sectorName),
    industryName: asNullableString(row.industryName),
    selected: asNullableBoolean(row.selected),
    visible: asNullableBoolean(row.visible),
    digits: asNullableNumber(row.digits),
    point: asNullableNumber(row.point),
    tickSize: asNullableNumber(row.tickSize),
    tickValue: asNullableNumber(row.tickValue),
    tickValueProfit: asNullableNumber(row.tickValueProfit),
    tickValueLoss: asNullableNumber(row.tickValueLoss),
    contractSize: asNullableNumber(row.contractSize),
    volumeMin: asNullableNumber(row.volumeMin),
    volumeMax: asNullableNumber(row.volumeMax),
    volumeStep: asNullableNumber(row.volumeStep),
    volumeLimit: asNullableNumber(row.volumeLimit),
    tradeCalcMode: asNullableNumber(row.tradeCalcMode),
    tradeMode: asNullableNumber(row.tradeMode),
    orderMode: asNullableNumber(row.orderMode),
    executionMode: asNullableNumber(row.executionMode),
    fillingMode: asNullableNumber(row.fillingMode),
    expirationMode: asNullableNumber(row.expirationMode),
    stopsLevel: asNullableNumber(row.stopsLevel),
    freezeLevel: asNullableNumber(row.freezeLevel),
    marginInitial: asNullableNumber(row.marginInitial),
    marginMaintenance: asNullableNumber(row.marginMaintenance),
    currencyBase: asNullableString(row.currencyBase),
    currencyProfit: asNullableString(row.currencyProfit),
    currencyMargin: asNullableString(row.currencyMargin),
    synchronized: asNullableBoolean(row.synchronized),
    sessions:
      row.sessions && typeof row.sessions === "object"
        ? (row.sessions as HfmRawCatalogSymbol["sessions"])
        : null,
    fieldErrors,
  };
}

export function computeMetadataCompleteness(raw: HfmRawCatalogSymbol): number {
  let present = 0;
  for (const key of METADATA_FIELDS) {
    const val = raw[key];
    const errored = Boolean(raw.fieldErrors[key]);
    if (!errored && val != null && val !== "") present += 1;
  }
  return Math.round((present / METADATA_FIELDS.length) * 1000) / 10;
}

export function resolveLifecycle(raw: HfmRawCatalogSymbol, completeness: number): HfmCatalogLifecycle {
  if (raw.customSymbol === true) return "CUSTOM";
  if (raw.symbolExists === false) return "REMOVED_OR_UNAVAILABLE";
  if (completeness < 40) return "METADATA_INCOMPLETE";
  return "ACTIVE";
}

function emptyCategoryCounts(): Record<HfmCatalogCategory, number> {
  return Object.fromEntries(HFM_CATALOG_CATEGORIES.map((c) => [c, 0])) as Record<
    HfmCatalogCategory,
    number
  >;
}

function summarizeFieldErrors(symbols: HfmCatalogInstrument[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of symbols) {
    for (const key of Object.keys(s.fieldErrors ?? {})) {
      out[key] = (out[key] ?? 0) + 1;
    }
  }
  return out;
}

function specFingerprint(s: HfmRawCatalogSymbol): string {
  return HFM_CATALOG_SPEC_KEYS.map((k) => `${k}=${String(s[k])}`).join("|");
}

export function detectCatalogChanges(
  previous: HfmCatalogInstrument[] | null | undefined,
  next: HfmCatalogInstrument[],
): HfmCatalogChangeSummary {
  const prevMap = new Map((previous ?? []).map((s) => [s.symbol, s]));
  const nextMap = new Map(next.map((s) => [s.symbol, s]));
  const added: string[] = [];
  const removed: string[] = [];
  const descriptionChanged: string[] = [];
  const specificationChanged: string[] = [];
  const classificationChanged: string[] = [];
  const metadataErrorsChanged: string[] = [];

  for (const sym of nextMap.keys()) {
    if (!prevMap.has(sym)) added.push(sym);
  }
  for (const sym of prevMap.keys()) {
    if (!nextMap.has(sym)) removed.push(sym);
  }
  for (const [sym, cur] of nextMap) {
    const prev = prevMap.get(sym);
    if (!prev) continue;
    if ((prev.description ?? null) !== (cur.description ?? null)) descriptionChanged.push(sym);
    if (specFingerprint(prev) !== specFingerprint(cur)) specificationChanged.push(sym);
    if (prev.classification.category !== cur.classification.category) classificationChanged.push(sym);
    if (JSON.stringify(prev.fieldErrors) !== JSON.stringify(cur.fieldErrors)) {
      metadataErrorsChanged.push(sym);
    }
  }
  return {
    added,
    removed,
    descriptionChanged,
    specificationChanged,
    classificationChanged,
    metadataErrorsChanged,
  };
}

export function enrichCatalogSymbols(
  rawRows: HfmRawCatalogSymbol[],
  ctx: {
    brokerServer: string | null;
    catalogVersion: string;
    previous?: HfmCatalogInstrument[] | null;
    discoveredAt: string;
  },
): HfmCatalogInstrument[] {
  const prevMap = new Map((ctx.previous ?? []).map((s) => [s.symbol, s]));
  return rawRows.map((raw) => {
    const completeness = computeMetadataCompleteness(raw);
    const classification = classifyHfmCatalogSymbol(raw);
    const lifecycle = resolveLifecycle(raw, completeness);
    const prev = prevMap.get(raw.symbol);
    return {
      ...raw,
      provider: HFM_CATALOG_PROVIDER,
      environment: HFM_CATALOG_ENVIRONMENT,
      brokerServer: ctx.brokerServer,
      catalogVersion: ctx.catalogVersion,
      lifecycle,
      firstDiscoveredAt: prev?.firstDiscoveredAt ?? ctx.discoveredAt,
      lastDiscoveredAt: ctx.discoveredAt,
      metadataCompleteness: completeness,
      classification,
    };
  });
}

export function applyMissingAfterSuccessfulDiscovery(
  previous: HfmCatalogInstrument[],
  nextActive: HfmCatalogInstrument[],
  discoveredAt: string,
): HfmCatalogInstrument[] {
  const nextNames = new Set(nextActive.map((s) => s.symbol));
  const retained: HfmCatalogInstrument[] = [...nextActive];
  for (const prev of previous) {
    if (nextNames.has(prev.symbol)) continue;
    retained.push({
      ...prev,
      lifecycle: "NOT_CURRENTLY_AVAILABLE",
      lastDiscoveredAt: discoveredAt,
    });
  }
  return retained;
}

export interface HfmCatalogSyncResult {
  ok: boolean;
  status: HfmCatalogStatusView;
  snapshot: HfmCatalogSnapshot | null;
  errorCode: string | null;
  synced: boolean;
  durationMs: number;
}

export interface HfmCatalogQuery {
  q?: string;
  category?: HfmCatalogCategory | string;
  lifecycle?: HfmCatalogLifecycle | string;
  selected?: boolean;
  custom?: boolean;
  offset?: number;
  limit?: number;
}

export class HfmCatalogService {
  private readonly store: HfmCatalogStore;
  private memory: HfmCatalogSnapshot | null = null;

  constructor(storageRoot?: string) {
    this.store = new HfmCatalogStore(storageRoot);
  }

  async load(): Promise<HfmCatalogSnapshot | null> {
    if (this.memory) return this.memory;
    this.memory = await this.store.loadCurrent();
    return this.memory;
  }

  async getStatus(opts?: { probeAgent?: boolean }): Promise<HfmCatalogStatusView> {
    const disk = await this.store.statusFromDisk();
    const mem = await this.load();
    if (!opts?.probeAgent) {
      if (mem) {
        return {
          ...disk,
          available: true,
          artifactReady: true,
          discoveryStatus: mem.discoveryStatus,
          freshness: mem.freshness,
          brokerServer: mem.brokerServer,
          catalogVersion: mem.catalogVersion,
          checksumSha256: mem.checksumSha256,
          enumerationStartedAt: mem.enumerationStartedAt,
          enumerationCompletedAt: mem.enumerationCompletedAt,
          ingestedAt: mem.ingestedAt,
          generalSymbolCount: mem.generalSymbolCount,
          selectedSymbolCount: mem.selectedSymbolCount,
          enumeratedCount: mem.enumeratedCount,
          validCount: mem.validCount,
          duplicateCount: mem.duplicateCount,
          customCount: mem.customCount,
          metadataCompletenessAvg: mem.metadataCompletenessAvg,
          fieldErrorSummary: mem.fieldErrorSummary,
          categoryCounts: mem.categoryCounts,
          changes: mem.changes,
          source: "persisted",
          unavailableReason: null,
        };
      }
      return disk;
    }

    try {
      const res = await callMt5HfmAgent("demo.catalog_status", {});
      const agent = (res.result ?? {}) as Record<string, unknown>;
      const agentStatus = String(agent.discoveryStatus ?? "UNAVAILABLE");
      const artifactReady = Boolean(agent.artifactReady);
      if (!res.ok) {
        return {
          ...disk,
          freshness: mem ? "LAST_KNOWN" : "UNAVAILABLE",
          unavailableReason: String(res.code ?? "AGENT_ERROR"),
          discoveryStatus: mem ? "LAST_KNOWN" : "UNAVAILABLE",
        };
      }
      if (artifactReady) {
        return {
          ...disk,
          available: true,
          artifactReady: true,
          discoveryStatus: agentStatus,
          freshness: mem && mem.catalogVersion === agent.catalogVersion ? "COMPLETE" : "PARTIAL",
          brokerServer: (agent.brokerServer as string) ?? disk.brokerServer,
          catalogVersion: (agent.catalogVersion as string) ?? disk.catalogVersion,
          checksumSha256: (agent.checksumSha256 as string) ?? disk.checksumSha256,
          enumerationStartedAt: (agent.enumerationStartedAt as string) ?? disk.enumerationStartedAt,
          enumerationCompletedAt:
            (agent.enumerationCompletedAt as string) ?? disk.enumerationCompletedAt,
          generalSymbolCount: asNullableNumber(agent.generalSymbolCount),
          selectedSymbolCount: asNullableNumber(agent.selectedSymbolCount),
          enumeratedCount: asNullableNumber(agent.enumeratedCount),
          validCount: asNullableNumber(agent.validCount),
          duplicateCount: asNullableNumber(agent.duplicateCount),
          customCount: asNullableNumber(agent.customCount),
          source: "mql5_catalog",
          unavailableReason: null,
        };
      }
      return {
        ...disk,
        available: Boolean(mem) || agentStatus === "IN_PROGRESS",
        artifactReady: false,
        discoveryStatus: agentStatus,
        freshness:
          agentStatus === "IN_PROGRESS" ? "IN_PROGRESS" : mem ? "LAST_KNOWN" : "UNAVAILABLE",
        generalSymbolCount: asNullableNumber(agent.generalSymbolCount) ?? disk.generalSymbolCount,
        selectedSymbolCount: asNullableNumber(agent.selectedSymbolCount) ?? disk.selectedSymbolCount,
        enumeratedCount: asNullableNumber(agent.enumeratedCount) ?? disk.enumeratedCount,
        source: "mql5_catalog",
        unavailableReason: mem
          ? null
          : String(agent.unavailableReason ?? "CATALOG_NOT_READY"),
      };
    } catch (error) {
      return {
        ...disk,
        freshness: mem ? "LAST_KNOWN" : "UNAVAILABLE",
        discoveryStatus: mem ? "LAST_KNOWN" : "UNAVAILABLE",
        unavailableReason: error instanceof Error ? error.message : "AGENT_UNAVAILABLE",
      };
    }
  }

  async syncFromAgent(opts?: { forceRefresh?: boolean }): Promise<HfmCatalogSyncResult> {
    if (syncInFlight) return syncInFlight;
    syncInFlight = this._syncFromAgent(opts).finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  }

  private async _syncFromAgent(opts?: { forceRefresh?: boolean }): Promise<HfmCatalogSyncResult> {
    const started = Date.now();
    const previous = await this.load();
    try {
      if (opts?.forceRefresh) {
        await callMt5HfmAgent("demo.catalog_refresh", {});
      }
      const statusRes = await callMt5HfmAgent("demo.catalog_status", {});
      if (!statusRes.ok) {
        await this.store.recordFailure(String(statusRes.code ?? "CATALOG_STATUS_FAILED"));
        return {
          ok: false,
          synced: false,
          snapshot: previous,
          status: await this.getStatus(),
          errorCode: String(statusRes.code ?? "CATALOG_STATUS_FAILED"),
          durationMs: Date.now() - started,
        };
      }
      const st = (statusRes.result ?? {}) as Record<string, unknown>;
      if (!st.artifactReady) {
        // Do not wipe LKG — incomplete discovery.
        return {
          ok: false,
          synced: false,
          snapshot: previous,
          status: await this.getStatus({ probeAgent: true }),
          errorCode: String(st.unavailableReason ?? st.discoveryStatus ?? "CATALOG_NOT_READY"),
          durationMs: Date.now() - started,
        };
      }

      const catalogVersion = String(st.catalogVersion ?? "");
      if (!catalogVersion) {
        await this.store.recordFailure("CATALOG_VERSION_MISSING");
        return {
          ok: false,
          synced: false,
          snapshot: previous,
          status: await this.getStatus(),
          errorCode: "CATALOG_VERSION_MISSING",
          durationMs: Date.now() - started,
        };
      }

      if (previous && previous.catalogVersion === catalogVersion && previous.checksumSha256 === st.checksumSha256) {
        if (previous.classifierVersion === HFM_CLASSIFIER_VERSION) {
          previous.freshness = "COMPLETE";
          this.memory = previous;
          return {
            ok: true,
            synced: false,
            snapshot: previous,
            status: await this.getStatus({ probeAgent: true }),
            errorCode: null,
            durationMs: Date.now() - started,
          };
        }
        // Classifier rules changed — re-enrich from already-persisted instrument fields (no MT5 rescan).
        const discoveredAt = nowIso();
        let enriched = enrichCatalogSymbols(previous.symbols, {
          brokerServer: previous.brokerServer,
          catalogVersion,
          previous: previous.symbols,
          discoveredAt,
        });
        const changes = detectCatalogChanges(previous.symbols, enriched);
        const categoryCounts = emptyCategoryCounts();
        let completenessSum = 0;
        for (const s of enriched) {
          categoryCounts[s.classification.category] += 1;
          completenessSum += s.metadataCompleteness;
        }
        const snapshot: HfmCatalogSnapshot = {
          ...previous,
          freshness: "COMPLETE",
          discoveryStatus: "COMPLETE",
          ingestedAt: discoveredAt,
          classifierVersion: HFM_CLASSIFIER_VERSION,
          metadataCompletenessAvg:
            enriched.length > 0 ? Math.round((completenessSum / enriched.length) * 10) / 10 : 0,
          fieldErrorSummary: summarizeFieldErrors(enriched),
          categoryCounts,
          changes,
          symbols: enriched,
        };
        const sealed = await this.store.saveSuccessful(snapshot);
        this.memory = sealed;
        return {
          ok: true,
          synced: true,
          snapshot: sealed,
          status: await this.getStatus({ probeAgent: true }),
          errorCode: null,
          durationMs: Date.now() - started,
        };
      }

      const rawRows: HfmRawCatalogSymbol[] = [];
      let offset = 0;
      const limit = 50;
      let total = Number(st.ndjsonLineCount ?? st.validCount ?? 0);
      let agentChecksum = String(st.checksumSha256 ?? "");
      for (;;) {
        const chunkRes = await callMt5HfmAgent("demo.catalog_chunk", { offset, limit });
        if (!chunkRes.ok) {
          await this.store.recordFailure(String(chunkRes.code ?? "CATALOG_CHUNK_FAILED"));
          return {
            ok: false,
            synced: false,
            snapshot: previous,
            status: await this.getStatus(),
            errorCode: String(chunkRes.code ?? "CATALOG_CHUNK_FAILED"),
            durationMs: Date.now() - started,
          };
        }
        const chunk = (chunkRes.result ?? {}) as Record<string, unknown>;
        if (!chunk.artifactReady) {
          await this.store.recordFailure(String(chunk.unavailableReason ?? "CATALOG_NOT_READY"));
          return {
            ok: false,
            synced: false,
            snapshot: previous,
            status: await this.getStatus({ probeAgent: true }),
            errorCode: String(chunk.unavailableReason ?? "CATALOG_NOT_READY"),
            durationMs: Date.now() - started,
          };
        }
        agentChecksum = String(chunk.checksumSha256 ?? agentChecksum);
        total = Number(chunk.total ?? total);
        const symbols = Array.isArray(chunk.symbols) ? chunk.symbols : [];
        for (const item of symbols) {
          if (!item || typeof item !== "object") continue;
          const normalized = normalizeRawCatalogSymbol(item as Record<string, unknown>);
          if (normalized) rawRows.push(normalized);
        }
        const returned = Number(chunk.returned ?? symbols.length);
        offset += returned;
        if (!chunk.hasMore || returned === 0 || offset >= total) break;
        if (offset > 5000) break; // hard safety on 1 vCPU
      }

      if (rawRows.length === 0) {
        await this.store.recordFailure("CATALOG_EMPTY");
        return {
          ok: false,
          synced: false,
          snapshot: previous,
          status: await this.getStatus(),
          errorCode: "CATALOG_EMPTY",
          durationMs: Date.now() - started,
        };
      }

      const discoveredAt = nowIso();
      const brokerServer = asNullableString(st.brokerServer);
      let enriched = enrichCatalogSymbols(rawRows, {
        brokerServer,
        catalogVersion,
        previous: previous?.symbols ?? null,
        discoveredAt,
      });
      // Only mark missing after a COMPLETE successful pull (artifactReady already gated).
      if (previous?.symbols?.length) {
        enriched = applyMissingAfterSuccessfulDiscovery(previous.symbols, enriched, discoveredAt);
      }
      const changes = detectCatalogChanges(previous?.symbols ?? null, enriched);
      const categoryCounts = emptyCategoryCounts();
      let completenessSum = 0;
      for (const s of enriched) {
        categoryCounts[s.classification.category] += 1;
        completenessSum += s.metadataCompleteness;
      }
      const checksumSha256 =
        agentChecksum ||
        computeCatalogPayloadChecksum({
          catalogVersion,
          symbols: enriched.map((s) => s.symbol),
          enumeratedCount: enriched.length,
        });

      const snapshot: HfmCatalogSnapshot = {
        provider: HFM_CATALOG_PROVIDER,
        environment: HFM_CATALOG_ENVIRONMENT,
        brokerServer,
        catalogVersion,
        checksumSha256,
        discoveryStatus: "COMPLETE",
        freshness: "COMPLETE",
        enumerationStartedAt: asNullableString(st.enumerationStartedAt),
        enumerationCompletedAt: asNullableString(st.enumerationCompletedAt) ?? discoveredAt,
        ingestedAt: discoveredAt,
        generalSymbolCount: asNullableNumber(st.generalSymbolCount),
        selectedSymbolCount: asNullableNumber(st.selectedSymbolCount),
        enumeratedCount: asNullableNumber(st.enumeratedCount) ?? rawRows.length,
        validCount: asNullableNumber(st.validCount) ?? rawRows.filter((r) => r.symbolExists !== false).length,
        duplicateCount: asNullableNumber(st.duplicateCount),
        customCount: asNullableNumber(st.customCount),
        metadataCompletenessAvg:
          enriched.length > 0 ? Math.round((completenessSum / enriched.length) * 10) / 10 : 0,
        fieldErrorSummary: summarizeFieldErrors(enriched),
        categoryCounts,
        changes,
        symbols: enriched,
        source: "mql5_catalog",
        schemaVersion: 1,
        classifierVersion: HFM_CLASSIFIER_VERSION,
        mutatesBroker: false,
        placesOrders: false,
        acceptsForExecution: false,
      };

      const sealed = await this.store.saveSuccessful(snapshot);
      this.memory = sealed;
      return {
        ok: true,
        synced: true,
        snapshot: sealed,
        status: await this.getStatus({ probeAgent: true }),
        errorCode: null,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 120) : "SYNC_ERROR";
      await this.store.recordFailure(code);
      return {
        ok: false,
        synced: false,
        snapshot: previous,
        status: await this.getStatus(),
        errorCode: code,
        durationMs: Date.now() - started,
      };
    }
  }

  async query(params: HfmCatalogQuery = {}): Promise<{
    available: boolean;
    freshness: HfmCatalogSnapshot["freshness"] | "UNAVAILABLE";
    catalogVersion: string | null;
    total: number;
    offset: number;
    limit: number;
    returned: number;
    symbols: HfmCatalogInstrument[];
    unavailableReason: string | null;
  }> {
    const snap = await this.load();
    const offset = Math.max(0, Number(params.offset ?? 0) || 0);
    const limit = Math.min(200, Math.max(1, Number(params.limit ?? 50) || 50));
    if (!snap) {
      return {
        available: false,
        freshness: "UNAVAILABLE",
        catalogVersion: null,
        total: 0,
        offset,
        limit,
        returned: 0,
        symbols: [],
        unavailableReason: "CATALOG_UNAVAILABLE",
      };
    }
    const q = String(params.q ?? "").trim().toLowerCase();
    let rows = snap.symbols;
    if (params.category) {
      rows = rows.filter((s) => s.classification.category === params.category);
    }
    if (params.lifecycle) {
      rows = rows.filter((s) => s.lifecycle === params.lifecycle);
    }
    if (typeof params.selected === "boolean") {
      rows = rows.filter((s) => s.selected === params.selected);
    }
    if (typeof params.custom === "boolean") {
      rows = rows.filter((s) => s.customSymbol === params.custom);
    }
    if (q) {
      rows = rows.filter((s) => {
        const hay = `${s.symbol} ${s.description ?? ""} ${s.path ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const slice = rows.slice(offset, offset + limit);
    return {
      available: true,
      freshness: snap.freshness,
      catalogVersion: snap.catalogVersion,
      total: rows.length,
      offset,
      limit,
      returned: slice.length,
      symbols: slice,
      unavailableReason: null,
    };
  }

  async getSymbol(symbol: string): Promise<HfmCatalogInstrument | null> {
    const snap = await this.load();
    if (!snap) return null;
    const exact = snap.symbols.find((s) => s.symbol === symbol);
    if (exact) return exact;
    const u = symbol.toUpperCase();
    return snap.symbols.find((s) => s.symbol.toUpperCase() === u) ?? null;
  }

  async categories(): Promise<{
    available: boolean;
    catalogVersion: string | null;
    counts: Record<HfmCatalogCategory, number>;
    unavailableReason: string | null;
  }> {
    const snap = await this.load();
    if (!snap) {
      return {
        available: false,
        catalogVersion: null,
        counts: emptyCategoryCounts(),
        unavailableReason: "CATALOG_UNAVAILABLE",
      };
    }
    return {
      available: true,
      catalogVersion: snap.catalogVersion,
      counts: snap.categoryCounts,
      unavailableReason: null,
    };
  }
}

export function getHfmCatalogService(storageRoot?: string): HfmCatalogService {
  if (storageRoot) return new HfmCatalogService(storageRoot);
  if (!singleton) singleton = new HfmCatalogService();
  return singleton;
}

export function resetHfmCatalogServiceForTests(): void {
  singleton = null;
  syncInFlight = null;
}

export function instrumentToMarketType(symbol: HfmCatalogInstrument) {
  return catalogCategoryToMarketType(symbol.classification.category);
}

export function catalogIntegrityDigest(symbols: string[]): string {
  return createHash("sha256").update(symbols.join("\n")).digest("hex");
}
