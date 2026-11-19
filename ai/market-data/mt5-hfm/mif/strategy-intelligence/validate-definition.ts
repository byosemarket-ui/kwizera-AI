/**
 * Phase 5D Step 1 — strategy definition validation (fail closed; no silent repair).
 */
import { MIF_SUPPORTED_FIXED_TIMEFRAMES } from "../quality/multi-timeframe/requirements.js";
import { MIF_EVIDENCE_FAMILY_CATALOG } from "./evidence.js";
import type {
  MifStrategyDefinition,
  MifStrategyDefinitionValidation,
  MifTimeframeRole,
} from "./types.js";

const VALID_ROLES: readonly MifTimeframeRole[] = [
  "MACRO_CONTEXT",
  "MAJOR_CONTEXT",
  "PRIMARY_DIRECTION",
  "INTERMEDIATE_STRUCTURE",
  "SETUP_DEVELOPMENT",
  "OPPORTUNITY_FORMATION",
  "LOWER_TIMEFRAME_CONFIRMATION",
  "OPTIONAL_ENTRY_REFINEMENT",
];

const VALID_CATEGORIES = new Set([
  "TREND_FOLLOWING",
  "COUNTERTREND",
  "BREAKOUT",
  "RANGE",
  "LIQUIDITY",
  "SUPPLY_DEMAND",
  "MOMENTUM",
  "PATTERN_BASED",
]);

const VALID_LIFECYCLES = new Set(["DRAFT", "ACTIVE", "DISABLED", "DEPRECATED"]);

export function validateMifStrategyDefinition(
  def: MifStrategyDefinition | null | undefined,
): MifStrategyDefinitionValidation {
  const errors: string[] = [];
  if (!def) return { ok: false, errors: ["definition missing"] };

  if (!def.strategyId?.trim()) errors.push("strategyId missing");
  if (!def.name?.trim()) errors.push("name missing");
  if (!def.description?.trim()) errors.push("description missing");
  if (!def.purpose?.trim()) errors.push("purpose missing");
  if (!def.definitionVersion?.trim()) errors.push("definitionVersion missing");
  if (!/^\d+\.\d+\.\d+$/.test(def.definitionVersion ?? "")) {
    errors.push("definitionVersion must be semver-like MAJOR.MINOR.PATCH");
  }
  if (!def.policyVersion?.trim()) errors.push("policyVersion missing");
  if (!VALID_LIFECYCLES.has(def.lifecycleStatus)) errors.push("invalid lifecycleStatus");
  if (!def.categories?.length) errors.push("categories empty");
  for (const c of def.categories ?? []) {
    if (!VALID_CATEGORIES.has(c)) errors.push(`invalid category ${c}`);
  }

  if (def.placesOrders !== false) errors.push("placesOrders must be false");
  if (def.mutatesBroker !== false) errors.push("mutatesBroker must be false");
  if (def.acceptsForExecution !== false) errors.push("acceptsForExecution must be false");
  if (def.doesNotApproveAiReasoning !== true) errors.push("doesNotApproveAiReasoning must be true");
  if (def.doesNotCreateOpportunities !== true) errors.push("doesNotCreateOpportunities must be true");

  if (!def.requiredEvidence?.length) errors.push("requiredEvidence empty");
  const ids = new Set<string>();
  for (const e of [...(def.requiredEvidence ?? []), ...(def.optionalEvidence ?? [])]) {
    if (!e.evidenceId?.trim()) errors.push("evidenceId missing");
    if (ids.has(e.evidenceId)) errors.push(`duplicate evidenceId ${e.evidenceId}`);
    ids.add(e.evidenceId);
    if (!(e.family in MIF_EVIDENCE_FAMILY_CATALOG)) errors.push(`invalid evidence family ${e.family}`);
    if (e.mode !== "REQUIRED" && e.mode !== "OPTIONAL") errors.push(`invalid mode for ${e.evidenceId}`);
    // ACTIVE strategies must not REQUIRE UNSUPPORTED evidence.
    if (
      def.lifecycleStatus === "ACTIVE"
      && e.mode === "REQUIRED"
      && e.availability === "UNSUPPORTED"
    ) {
      errors.push(`ACTIVE strategy cannot require UNSUPPORTED evidence ${e.evidenceId}`);
    }
    // Contradictory: required + missingAffects IGNORE is invalid.
    if (e.mode === "REQUIRED" && e.missingAffects === "IGNORE") {
      errors.push(`required evidence ${e.evidenceId} cannot use missingAffects=IGNORE`);
    }
    // Optional evidence listed under requiredEvidence array is a schema contradiction.
  }
  for (const e of def.requiredEvidence ?? []) {
    if (e.mode !== "REQUIRED") {
      errors.push(`requiredEvidence entry ${e.evidenceId} must have mode=REQUIRED`);
    }
  }
  for (const e of def.optionalEvidence ?? []) {
    if (e.mode !== "OPTIONAL") {
      errors.push(`optionalEvidence entry ${e.evidenceId} must have mode=OPTIONAL`);
    }
  }

  if (!def.timeframeRoles?.length) errors.push("timeframeRoles empty");
  for (const r of def.timeframeRoles ?? []) {
    if (!VALID_ROLES.includes(r.role)) errors.push(`invalid timeframe role ${r.role}`);
    for (const tf of r.typicalTimeframes ?? []) {
      if (!(MIF_SUPPORTED_FIXED_TIMEFRAMES as readonly string[]).includes(tf)) {
        errors.push(`unsupported timeframe ${tf} on role ${r.role}`);
      }
    }
  }

  const rc = def.regimeCompatibility;
  if (!rc) errors.push("regimeCompatibility missing");
  else {
    if (!Array.isArray(rc.directions)) errors.push("regimeCompatibility.directions invalid");
    if (!Array.isArray(rc.structures)) errors.push("regimeCompatibility.structures invalid");
    if (!Array.isArray(rc.volatilities)) errors.push("regimeCompatibility.volatilities invalid");
  }

  if (!def.confirmations?.length) errors.push("confirmations empty");
  if (!def.invalidations?.length) errors.push("invalidations empty");
  if (def.dataQualityMinStatus !== "VALID" && def.dataQualityMinStatus !== "WARNING") {
    errors.push("dataQualityMinStatus must be VALID or WARNING");
  }

  return { ok: errors.length === 0, errors };
}
