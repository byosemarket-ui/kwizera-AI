import type { MifSourceDialect, MifTimebase, MifVolumeType } from "../../canonical/types.js";
import { MIF_UNIFIED_MARKET_EVIDENCE_ENGINE_ID, MIF_UNIFIED_MARKET_EVIDENCE_ENGINE_VERSION } from "../contracts.js";
import type { MifUnifiedMarketEvidence } from "../types.js";
import { buildUnifiedEvidence } from "./common.js";

/**
 * Documented Phase 5B.1 limitation set for unified.candle dialect paths (B10).
 * Prefer hfm.historical-bar / hfm.forming-candle adapters for volume/timebase-critical analysis.
 */
export interface MifUnifiedDialectLimitations {
  limitationId?: string;
  providerSymbol: string;
  timeframe?: string | null;
  sourceDialect: Extract<MifSourceDialect, "unified.candle">;
  /** Observed volume classification on canonical candles from unified path. */
  volumeType: Extract<MifVolumeType, "unknown_collapsed">;
  timebase: Extract<MifTimebase, "UNKNOWN">;
  observedAt: string;
  candleCount?: number | null;
  notes?: readonly string[];
}

export function adaptUnifiedDialectLimitationsToEvidence(
  input: MifUnifiedDialectLimitations,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const limitationId = input.limitationId ?? `b10-unified-${input.providerSymbol}`;

  return buildUnifiedEvidence({
    sourceEngine: MIF_UNIFIED_MARKET_EVIDENCE_ENGINE_ID,
    engineVersion: MIF_UNIFIED_MARKET_EVIDENCE_ENGINE_VERSION,
    evidenceType: "DIALECT_LIMITATION",
    providerSymbol: input.providerSymbol,
    timeframe: input.timeframe ?? null,
    direction: "NEUTRAL",
    eventTime: input.observedAt,
    observedAt: input.observedAt,
    candleStatus: null,
    warnings: [
      "B10:unknown_collapsed_volume",
      "B10:timebase_UNKNOWN",
    ],
    limitations: [
      "B10 — unified.candle collapses tick vs real volume into unknown_collapsed",
      "B10 — broker timebase remains UNKNOWN on unified historical path",
      "Prefer hfm.historical-bar / hfm.forming-candle dialect adapters for critical paths",
      ...(input.notes ?? []),
    ],
    measurements: [
      { id: "limitationId", name: "limitationId", value: limitationId, unit: null, note: null },
      { id: "sourceDialect", name: "sourceDialect", value: input.sourceDialect, unit: null, note: null },
      { id: "volumeType", name: "volumeType", value: input.volumeType, unit: null, note: null },
      { id: "timebase", name: "timebase", value: input.timebase, unit: null, note: null },
      {
        id: "candleCount",
        name: "candleCount",
        value: input.candleCount ?? null,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "NONE",
      value: null,
      scale: "dialect-limitation",
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Dialect limitation marker — not analytical confidence or win probability",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: limitationId,
    sourceInputIdentity: null,
    sourceContractId: null,
    sourceContractVersion: null,
    fingerprintSource: {
      kind: "dialect-limitation-b10",
      limitationId,
      sourceDialect: input.sourceDialect,
      volumeType: input.volumeType,
      timebase: input.timebase,
    },
  });
}