/**
 * Phase 4.18D — Durable canonical analysis history (no secrets, no full OHLC dumps).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import type { CanonicalAnalysisResult } from "./canonical-analysis.types.js";
import { CANONICAL_ANALYSIS_SCHEMA } from "./canonical-analysis.types.js";

export const CANONICAL_HISTORY_MAX = 80;

/** Compact record — fingerprints & slices, not full candle arrays. */
export interface CanonicalAnalysisHistoryRecord {
  analysisId: string;
  schemaVersion: typeof CANONICAL_ANALYSIS_SCHEMA;
  analysisVersion: string;
  instrument: string;
  primaryTimeframe: string;
  environment: string;
  finalOutcome: string;
  direction: "BUY" | "SELL" | null;
  confidencePct: number | null;
  confidenceType: string;
  confidenceModelVersion: string;
  reconciliationCode: string;
  analyzedAtUtc: string;
  evidenceFingerprint: string;
  quoteFresh: boolean;
  freshnessReasonCode: string | null;
  atrMethod: string;
  atrValue: number | null;
  fastSma: number | null;
  slowSma: number | null;
  closedCandleOpenSec: number | null;
  closedCandleFingerprint: string | null;
  strategyCode: string | null;
  strategyDirection: string | null;
  aiAnalysisId: string | null;
  explanation: string[];
  validationErrors: Array<{ code: string; message: string }>;
  placesOrders: false;
  acceptsForExecution: false;
  /** Dedup key: instrument|tf|closedOpenSec|evidenceFingerprint */
  dedupeKey: string;
}

interface StoreFile {
  version: 1;
  latestId: string | null;
  history: CanonicalAnalysisHistoryRecord[];
}

function storePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "canonical-analysis-history.json",
  );
}

export function canonicalHistoryDedupeKey(result: CanonicalAnalysisResult): string {
  const open = result.deterministic?.closedCandle?.openTimeSec ?? "none";
  return [
    result.instrument,
    result.primaryTimeframe,
    String(open),
    result.evidenceFingerprint,
    result.finalOutcome,
    result.direction ?? "null",
  ].join("|");
}

export function toHistoryRecord(result: CanonicalAnalysisResult): CanonicalAnalysisHistoryRecord {
  return {
    analysisId: result.analysisId,
    schemaVersion: CANONICAL_ANALYSIS_SCHEMA,
    analysisVersion: result.analysisVersion,
    instrument: result.instrument,
    primaryTimeframe: result.primaryTimeframe,
    environment: result.environment,
    finalOutcome: result.finalOutcome,
    direction: result.direction,
    confidencePct: result.confidencePct,
    confidenceType: result.confidenceType,
    confidenceModelVersion: result.confidenceModelVersion,
    reconciliationCode: result.reconciliationCode,
    analyzedAtUtc: result.analyzedAtUtc,
    evidenceFingerprint: result.evidenceFingerprint,
    quoteFresh: result.quote.quoteFresh,
    freshnessReasonCode: result.quote.freshnessReasonCode,
    atrMethod: result.indicators.atrMethod,
    atrValue: result.indicators.atr.value,
    fastSma: result.indicators.fastSma.value,
    slowSma: result.indicators.slowSma.value,
    closedCandleOpenSec: result.deterministic?.closedCandle?.openTimeSec ?? null,
    closedCandleFingerprint: result.deterministic?.closedCandle?.ohlcFingerprint ?? null,
    strategyCode: result.deterministic?.code ?? null,
    strategyDirection: result.deterministic?.direction ?? null,
    aiAnalysisId: result.ai?.analysisId ?? null,
    explanation: result.explanation.slice(0, 12),
    validationErrors: result.validationErrors.slice(0, 12),
    placesOrders: false,
    acceptsForExecution: false,
    dedupeKey: canonicalHistoryDedupeKey(result),
  };
}

function normalize(raw: unknown): StoreFile {
  if (!raw || typeof raw !== "object") {
    return { version: 1, latestId: null, history: [] };
  }
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as CanonicalAnalysisHistoryRecord[]).filter(
      (x) => x && typeof x === "object" && typeof x.analysisId === "string",
    )
    : [];
  return {
    version: 1,
    latestId: typeof o.latestId === "string" ? o.latestId : history[0]?.analysisId ?? null,
    history: history.slice(0, CANONICAL_HISTORY_MAX),
  };
}

export class CanonicalAnalysisHistoryStore {
  private data: StoreFile;
  private readonly file: string;
  lastWriteError: string | null = null;

  constructor(storageRoot?: string) {
    this.file = storePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  latest(): CanonicalAnalysisHistoryRecord | null {
    if (!this.data.latestId) return this.data.history[0] ?? null;
    return this.data.history.find((h) => h.analysisId === this.data.latestId)
      ?? this.data.history[0]
      ?? null;
  }

  get(id: string): CanonicalAnalysisHistoryRecord | null {
    return this.data.history.find((h) => h.analysisId === id) ?? null;
  }

  list(limit = 12): CanonicalAnalysisHistoryRecord[] {
    const n = Math.max(1, Math.min(CANONICAL_HISTORY_MAX, Math.floor(limit)));
    return this.data.history.slice(0, n);
  }

  count(): number {
    return this.data.history.length;
  }

  /**
   * Upsert by analysisId; skip write if identical dedupeKey already latest-matching.
   * Returns { saved, duplicate }.
   */
  async save(result: CanonicalAnalysisResult): Promise<{ saved: boolean; duplicate: boolean }> {
    const record = toHistoryRecord(result);
    const byId = this.data.history.find((h) => h.analysisId === record.analysisId);
    if (byId) {
      return { saved: false, duplicate: true };
    }
    const byDedupe = this.data.history.find((h) => h.dedupeKey === record.dedupeKey);
    if (byDedupe) {
      // Refresh latest pointer to existing duplicate without rewriting payload
      this.data.latestId = byDedupe.analysisId;
      try {
        await writeJsonAtomic(this.file, this.data);
        this.lastWriteError = null;
      } catch (err) {
        this.lastWriteError = err instanceof Error ? err.message.slice(0, 160) : "WRITE_FAILED";
      }
      return { saved: false, duplicate: true };
    }

    const next = [record, ...this.data.history].slice(0, CANONICAL_HISTORY_MAX);
    const prev = this.data;
    this.data = { version: 1, latestId: record.analysisId, history: next };
    try {
      await writeJsonAtomic(this.file, this.data);
      this.lastWriteError = null;
      return { saved: true, duplicate: false };
    } catch (err) {
      this.data = prev;
      this.lastWriteError = err instanceof Error ? err.message.slice(0, 160) : "WRITE_FAILED";
      return { saved: false, duplicate: false };
    }
  }
}

let singleton: CanonicalAnalysisHistoryStore | null = null;

export function getCanonicalAnalysisHistoryStore(storageRoot?: string): CanonicalAnalysisHistoryStore {
  if (storageRoot) return new CanonicalAnalysisHistoryStore(storageRoot);
  if (!singleton) singleton = new CanonicalAnalysisHistoryStore();
  return singleton;
}

export function resetCanonicalAnalysisHistoryStoreForTests(): void {
  singleton = null;
}
