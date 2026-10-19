/**
 * Phase 53.1 / 53.3 — Persist AT monitoring config + health (no secrets).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import { parseAtMonitorTimeframe } from "./timeframes.js";
import {
  AT_MONITOR_PHASE,
  AT_MONITOR_SCHEMA,
  defaultMonitorHealth,
  defaultMonitorPersisted,
  type AtMonitorConfig,
  type AtMonitorHealth,
  type AtMonitorPersistedState,
} from "./types.js";
import { AT_MONITOR_DEFAULT_POLL_MS, clampPollIntervalMs } from "./schedule.js";

const MAX_DEDUPE = 64;

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "monitoring.json",
  );
}

function normalizeConfig(raw: unknown): AtMonitorConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tf = parseAtMonitorTimeframe(o.timeframe);
  const env = o.environment === "LIVE" ? "LIVE" : o.environment === "DEMO" ? "DEMO" : null;
  const instrument = String(o.instrument ?? "").trim();
  if (!tf || !env || !instrument) return null;
  const epoch = Number(o.configEpoch);
  return {
    enabled: Boolean(o.enabled),
    environment: env,
    instrument,
    timeframe: tf,
    configEpoch: Number.isFinite(epoch) && epoch >= 1 ? Math.floor(epoch) : 1,
    createdAtUtc: typeof o.createdAtUtc === "string" ? o.createdAtUtc : new Date().toISOString(),
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : new Date().toISOString(),
    pollIntervalMs: clampPollIntervalMs(o.pollIntervalMs ?? AT_MONITOR_DEFAULT_POLL_MS),
  };
}

function normalizeHealth(raw: unknown): AtMonitorHealth {
  const base = defaultMonitorHealth();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    workerState: typeof o.workerState === "string" ? (o.workerState as AtMonitorHealth["workerState"]) : base.workerState,
    workerActive: false, // never trust persisted "active" across process restart
    lastQuoteChangeAtUtc: typeof o.lastQuoteChangeAtUtc === "string" ? o.lastQuoteChangeAtUtc : null,
    lastCandleUpdateAtUtc: typeof o.lastCandleUpdateAtUtc === "string" ? o.lastCandleUpdateAtUtc : null,
    lastClosedCandleOpenSec:
      typeof o.lastClosedCandleOpenSec === "number" && Number.isFinite(o.lastClosedCandleOpenSec)
        ? o.lastClosedCandleOpenSec
        : null,
    lastScreenshotAtUtc: typeof o.lastScreenshotAtUtc === "string" ? o.lastScreenshotAtUtc : null,
    lastScreenshotImageHash: typeof o.lastScreenshotImageHash === "string" ? o.lastScreenshotImageHash : null,
    lastAnalysisAtUtc: typeof o.lastAnalysisAtUtc === "string" ? o.lastAnalysisAtUtc : null,
    lastAnalysisId: typeof o.lastAnalysisId === "string" ? o.lastAnalysisId : null,
    nextScheduledAnalysisAtUtc:
      typeof o.nextScheduledAnalysisAtUtc === "string" ? o.nextScheduledAnalysisAtUtc : null,
    lastDedupeKey: typeof o.lastDedupeKey === "string" ? o.lastDedupeKey : null,
    lastError: typeof o.lastError === "string" ? o.lastError.slice(0, 240) : null,
    lastBlockerCode: typeof o.lastBlockerCode === "string" ? o.lastBlockerCode : null,
    lastObservationAtUtc: typeof o.lastObservationAtUtc === "string" ? o.lastObservationAtUtc : null,
    quoteFresh: typeof o.quoteFresh === "boolean" ? o.quoteFresh : null,
    feedStatus: typeof o.feedStatus === "string" ? o.feedStatus : null,
    freshnessReasonCode: typeof o.freshnessReasonCode === "string" ? o.freshnessReasonCode.slice(0, 80) : null,
    freshnessThresholdMs:
      typeof o.freshnessThresholdMs === "number" && Number.isFinite(o.freshnessThresholdMs)
        ? Math.max(0, Math.floor(o.freshnessThresholdMs))
        : null,
    verificationAgeMs:
      typeof o.verificationAgeMs === "number" && Number.isFinite(o.verificationAgeMs)
        ? Math.max(0, Math.floor(o.verificationAgeMs))
        : null,
    effectivePriceChangeAgeMs:
      typeof o.effectivePriceChangeAgeMs === "number" && Number.isFinite(o.effectivePriceChangeAgeMs)
        ? Math.max(0, Math.floor(o.effectivePriceChangeAgeMs))
        : null,
    effectiveReceiptAgeMs:
      typeof o.effectiveReceiptAgeMs === "number" && Number.isFinite(o.effectiveReceiptAgeMs)
        ? Math.max(0, Math.floor(o.effectiveReceiptAgeMs))
        : null,
    verificationSnapshotAtUtc:
      typeof o.verificationSnapshotAtUtc === "string" ? o.verificationSnapshotAtUtc : null,
    freshnessEvaluatedAtUtc:
      typeof o.freshnessEvaluatedAtUtc === "string" ? o.freshnessEvaluatedAtUtc : null,
    quoteSnapshotFingerprint:
      typeof o.quoteSnapshotFingerprint === "string" ? o.quoteSnapshotFingerprint.slice(0, 32) : null,
    quoteSourceTimestampMs:
      typeof o.quoteSourceTimestampMs === "number" && Number.isFinite(o.quoteSourceTimestampMs)
        ? Math.floor(o.quoteSourceTimestampMs)
        : null,
    quoteReceivedAtMs:
      typeof o.quoteReceivedAtMs === "number" && Number.isFinite(o.quoteReceivedAtMs)
        ? Math.floor(o.quoteReceivedAtMs)
        : null,
    analysisInFlight: false,
    consecutiveFailures:
      typeof o.consecutiveFailures === "number" && Number.isFinite(o.consecutiveFailures)
        ? Math.max(0, Math.floor(o.consecutiveFailures))
        : 0,
  };
}

function normalize(raw: unknown): AtMonitorPersistedState {
  const defaults = defaultMonitorPersisted();
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;
  const dedupe = Array.isArray(o.completedDedupeKeys)
    ? o.completedDedupeKeys.map(String).filter(Boolean).slice(0, MAX_DEDUPE)
    : [];
  return {
    schemaVersion: AT_MONITOR_SCHEMA,
    phase: AT_MONITOR_PHASE,
    config: normalizeConfig(o.config),
    health: normalizeHealth(o.health),
    completedDedupeKeys: dedupe,
  };
}

export class AtMonitorStore {
  private data: AtMonitorPersistedState;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  getState(): AtMonitorPersistedState {
    return {
      ...this.data,
      config: this.data.config ? { ...this.data.config } : null,
      health: { ...this.data.health },
      completedDedupeKeys: [...this.data.completedDedupeKeys],
    };
  }

  async save(next: AtMonitorPersistedState): Promise<void> {
    this.data = {
      schemaVersion: AT_MONITOR_SCHEMA,
      phase: AT_MONITOR_PHASE,
      config: next.config,
      health: { ...next.health, workerActive: false, analysisInFlight: false },
      completedDedupeKeys: next.completedDedupeKeys.slice(0, MAX_DEDUPE),
    };
    await writeJsonAtomic(this.file, this.data);
  }

  async update(
    mutator: (state: AtMonitorPersistedState) => AtMonitorPersistedState,
  ): Promise<AtMonitorPersistedState> {
    const next = mutator(this.getState());
    await this.save(next);
    return this.getState();
  }

  hasDedupe(key: string): boolean {
    return this.data.completedDedupeKeys.includes(key);
  }

  async rememberDedupe(key: string): Promise<void> {
    if (!key || this.hasDedupe(key)) return;
    await this.update((s) => ({
      ...s,
      completedDedupeKeys: [key, ...s.completedDedupeKeys].slice(0, MAX_DEDUPE),
    }));
  }
}

let singleton: AtMonitorStore | null = null;

export function getAtMonitorStore(storageRoot?: string): AtMonitorStore {
  if (storageRoot) return new AtMonitorStore(storageRoot);
  if (!singleton) singleton = new AtMonitorStore();
  return singleton;
}

export function resetAtMonitorStoreForTests(): void {
  singleton = null;
}

export function chartImageDir(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "chart-images",
  );
}

export function chartImagePath(analysisId: string, storageRoot?: string): string {
  const safe = String(analysisId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  return path.join(chartImageDir(storageRoot), `${safe}.png`);
}

/** Bounded retention — keep newest PNGs only (by mtime). */
export const AT_CHART_IMAGE_MAX_FILES = 48;

export function pruneChartImages(storageRoot?: string, keep = AT_CHART_IMAGE_MAX_FILES): number {
  const dir = chartImageDir(storageRoot);
  if (!fs.existsSync(dir)) return 0;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .map((f) => {
      const full = path.join(dir, f);
      try {
        return { full, mtime: fs.statSync(full).mtimeMs };
      } catch {
        return { full, mtime: 0 };
      }
    })
    .sort((a, b) => b.mtime - a.mtime);
  let removed = 0;
  for (const file of files.slice(Math.max(1, keep))) {
    try {
      fs.unlinkSync(file.full);
      removed += 1;
    } catch {
      /* ignore */
    }
  }
  return removed;
}
