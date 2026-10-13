/**
 * Phase 43F — Bound compare orchestration.
 * Runs Local AI and OpenAI independently on the same snapshot; never cross-feeds results.
 */
import { getAnalysisSnapshotEngine } from "../../market-data/analysis-snapshot/index.js";
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import {
  getLocalSnapshotAnalysisEngine,
  verifySnapshotFingerprint,
  type LocalSnapshotAnalysisEngine,
} from "../snapshot-local/index.js";
import {
  getOpenAiSnapshotAnalysisEngine,
  type OpenAiSnapshotAnalysisEngine,
} from "../snapshot-openai/index.js";
import { buildDeterministicComparison } from "./comparison.js";
import type {
  LocalProviderOutcome,
  OpenAiProviderOutcome,
  SnapshotCompareApiResult,
  SnapshotCompareRequest,
  SnapshotCompareResult,
  CompareOverallStatus,
} from "./types.js";
import { SNAPSHOT_COMPARE_SCHEMA } from "./types.js";

/** Bound concurrent compare jobs (not unbounded). */
const MAX_COMPARE_IN_FLIGHT = 2;
let compareInFlight = 0;

function fail(started: number, code: string, error: string): SnapshotCompareApiResult {
  return {
    ok: false,
    code,
    error,
    latencyMs: Date.now() - started,
    compare: null,
  };
}

function overallStatus(
  local: LocalProviderOutcome,
  openai: OpenAiProviderOutcome,
): CompareOverallStatus {
  const localOk = local.ok && Boolean(local.analysis);
  const openaiOk = openai.ok && Boolean(openai.analysis);
  if (localOk && openaiOk) return "both_ok";
  if (localOk && !openaiOk) return "partial_local_ok";
  if (!localOk && openaiOk) return "partial_openai_ok";
  return "both_failed";
}

export class SnapshotCompareOrchestrator {
  constructor(
    private readonly deps?: {
      getSnapshot?: (id: string) => Promise<AnalysisMarketSnapshot | null>;
      localEngine?: LocalSnapshotAnalysisEngine;
      openaiEngine?: OpenAiSnapshotAnalysisEngine;
    },
  ) {}

  private async loadSnapshot(id: string): Promise<AnalysisMarketSnapshot | null> {
    if (this.deps?.getSnapshot) return this.deps.getSnapshot(id);
    return getAnalysisSnapshotEngine().getSnapshot(id);
  }

  async compare(raw: SnapshotCompareRequest): Promise<SnapshotCompareApiResult> {
    const started = Date.now();
    const snapshotId = String(raw.snapshotId ?? "").trim();
    if (!snapshotId) {
      return fail(started, "INVALID_REQUEST", "snapshotId is required.");
    }

    if (compareInFlight >= MAX_COMPARE_IN_FLIGHT) {
      return fail(
        started,
        "AI_QUEUE_FULL",
        "Compare queue is full. Retry after the current comparison finishes.",
      );
    }

    const snapshot = await this.loadSnapshot(snapshotId);
    if (!snapshot) {
      return fail(started, "SNAPSHOT_NOT_FOUND", "Snapshot not found.");
    }
    if (!verifySnapshotFingerprint(snapshot)) {
      return fail(
        started,
        "SNAPSHOT_FINGERPRINT_MISMATCH",
        "Stored snapshot failed integrity verification.",
      );
    }
    if (raw.contentFingerprint) {
      const expected = String(raw.contentFingerprint).trim();
      if (expected && expected !== snapshot.contentFingerprint) {
        return fail(
          started,
          "SNAPSHOT_FINGERPRINT_MISMATCH",
          "Provided contentFingerprint does not match the stored snapshot.",
        );
      }
    }

    compareInFlight += 1;
    try {
      const localEngine = this.deps?.localEngine ?? getLocalSnapshotAnalysisEngine();
      const openaiEngine = this.deps?.openaiEngine ?? getOpenAiSnapshotAnalysisEngine();

      const sharedReq = {
        snapshotId,
        contentFingerprint: snapshot.contentFingerprint,
        provider: raw.provider,
        symbol: raw.symbol,
        candleTimeframe: raw.candleTimeframe,
        analysisPeriod: raw.analysisPeriod,
      };

      // Independent parallel execution — neither receives the other's result.
      const [localSettled, openaiSettled] = await Promise.allSettled([
        localEngine.analyze({
          ...sharedReq,
          timeoutMs: raw.localTimeoutMs,
        }),
        openaiEngine.analyze({
          ...sharedReq,
          timeoutMs: raw.openaiTimeoutMs,
        }),
      ]);

      const localResult: LocalProviderOutcome =
        localSettled.status === "fulfilled"
          ? localSettled.value.ok && localSettled.value.analysis
            ? {
                ok: true,
                code: "OK",
                error: null,
                latencyMs: localSettled.value.latencyMs,
                analysis: localSettled.value.analysis,
              }
            : {
                ok: false,
                code: localSettled.value.code || "LOCAL_AI_ERROR",
                error: localSettled.value.error || "Local AI analysis failed.",
                latencyMs: localSettled.value.latencyMs,
                analysis: null,
              }
          : {
              ok: false,
              code: "LOCAL_AI_ERROR",
              error:
                localSettled.reason instanceof Error
                  ? localSettled.reason.message.slice(0, 240)
                  : "Local AI threw unexpectedly.",
              latencyMs: Date.now() - started,
              analysis: null,
            };

      const openaiResult: OpenAiProviderOutcome =
        openaiSettled.status === "fulfilled"
          ? openaiSettled.value.ok && openaiSettled.value.analysis
            ? {
                ok: true,
                code: "OK",
                error: null,
                latencyMs: openaiSettled.value.latencyMs,
                analysis: openaiSettled.value.analysis,
              }
            : {
                ok: false,
                code: openaiSettled.value.code || "OPENAI_ERROR",
                error: openaiSettled.value.error || "OpenAI analysis failed.",
                latencyMs: openaiSettled.value.latencyMs,
                analysis: null,
              }
          : {
              ok: false,
              code: "OPENAI_ERROR",
              error:
                openaiSettled.reason instanceof Error
                  ? openaiSettled.reason.message.slice(0, 240)
                  : "OpenAI threw unexpectedly.",
              latencyMs: Date.now() - started,
              analysis: null,
            };

      const comparison = buildDeterministicComparison(localResult, openaiResult);
      const status = overallStatus(localResult, openaiResult);
      const compare: SnapshotCompareResult = {
        schemaVersion: SNAPSHOT_COMPARE_SCHEMA,
        mode: "COMPARE",
        snapshotId,
        contentFingerprint: snapshot.contentFingerprint,
        status,
        createdAt: new Date().toISOString(),
        localResult,
        openaiResult,
        comparison,
        latencyMs: Date.now() - started,
      };

      const ok = status !== "both_failed";
      return {
        ok,
        code: ok ? (status === "both_ok" ? "OK" : "PARTIAL_SUCCESS") : "BOTH_FAILED",
        error: ok ? null : "Both Local AI and OpenAI failed.",
        latencyMs: compare.latencyMs,
        compare,
      };
    } finally {
      compareInFlight = Math.max(0, compareInFlight - 1);
    }
  }
}

let singleton: SnapshotCompareOrchestrator | null = null;

export function getSnapshotCompareOrchestrator(): SnapshotCompareOrchestrator {
  singleton ??= new SnapshotCompareOrchestrator();
  return singleton;
}

export function createSnapshotCompareOrchestrator(
  deps?: ConstructorParameters<typeof SnapshotCompareOrchestrator>[0],
): SnapshotCompareOrchestrator {
  return new SnapshotCompareOrchestrator(deps);
}

export function resetSnapshotCompareOrchestratorForTests(): void {
  singleton = null;
  compareInFlight = 0;
}

export function getCompareInFlightForTests(): number {
  return compareInFlight;
}
