/**
 * Charts-facing Phase 3 interface.
 * Charts must not import individual MIF engines — use this bridge only.
 */
import type { HfmAnalysisMultiTfSnapshot } from "../../analysis/types.js";
import {
  MIF_ORCHESTRATION_DEADLINE_MS,
  MIF_ORCHESTRATION_TF_PACK,
} from "./contracts.js";
import { runHfmIntelligenceOrchestration } from "./run-orchestration.js";
import type { MifOrchestrationResult } from "./types.js";

export interface HfmChartsIntelligenceRequest {
  snapshot: HfmAnalysisMultiTfSnapshot;
  correlationId?: string | null;
  deadlineMs?: number;
}

/**
 * Clean Charts → MIF orchestration entry.
 * Fail-open: returns FAILED/SKIPPED/PARTIAL without throwing on ordinary errors.
 * Persists OD run/candidates linked to the Charts snapshot (async).
 */
export async function runChartsIntelligenceOrchestration(
  input: HfmChartsIntelligenceRequest,
): Promise<MifOrchestrationResult> {
  return runHfmIntelligenceOrchestration({
    snapshot: input.snapshot,
    correlationId: input.correlationId,
    timeframePack: MIF_ORCHESTRATION_TF_PACK,
    deadlineMs: input.deadlineMs ?? MIF_ORCHESTRATION_DEADLINE_MS,
  });
}
