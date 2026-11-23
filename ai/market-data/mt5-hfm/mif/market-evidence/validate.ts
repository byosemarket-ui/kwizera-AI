/**
 * Phase 2 — runtime validation for unified market evidence.
 */
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import {
  MIF_MARKET_EVIDENCE_MAX_ITEMS,
  MIF_MARKET_EVIDENCE_MAX_LEVELS,
  MIF_MARKET_EVIDENCE_MAX_MEASUREMENTS,
  MIF_MARKET_EVIDENCE_MAX_REFS,
  MIF_MARKET_EVIDENCE_MAX_WARNINGS,
  MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID,
  MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_VERSION,
  MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID,
  MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION,
} from "./contracts.js";
import {
  isParseableIsoTimestamp,
  normalizeProviderSymbol,
} from "./integrity.js";
import type {
  MifEvidenceConfidenceType,
  MifEvidenceDirection,
  MifEvidenceValidationResult,
  MifMarketEvidencePackage,
  MifUnifiedMarketEvidence,
} from "./types.js";

const DIRECTIONS = new Set<MifEvidenceDirection>(["BULLISH", "BEARISH", "NEUTRAL"]);
const CONFIDENCE = new Set<MifEvidenceConfidenceType>([
  "DATA_CONFIDENCE",
  "PATTERN_CONFIDENCE",
  "STRUCTURE_CONFIDENCE",
  "SETUP_QUALITY",
  "DIRECTIONAL_PROBABILITY",
  "TRADE_OUTCOME_PROBABILITY",
  "ENGINE_SPECIFIC",
  "NONE",
]);

export function validateUnifiedMarketEvidence(
  item: unknown,
): MifEvidenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!item || typeof item !== "object") {
    return { ok: false, errors: ["EVIDENCE_NOT_OBJECT"], warnings };
  }
  const e = item as Partial<MifUnifiedMarketEvidence>;
  if (e.contractId !== MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_ID) {
    errors.push("INVALID_CONTRACT_ID");
  }
  if (e.contractVersion !== MIF_UNIFIED_MARKET_EVIDENCE_CONTRACT_VERSION) {
    errors.push("INVALID_CONTRACT_VERSION");
  }
  if (typeof e.evidenceId !== "string" || !e.evidenceId) errors.push("MISSING_EVIDENCE_ID");
  if (typeof e.sourceEngine !== "string" || !e.sourceEngine) errors.push("MISSING_SOURCE_ENGINE");
  if (typeof e.engineVersion !== "string" || !e.engineVersion) {
    errors.push("MISSING_ENGINE_VERSION");
  }
  if (e.providerId !== MIF_PROVIDER_ID) errors.push("PROVIDER_MUST_BE_HFM_MT5");
  if (typeof e.providerSymbol !== "string" || !e.providerSymbol) {
    errors.push("MISSING_PROVIDER_SYMBOL");
  }
  if (typeof e.evidenceType !== "string" || !e.evidenceType) errors.push("MISSING_EVIDENCE_TYPE");
  if (!DIRECTIONS.has(e.direction as MifEvidenceDirection)) errors.push("INVALID_DIRECTION");
  if (!isParseableIsoTimestamp(e.observedAt)) errors.push("INVALID_OBSERVED_AT");
  if (e.eventTime != null && !isParseableIsoTimestamp(e.eventTime)) {
    warnings.push("INVALID_EVENT_TIME");
  }
  if (!e.score || typeof e.score !== "object") {
    errors.push("MISSING_SCORE");
  } else {
    if (!CONFIDENCE.has(e.score.confidenceType)) errors.push("UNKNOWN_CONFIDENCE_TYPE");
    if (typeof e.score.isWinProbability !== "boolean") errors.push("MISSING_IS_WIN_PROBABILITY");
    if (typeof e.score.definition !== "string" || !e.score.definition) {
      errors.push("MISSING_SCORE_DEFINITION");
    }
    if (
      e.score.confidenceType === "SETUP_QUALITY"
      && e.score.isWinProbability === true
    ) {
      errors.push("SETUP_QUALITY_CANNOT_BE_WIN_PROBABILITY");
    }
    if (
      e.score.isWinProbability === true
      && e.score.confidenceType !== "TRADE_OUTCOME_PROBABILITY"
      && e.score.confidenceType !== "DIRECTIONAL_PROBABILITY"
    ) {
      warnings.push("WIN_PROBABILITY_FLAG_WITH_UNEXPECTED_CONFIDENCE_TYPE");
    }
  }
  if (!e.provenance || typeof e.provenance !== "object") {
    errors.push("MISSING_PROVENANCE");
  } else if (
    typeof e.provenance.sourceFingerprint !== "string"
    || !e.provenance.sourceFingerprint
  ) {
    errors.push("MISSING_SOURCE_FINGERPRINT");
  } else if (
    e.provenance.snapshotId != null
    && e.provenance.snapshotIdSourceVerified !== true
    && e.provenance.snapshotIdSourceVerified !== false
  ) {
    errors.push("MISSING_SNAPSHOT_VERIFIED_FLAG");
  }
  if (e.placesOrders !== false || e.mutatesBroker !== false || e.acceptsForExecution !== false) {
    errors.push("SAFETY_FLAGS_MUST_BE_FALSE");
  }
  if (e.doesNotApproveAiReasoning !== true) errors.push("MUST_NOT_APPROVE_AI_REASONING");
  if (Array.isArray(e.levels) && e.levels.length > MIF_MARKET_EVIDENCE_MAX_LEVELS) {
    errors.push("LEVELS_OVERFLOW");
  }
  if (
    Array.isArray(e.measurements)
    && e.measurements.length > MIF_MARKET_EVIDENCE_MAX_MEASUREMENTS
  ) {
    errors.push("MEASUREMENTS_OVERFLOW");
  }
  if (
    Array.isArray(e.supportingEvidenceIds)
    && e.supportingEvidenceIds.length > MIF_MARKET_EVIDENCE_MAX_REFS
  ) {
    errors.push("SUPPORTING_REFS_OVERFLOW");
  }
  if (
    Array.isArray(e.conflictingEvidenceIds)
    && e.conflictingEvidenceIds.length > MIF_MARKET_EVIDENCE_MAX_REFS
  ) {
    errors.push("CONFLICTING_REFS_OVERFLOW");
  }
  if (Array.isArray(e.warnings) && e.warnings.length > MIF_MARKET_EVIDENCE_MAX_WARNINGS) {
    errors.push("WARNINGS_OVERFLOW");
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateMarketEvidencePackage(
  pkg: unknown,
): MifEvidenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!pkg || typeof pkg !== "object") {
    return { ok: false, errors: ["PACKAGE_NOT_OBJECT"], warnings };
  }
  const p = pkg as Partial<MifMarketEvidencePackage>;
  if (p.contractId !== MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID) {
    errors.push("INVALID_PACKAGE_CONTRACT_ID");
  }
  if (p.contractVersion !== MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_VERSION) {
    errors.push("INVALID_PACKAGE_CONTRACT_VERSION");
  }
  if (p.providerId !== MIF_PROVIDER_ID) errors.push("PROVIDER_MUST_BE_HFM_MT5");
  if (!Array.isArray(p.items)) {
    errors.push("ITEMS_NOT_ARRAY");
  } else {
    if (p.items.length > MIF_MARKET_EVIDENCE_MAX_ITEMS) errors.push("ITEMS_OVERFLOW");
    const pkgSym = normalizeProviderSymbol(p.providerSymbol);
    const pkgSnap = p.snapshotId ?? null;
    const keptIds = new Set(
      p.items
        .map((it) => (it && typeof it === "object" ? (it as MifUnifiedMarketEvidence).evidenceId : null))
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    for (let i = 0; i < p.items.length; i++) {
      const vr = validateUnifiedMarketEvidence(p.items[i]);
      if (!vr.ok) {
        errors.push(`ITEM_${i}:${vr.errors.join(",")}`);
      }
      warnings.push(...vr.warnings.map((w) => `ITEM_${i}:${w}`));
      const item = p.items[i] as MifUnifiedMarketEvidence | undefined;
      if (!item || typeof item !== "object") continue;
      const itemSym = normalizeProviderSymbol(item.providerSymbol);
      if (pkgSym && itemSym && itemSym !== pkgSym) {
        warnings.push(`ITEM_${i}:SYMBOL_MISMATCH expected=${pkgSym} got=${itemSym}`);
      }
      const itemSnap = item.provenance?.snapshotId ?? null;
      if (pkgSnap && itemSnap && String(itemSnap) !== String(pkgSnap)) {
        warnings.push(`ITEM_${i}:SNAPSHOT_MISMATCH`);
      }
      for (const id of item.supportingEvidenceIds ?? []) {
        if (!keptIds.has(id)) warnings.push(`ITEM_${i}:DANGLING_SUPPORT_REF=${id}`);
      }
      for (const id of item.conflictingEvidenceIds ?? []) {
        if (!keptIds.has(id)) warnings.push(`ITEM_${i}:DANGLING_CONFLICT_REF=${id}`);
      }
    }
  }
  if (p.placesOrders !== false || p.mutatesBroker !== false || p.acceptsForExecution !== false) {
    errors.push("SAFETY_FLAGS_MUST_BE_FALSE");
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function assertValidEvidenceOrThrow(item: MifUnifiedMarketEvidence): void {
  const r = validateUnifiedMarketEvidence(item);
  if (!r.ok) {
    throw new Error(`Invalid unified market evidence: ${r.errors.join("; ")}`);
  }
}
