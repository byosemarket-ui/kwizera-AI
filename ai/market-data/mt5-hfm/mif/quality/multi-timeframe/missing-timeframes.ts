/**
 * Phase 5B.2 Step 2 — missing / empty / unsupported timeframe detection.
 */
import { resolveTimeframeDurationSec, type MifCanonicalCandle } from "../../canonical/candle.js";
import {
  MIF_QI_OPTIONAL_TIMEFRAME_MISSING,
  MIF_QI_REQUIRED_TIMEFRAME_MISSING,
  MIF_QI_TIMEFRAME_EMPTY,
  MIF_QI_TIMEFRAME_UNSUPPORTED,
} from "../codes.js";
import type { MifQualityFinding } from "../types.js";
import type { MifMultiTimeframeRequirement } from "./requirements.js";

export interface TimeframePresenceReport {
  supplied: string[];
  requiredMissing: string[];
  optionalMissing: string[];
  empty: string[];
  unsupported: string[];
  findings: MifQualityFinding[];
}

export function assessTimeframePresence(input: {
  seriesByTimeframe: Readonly<Record<string, readonly MifCanonicalCandle[]>>;
  requirement: MifMultiTimeframeRequirement;
}): TimeframePresenceReport {
  const findings: MifQualityFinding[] = [];
  const supplied = Object.keys(input.seriesByTimeframe).sort();
  const requiredMissing: string[] = [];
  const optionalMissing: string[] = [];
  const empty: string[] = [];
  const unsupported: string[] = [];
  const missingBlocks = input.requirement.missingRequiredBlocks !== false;

  for (const tf of input.requirement.requiredTimeframes) {
    const series = input.seriesByTimeframe[tf];
    if (series == null) {
      requiredMissing.push(tf);
      findings.push({
        code: MIF_QI_REQUIRED_TIMEFRAME_MISSING,
        severity: missingBlocks ? "blocking" : "degraded",
        message: `required timeframe ${tf} missing`,
        evidence: { timeframe: tf, consumerId: input.requirement.consumerId },
      });
      continue;
    }
    if (series.length === 0) {
      empty.push(tf);
      findings.push({
        code: MIF_QI_TIMEFRAME_EMPTY,
        severity: missingBlocks ? "blocking" : "degraded",
        message: `required timeframe ${tf} is empty`,
        evidence: { timeframe: tf },
      });
    }
    if (resolveTimeframeDurationSec(tf) == null && tf.toUpperCase() !== "MN1") {
      // MN1 is known calendar-based unsupported fixed duration — separate.
      if (!["MN1", "mn1"].includes(tf)) {
        // still may be unsupported mapping
      }
    }
  }

  for (const tf of input.requirement.optionalTimeframes ?? []) {
    const series = input.seriesByTimeframe[tf];
    if (series == null) {
      optionalMissing.push(tf);
      findings.push({
        code: MIF_QI_OPTIONAL_TIMEFRAME_MISSING,
        severity: "info",
        message: `optional timeframe ${tf} missing`,
        evidence: { timeframe: tf },
      });
    } else if (series.length === 0) {
      empty.push(tf);
      findings.push({
        code: MIF_QI_TIMEFRAME_EMPTY,
        severity: "warning",
        message: `optional timeframe ${tf} is empty`,
        evidence: { timeframe: tf },
      });
    }
  }

  for (const tf of supplied) {
    if (resolveTimeframeDurationSec(tf) == null) {
      unsupported.push(tf);
      findings.push({
        code: MIF_QI_TIMEFRAME_UNSUPPORTED,
        severity: "warning",
        message: `timeframe ${tf} has no trusted fixed-duration mapping (calendar intervals remain uncertain)`,
        evidence: { timeframe: tf },
      });
    }
  }

  return { supplied, requiredMissing, optionalMissing, empty, unsupported, findings };
}
