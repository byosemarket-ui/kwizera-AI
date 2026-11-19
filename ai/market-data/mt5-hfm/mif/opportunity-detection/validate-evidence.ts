/**
 * Phase 5D Step 2 — detector evidence validation against strategy requirements.
 */
import type { MifStrategyDefinition } from "../strategy-intelligence/types.js";
import {
  MIF_OD_BLOCKED_BY_DATA_QUALITY,
  MIF_OD_DUPLICATE_EVIDENCE,
  MIF_OD_INSUFFICIENT_EVIDENCE,
} from "./codes.js";
import type {
  MifDetectionEvidenceRef,
  MifEvidenceValidationResult,
  MifOpportunityDetectionContext,
} from "./types.js";

export function validateDetectorEvidence(input: {
  strategy: MifStrategyDefinition;
  context: MifOpportunityDetectionContext;
  /** Detector-required evidence IDs beyond strategy catalog (optional). */
  extraRequiredEvidenceIds?: readonly string[];
}): MifEvidenceValidationResult {
  const missingRequired: string[] = [];
  const failed: string[] = [];
  const warnings: string[] = [];
  const reasonCodes: MifEvidenceValidationResult["reasonCodes"] = [];

  const byId = new Map<string, MifDetectionEvidenceRef>();
  const sourceCounts = new Map<string, number>();
  for (const e of input.context.evidence) {
    byId.set(e.evidenceId, e);
    if (e.sourceAssessmentId) {
      sourceCounts.set(e.sourceAssessmentId, (sourceCounts.get(e.sourceAssessmentId) ?? 0) + 1);
    }
  }
  const duplicateSourceAssessmentIds = [...sourceCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id);
  if (duplicateSourceAssessmentIds.length) {
    warnings.push(
      `duplicate source assessment refs (not double-counted as independent): ${duplicateSourceAssessmentIds.join(",")}`,
    );
    reasonCodes.push(MIF_OD_DUPLICATE_EVIDENCE);
  }

  if (input.context.dataQualityStatus === "BLOCKED" || input.context.dataQualityStatus === "MISSING") {
    reasonCodes.push(MIF_OD_BLOCKED_BY_DATA_QUALITY);
    return {
      ok: false,
      missingRequired,
      failed: [`dataQuality ${input.context.dataQualityStatus}`],
      warnings,
      duplicateSourceAssessmentIds,
      reasonCodes,
      explanation: `blocked by data quality ${input.context.dataQualityStatus}`,
    };
  }

  for (const req of input.strategy.requiredEvidence) {
    const hit = byId.get(req.evidenceId)
      ?? [...byId.values()].find((e) => e.family === req.family);
    if (!hit || hit.presence === "ABSENT") {
      missingRequired.push(req.evidenceId);
      continue;
    }
    if (hit.presence === "INVALID" || hit.qualityStatus === "BLOCKED") {
      failed.push(req.evidenceId);
      continue;
    }
    if (hit.presence === "UNKNOWN" && !req.allowUnknown) {
      missingRequired.push(req.evidenceId);
      continue;
    }
    if (hit.candleState === "STALE") {
      warnings.push(`evidence ${req.evidenceId} STALE`);
    }
    if (hit.candleState === "FORMING" && req.requireClosedCandle) {
      failed.push(req.evidenceId);
    }
  }

  for (const id of input.extraRequiredEvidenceIds ?? []) {
    if (!byId.has(id)) missingRequired.push(id);
  }

  // Optional missing → warnings only when strategy says so
  for (const req of input.strategy.optionalEvidence) {
    const hit = byId.get(req.evidenceId)
      ?? [...byId.values()].find((e) => e.family === req.family);
    if (!hit || hit.presence === "ABSENT") {
      if (req.missingAffects === "WARNING") warnings.push(`optional missing ${req.evidenceId}`);
    }
  }

  if (missingRequired.length) reasonCodes.push(MIF_OD_INSUFFICIENT_EVIDENCE);
  const ok = missingRequired.length === 0 && failed.length === 0
    && !reasonCodes.includes(MIF_OD_BLOCKED_BY_DATA_QUALITY);

  return {
    ok,
    missingRequired,
    failed,
    warnings,
    duplicateSourceAssessmentIds,
    reasonCodes: [...new Set(reasonCodes)],
    explanation: ok
      ? "evidence validation passed"
      : `missing=[${missingRequired.join(",")}] failed=[${failed.join(",")}]`,
  };
}
