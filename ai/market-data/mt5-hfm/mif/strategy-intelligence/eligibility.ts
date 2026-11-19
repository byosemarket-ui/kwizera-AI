/**
 * Phase 5D Step 1 — evaluateStrategyEligibility (pure, deterministic).
 * ELIGIBLE_FOR_DETECTION ≠ opportunity / signal / trade / AI approval.
 */
import {
  MIF_SI_DATA_QUALITY_BLOCKED,
  MIF_SI_FAILED_REQUIREMENT,
  MIF_SI_INSUFFICIENT_EVIDENCE,
  MIF_SI_LIFECYCLE_BLOCKED,
  MIF_SI_MISSING_REQUIRED_EVIDENCE,
  MIF_SI_OK,
  MIF_SI_REGIME_INCOMPATIBLE,
  MIF_SI_TIMEFRAME_ROLE_MISSING,
  MIF_SI_UNKNOWN_STRATEGY,
  MIF_SI_UNSUPPORTED_EVIDENCE,
  type MifStrategyIntelligenceReasonCode,
} from "./codes.js";
import {
  MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID,
  MIF_STRATEGY_INTELLIGENCE_CONTRACT_VERSION,
} from "./contracts.js";
import { lifecycleAllowsDetection } from "./lifecycle.js";
import type {
  MifStrategyDefinition,
  MifStrategyEligibilityResult,
  MifStrategyEligibilityStatus,
  MifStrategyEvidenceRequirement,
  MifStrategyEvidenceSummary,
  MifStrategyEvidenceSummaryItem,
  MifStrategyRequirementEvaluation,
} from "./types.js";

function findEvidence(
  summary: MifStrategyEvidenceSummary,
  req: MifStrategyEvidenceRequirement,
): MifStrategyEvidenceSummaryItem | undefined {
  return summary.evidence.find((e) => e.evidenceId === req.evidenceId || e.family === req.family);
}

function evaluateOne(
  req: MifStrategyEvidenceRequirement,
  summary: MifStrategyEvidenceSummary,
): MifStrategyRequirementEvaluation {
  if (req.availability === "UNSUPPORTED" && req.mode === "REQUIRED") {
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "UNSUPPORTED",
      message: `required evidence ${req.evidenceId} is UNSUPPORTED upstream`,
    };
  }

  const item = findEvidence(summary, req);
  if (!item) {
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "MISSING",
      message: `evidence ${req.evidenceId} absent from summary`,
    };
  }

  if (item.presence === "UNSUPPORTED") {
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "UNSUPPORTED",
      message: `evidence ${req.evidenceId} marked UNSUPPORTED`,
    };
  }

  if (item.presence === "UNKNOWN") {
    if (req.allowUnknown) {
      return {
        evidenceId: req.evidenceId,
        family: req.family,
        mode: req.mode,
        outcome: "SATISFIED",
        message: `evidence ${req.evidenceId} UNKNOWN allowed by requirement`,
      };
    }
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "UNKNOWN",
      message: `evidence ${req.evidenceId} is UNKNOWN`,
    };
  }

  if (item.presence === "INVALID") {
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "FAILED",
      message: `evidence ${req.evidenceId} INVALID`,
    };
  }

  if (item.presence === "ABSENT") {
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "MISSING",
      message: `evidence ${req.evidenceId} ABSENT`,
    };
  }

  // PRESENT
  if (item.qualityStatus === "BLOCKED" || item.qualityStatus === "MISSING") {
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "FAILED",
      message: `evidence ${req.evidenceId} quality ${item.qualityStatus}`,
    };
  }
  if (
    item.qualityStatus !== "UNKNOWN"
    && !req.minQualityStatuses.includes(item.qualityStatus as "VALID" | "WARNING" | "DEGRADED")
  ) {
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "FAILED",
      message: `evidence ${req.evidenceId} quality ${item.qualityStatus} below minimum`,
    };
  }
  if (req.requireClosedCandle && item.closedCandleSatisfied === false) {
    return {
      evidenceId: req.evidenceId,
      family: req.family,
      mode: req.mode,
      outcome: "FAILED",
      message: `evidence ${req.evidenceId} requires closed-candle confirmation`,
    };
  }

  return {
    evidenceId: req.evidenceId,
    family: req.family,
    mode: req.mode,
    outcome: "SATISFIED",
    message: `evidence ${req.evidenceId} satisfied`,
  };
}

function regimeCompatible(def: MifStrategyDefinition, summary: MifStrategyEvidenceSummary): boolean {
  const rc = def.regimeCompatibility;
  const dir = summary.regimeDirection ?? null;
  const struct = summary.regimeStructure ?? null;
  const vol = summary.regimeVolatility ?? null;

  if (rc.rejectUnknown) {
    if (dir === "UNKNOWN" || dir == null) return false;
    if (struct === "UNKNOWN" || struct == null) return false;
  }
  if (dir != null && rc.directions.length && !rc.directions.includes(dir)) return false;
  if (struct != null && rc.structures.length && !rc.structures.includes(struct)) return false;
  if (vol != null && vol !== "UNKNOWN" && rc.volatilities.length && !rc.volatilities.includes(vol)) {
    return false;
  }
  return true;
}

/**
 * Evaluate whether a strategy definition's requirements are satisfied by an evidence summary.
 * Does not create opportunities or trade signals.
 */
export function evaluateStrategyEligibility(input: {
  definition: MifStrategyDefinition | null | undefined;
  summary: MifStrategyEvidenceSummary;
}): MifStrategyEligibilityResult {
  const base = {
    contractId: MIF_STRATEGY_INTELLIGENCE_CONTRACT_ID,
    contractVersion: MIF_STRATEGY_INTELLIGENCE_CONTRACT_VERSION,
    placesOrders: false as const,
    mutatesBroker: false as const,
    acceptsForExecution: false as const,
    doesNotApproveAiReasoning: true as const,
    doesNotCreateOpportunities: true as const,
    eligibleForDetectionOnly: true as const,
  };

  if (!input.definition) {
    return {
      ...base,
      strategyId: "UNKNOWN",
      definitionVersion: null,
      policyVersion: null,
      status: "INELIGIBLE",
      satisfied: [],
      missing: [],
      failed: [],
      unsupported: [],
      warnings: [],
      reasonCodes: [MIF_SI_UNKNOWN_STRATEGY],
      explanation: "strategy definition missing",
    };
  }

  const def = input.definition;
  const summary = input.summary;
  const reasonCodes: MifStrategyIntelligenceReasonCode[] = [];
  const warnings: string[] = [];
  const satisfied: MifStrategyRequirementEvaluation[] = [];
  const missing: MifStrategyRequirementEvaluation[] = [];
  const failed: MifStrategyRequirementEvaluation[] = [];
  const unsupported: MifStrategyRequirementEvaluation[] = [];

  const finish = (
    status: MifStrategyEligibilityStatus,
    explanation: string,
  ): MifStrategyEligibilityResult => ({
    ...base,
    strategyId: def.strategyId,
    definitionVersion: def.definitionVersion,
    policyVersion: def.policyVersion,
    status,
    satisfied,
    missing,
    failed,
    unsupported,
    warnings,
    reasonCodes: reasonCodes.length ? reasonCodes : [MIF_SI_OK],
    explanation,
  });

  if (def.lifecycleStatus === "DRAFT") {
    reasonCodes.push(MIF_SI_LIFECYCLE_BLOCKED);
    return finish("DRAFT", "strategy lifecycle is DRAFT — not eligible for detection");
  }
  if (def.lifecycleStatus === "DISABLED") {
    reasonCodes.push(MIF_SI_LIFECYCLE_BLOCKED);
    return finish("DISABLED", "strategy lifecycle is DISABLED");
  }
  if (def.lifecycleStatus === "DEPRECATED") {
    reasonCodes.push(MIF_SI_LIFECYCLE_BLOCKED);
    return finish("DEPRECATED", "strategy lifecycle is DEPRECATED");
  }
  if (!lifecycleAllowsDetection(def.lifecycleStatus)) {
    reasonCodes.push(MIF_SI_LIFECYCLE_BLOCKED);
    return finish("INELIGIBLE", `lifecycle ${def.lifecycleStatus} does not allow detection`);
  }

  // Data quality gate
  if (summary.dataQualityStatus === "BLOCKED" || summary.dataQualityStatus === "MISSING") {
    reasonCodes.push(MIF_SI_DATA_QUALITY_BLOCKED);
    return finish("BLOCKED_BY_DATA_QUALITY", `data quality ${summary.dataQualityStatus}`);
  }
  if (summary.dataQualityStatus === "DEGRADED" && def.dataQualityMinStatus === "VALID") {
    reasonCodes.push(MIF_SI_DATA_QUALITY_BLOCKED);
    return finish("BLOCKED_BY_DATA_QUALITY", "data quality DEGRADED below strategy minimum VALID");
  }
  if (summary.dataQualityStatus === "DEGRADED") {
    warnings.push("data quality DEGRADED");
  }
  if (summary.dataQualityStatus === "WARNING") {
    warnings.push("data quality WARNING");
  }

  // Timeframe roles
  const availableRoles = new Set(summary.availableTimeframeRoles ?? []);
  for (const roleReq of def.timeframeRoles) {
    if (roleReq.mode !== "REQUIRED") continue;
    if (!availableRoles.has(roleReq.role)) {
      reasonCodes.push(MIF_SI_TIMEFRAME_ROLE_MISSING);
      missing.push({
        evidenceId: `role:${roleReq.role}`,
        family: "MULTI_TIMEFRAME_RELATIONSHIP",
        mode: "REQUIRED",
        outcome: "MISSING",
        message: `required timeframe role ${roleReq.role} unavailable`,
      });
    }
  }

  // Regime compatibility (when regime dims provided)
  if (
    summary.regimeDirection != null
    || summary.regimeStructure != null
    || summary.regimeVolatility != null
  ) {
    if (!regimeCompatible(def, summary)) {
      reasonCodes.push(MIF_SI_REGIME_INCOMPATIBLE);
      failed.push({
        evidenceId: "regime.compatibility",
        family: "MARKET_REGIME",
        mode: "REQUIRED",
        outcome: "FAILED",
        message: "regime dimensions incompatible with strategy policy",
      });
    }
  }

  for (const req of def.requiredEvidence) {
    const ev = evaluateOne(req, summary);
    if (ev.outcome === "SATISFIED") satisfied.push(ev);
    else if (ev.outcome === "MISSING" || ev.outcome === "UNKNOWN") {
      missing.push(ev);
      if (req.missingAffects === "WARNING") warnings.push(ev.message);
    } else if (ev.outcome === "UNSUPPORTED") {
      unsupported.push(ev);
      reasonCodes.push(MIF_SI_UNSUPPORTED_EVIDENCE);
    } else {
      failed.push(ev);
      reasonCodes.push(MIF_SI_FAILED_REQUIREMENT);
    }
  }

  for (const req of def.optionalEvidence) {
    const ev = evaluateOne(req, summary);
    if (ev.outcome === "SATISFIED") satisfied.push(ev);
    else if (ev.outcome === "MISSING" || ev.outcome === "UNKNOWN") {
      if (req.missingAffects === "WARNING") warnings.push(`optional ${ev.message}`);
      // IGNORE → no status impact
    } else if (ev.outcome === "UNSUPPORTED") {
      warnings.push(`optional unsupported: ${ev.message}`);
    } else if (ev.outcome === "FAILED" && req.missingAffects === "WARNING") {
      warnings.push(ev.message);
    }
  }

  // PATTERN_COMPLETION: require at least one of geometric/harmonic PRESENT
  if (def.strategyId === "PATTERN_COMPLETION") {
    const geo = summary.evidence.find((e) => e.evidenceId === "pc.geometric" || e.family === "GEOMETRIC_PATTERN");
    const har = summary.evidence.find((e) => e.evidenceId === "pc.harmonic" || e.family === "HARMONIC_PATTERN");
    const ok =
      geo?.presence === "PRESENT" || har?.presence === "PRESENT";
    if (!ok) {
      missing.push({
        evidenceId: "pc.pattern_any",
        family: "GEOMETRIC_PATTERN",
        mode: "REQUIRED",
        outcome: "MISSING",
        message: "PATTERN_COMPLETION requires geometric or harmonic evidence PRESENT",
      });
      reasonCodes.push(MIF_SI_MISSING_REQUIRED_EVIDENCE);
    }
  }

  if (failed.length || unsupported.length) {
    if (unsupported.length) {
      return finish("INELIGIBLE", "unsupported required evidence present");
    }
    return finish("INELIGIBLE", failed.map((f) => f.message).join("; "));
  }

  if (missing.length) {
    const affectsIneligible = def.requiredEvidence.some(
      (r) =>
        r.missingAffects === "INELIGIBLE"
        && missing.some((m) => m.evidenceId === r.evidenceId || m.evidenceId.startsWith("role:")),
    );
    // Also pattern_any / role missing
    const roleMissing = missing.some((m) => m.evidenceId.startsWith("role:"));
    const patternMissing = missing.some((m) => m.evidenceId === "pc.pattern_any");
    reasonCodes.push(MIF_SI_MISSING_REQUIRED_EVIDENCE);
    if (affectsIneligible && !roleMissing && !patternMissing) {
      // quality missing etc.
    }
    const hard =
      roleMissing
      || patternMissing
      || def.requiredEvidence.some(
        (r) =>
          (r.missingAffects === "INELIGIBLE" || r.missingAffects === "INSUFFICIENT_EVIDENCE")
          && missing.some((m) => m.evidenceId === r.evidenceId),
      );
    if (hard) {
      reasonCodes.push(MIF_SI_INSUFFICIENT_EVIDENCE);
      return finish(
        missing.some((m) => {
          const req = def.requiredEvidence.find((r) => r.evidenceId === m.evidenceId);
          return req?.missingAffects === "INELIGIBLE";
        })
          && !roleMissing
          && !patternMissing
          ? "INELIGIBLE"
          : "INSUFFICIENT_EVIDENCE",
        missing.map((m) => m.message).join("; "),
      );
    }
  }

  if (reasonCodes.includes(MIF_SI_REGIME_INCOMPATIBLE)) {
    return finish("INELIGIBLE", "regime incompatible with strategy");
  }

  reasonCodes.push(MIF_SI_OK);
  return finish(
    "ELIGIBLE_FOR_DETECTION",
    "requirements satisfied for detection evaluation only — not an opportunity or trade signal",
  );
}
