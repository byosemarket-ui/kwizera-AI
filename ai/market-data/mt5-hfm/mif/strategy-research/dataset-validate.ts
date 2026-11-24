/**
 * Phase 08 dataset validation — reuses OHLC integrity rules; never synthesizes bars.
 */
import { createHash } from "node:crypto";
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import type {
  HfmDatasetValidationReport,
  HfmResearchBarInput,
  HfmResearchSourceMode,
} from "./types.js";

function isValidOhlc(b: HfmResearchBarInput): boolean {
  const { open, high, low, close, time } = b;
  if (![open, high, low, close, time].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return false;
  }
  if (time <= 0) return false;
  if (high < low) return false;
  if (high < open || high < close) return false;
  if (low > open || low > close) return false;
  return true;
}

export function validateResearchDataset(input: {
  datasetId: string;
  symbol: string;
  timeframe: string;
  bars: readonly HfmResearchBarInput[];
  sourceMode: HfmResearchSourceMode;
  retrievalTimestamp: string;
  providerId?: string;
  expectedTimeframeSeconds?: number | null;
}): HfmDatasetValidationReport {
  const providerRaw = String(input.providerId ?? MIF_PROVIDER_ID).toUpperCase();
  const warnings: string[] = [];
  const blockReasons: string[] = [];
  let invalidOhlcCount = 0;
  let formingCandleCount = 0;
  let duplicateCount = 0;
  let missingCandleCount = 0;

  if (providerRaw !== MIF_PROVIDER_ID) {
    blockReasons.push(`WRONG_PROVIDER:${providerRaw}`);
  }
  if (input.sourceMode === "SYNTHETIC_TEST_DATA") {
    warnings.push("SYNTHETIC_TEST_DATA — never present as market history");
  }
  if (input.sourceMode === "FIXTURE") {
    warnings.push("FIXTURE — deterministic test/research fixture, not live market history");
  }

  const accepted: HfmResearchBarInput[] = [];
  const seen = new Set<number>();
  let lastTime = -Infinity;
  for (const b of input.bars) {
    if (b.forming) {
      formingCandleCount += 1;
      warnings.push("forming_candle_excluded");
      continue;
    }
    if (!isValidOhlc(b)) {
      invalidOhlcCount += 1;
      continue;
    }
    if (seen.has(b.time)) {
      duplicateCount += 1;
      continue;
    }
    if (b.time < lastTime) {
      blockReasons.push("CHRONOLOGY_VIOLATION");
      continue;
    }
    seen.add(b.time);
    accepted.push(b);
    lastTime = b.time;
  }

  const tfSec = input.expectedTimeframeSeconds ?? null;
  if (tfSec && tfSec > 0 && accepted.length >= 2) {
    for (let i = 1; i < accepted.length; i++) {
      const gap = accepted[i]!.time - accepted[i - 1]!.time;
      if (gap > tfSec * 1.5) {
        const missing = Math.floor(gap / tfSec) - 1;
        if (missing > 0) missingCandleCount += missing;
      }
    }
    if (missingCandleCount > 0) {
      warnings.push(`missing_intervals_detected:${missingCandleCount}`);
    }
  }

  const contentHash =
    accepted.length > 0
      ? createHash("sha256")
          .update(
            JSON.stringify(
              accepted.map((b) => [b.time, b.open, b.high, b.low, b.close]),
            ),
          )
          .digest("hex")
      : null;

  let qualityStatus: HfmDatasetValidationReport["qualityStatus"] = "VALID";
  if (blockReasons.length || (accepted.length === 0 && input.bars.length > 0)) {
    qualityStatus = "INVALID";
  } else if (accepted.length < 10) {
    qualityStatus = "INSUFFICIENT_HISTORY";
    blockReasons.push("INSUFFICIENT_HISTORY");
  } else if (invalidOhlcCount || duplicateCount || missingCandleCount || warnings.length) {
    qualityStatus = missingCandleCount > accepted.length * 0.2 ? "INCOMPLETE" : "VALID_WITH_WARNINGS";
  }

  const mayProceed =
    qualityStatus === "VALID"
    || qualityStatus === "VALID_WITH_WARNINGS";

  if (!mayProceed && qualityStatus === "INCOMPLETE") {
    blockReasons.push("INCOMPLETE_DATASET");
  }

  return {
    datasetId: input.datasetId,
    symbol: input.symbol.toUpperCase(),
    timeframe: input.timeframe,
    providerId: MIF_PROVIDER_ID,
    sourceMode: input.sourceMode,
    qualityStatus,
    candleCount: accepted.length,
    missingCandleCount,
    duplicateCount,
    formingCandleCount,
    invalidOhlcCount,
    startTimestamp:
      accepted[0] != null ? new Date(accepted[0].time * 1000).toISOString() : null,
    endTimestamp:
      accepted.length
        ? new Date(accepted[accepted.length - 1]!.time * 1000).toISOString()
        : null,
    retrievalTimestamp: input.retrievalTimestamp,
    contentHash,
    warnings: [...new Set(warnings)],
    blockReasons: [...new Set(blockReasons)],
    mayProceed:
      mayProceed && !blockReasons.includes("WRONG_PROVIDER") && providerRaw === MIF_PROVIDER_ID,
  };
}
