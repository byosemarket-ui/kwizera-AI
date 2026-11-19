/**
 * Phase 5D Step 2 — detector definition validation.
 */
import type { MifStrategyIntelligenceRegistry } from "../strategy-intelligence/registry.js";
import {
  MIF_OD_DETECTOR_INVALID,
  MIF_OD_STRATEGY_MISSING,
  MIF_OD_STRATEGY_NOT_ACTIVE,
} from "./codes.js";
import { MIF_OPPORTUNITY_DETECTION_POLICY_ID } from "./contracts.js";
import type { MifOpportunityDetector, MifOpportunityDetectorDefinition } from "./types.js";

const SEMVER = /^\d+\.\d+\.\d+$/;

export interface MifDetectorDefinitionValidation {
  ok: boolean;
  errors: string[];
  reasonCodes: Array<
    typeof MIF_OD_DETECTOR_INVALID | typeof MIF_OD_STRATEGY_MISSING | typeof MIF_OD_STRATEGY_NOT_ACTIVE
  >;
}

export function validateOpportunityDetectorDefinition(
  def: MifOpportunityDetectorDefinition | MifOpportunityDetector | null | undefined,
  strategyRegistry: MifStrategyIntelligenceRegistry,
): MifDetectorDefinitionValidation {
  const errors: string[] = [];
  const reasonCodes: MifDetectorDefinitionValidation["reasonCodes"] = [];

  if (!def) {
    return { ok: false, errors: ["detector missing"], reasonCodes: [MIF_OD_DETECTOR_INVALID] };
  }
  if (!def.detectorId?.trim()) {
    errors.push("detectorId missing");
    reasonCodes.push(MIF_OD_DETECTOR_INVALID);
  }
  if (!def.strategyId?.trim()) {
    errors.push("strategyId missing");
    reasonCodes.push(MIF_OD_DETECTOR_INVALID);
  }
  if (!SEMVER.test(String(def.detectorVersion || ""))) {
    errors.push("detectorVersion must be semver x.y.z");
    reasonCodes.push(MIF_OD_DETECTOR_INVALID);
  }
  if (!SEMVER.test(String(def.policyVersion || ""))) {
    errors.push("policyVersion must be semver x.y.z");
    reasonCodes.push(MIF_OD_DETECTOR_INVALID);
  }
  if (!["ACTIVE", "DISABLED", "UNAVAILABLE"].includes(def.availabilityStatus)) {
    errors.push("availabilityStatus invalid");
    reasonCodes.push(MIF_OD_DETECTOR_INVALID);
  }
  if (def.placesOrders !== false || def.mutatesBroker !== false || def.acceptsForExecution !== false) {
    errors.push("safety flags must be false");
    reasonCodes.push(MIF_OD_DETECTOR_INVALID);
  }
  if (def.doesNotApproveAiReasoning !== true) {
    errors.push("doesNotApproveAiReasoning must be true");
    reasonCodes.push(MIF_OD_DETECTOR_INVALID);
  }
  if (!Array.isArray(def.supportedTimeframeRoles)) {
    errors.push("supportedTimeframeRoles required");
    reasonCodes.push(MIF_OD_DETECTOR_INVALID);
  }

  const strategy = strategyRegistry.getStrategy(def.strategyId);
  if (!strategy) {
    errors.push(`strategy ${def.strategyId} not in registry`);
    reasonCodes.push(MIF_OD_STRATEGY_MISSING);
  } else if (strategy.lifecycleStatus !== "ACTIVE") {
    // May still register as DISABLED/UNAVAILABLE for diagnostics, but ACTIVE detectors
    // cannot target non-ACTIVE strategies.
    if (def.availabilityStatus === "ACTIVE") {
      errors.push(
        `cannot activate detector for strategy ${def.strategyId} lifecycle ${strategy.lifecycleStatus}`,
      );
      reasonCodes.push(MIF_OD_STRATEGY_NOT_ACTIVE);
    }
  }

  // Policy id is framework-owned; detector policyVersion should align with OD policy when ACTIVE.
  if (
    def.availabilityStatus === "ACTIVE"
    && def.policyVersion
    && !def.notes?.includes(MIF_OPPORTUNITY_DETECTION_POLICY_ID)
  ) {
    // informational only — do not fail; version string is the binding check
  }

  if (typeof (def as MifOpportunityDetector).evaluate !== "function") {
    // Definition-only validation path may omit evaluate; full detector requires it.
    if ("evaluate" in (def as object)) {
      errors.push("evaluate must be a function");
      reasonCodes.push(MIF_OD_DETECTOR_INVALID);
    }
  }

  return { ok: errors.length === 0, errors, reasonCodes: [...new Set(reasonCodes)] };
}

export function validateOpportunityDetector(
  detector: MifOpportunityDetector | null | undefined,
  strategyRegistry: MifStrategyIntelligenceRegistry,
): MifDetectorDefinitionValidation {
  const base = validateOpportunityDetectorDefinition(detector, strategyRegistry);
  if (!detector) return base;
  if (typeof detector.evaluate !== "function") {
    return {
      ok: false,
      errors: [...base.errors, "evaluate must be a function"],
      reasonCodes: [...new Set([...base.reasonCodes, MIF_OD_DETECTOR_INVALID])],
    };
  }
  return base;
}
