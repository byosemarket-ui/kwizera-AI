/**
 * Phase 2 — deterministic evidence deduplication and conflict relations.
 * Never silently deletes genuine bullish/bearish conflicts.
 */
import type {
  MifEvidenceRelation,
  MifEvidenceRelationKind,
  MifUnifiedMarketEvidence,
} from "./types.js";

function fingerprintKey(e: MifUnifiedMarketEvidence): string {
  return [
    e.provenance.sourceFingerprint,
    e.provenance.snapshotId ?? "",
    e.timeframe ?? "",
    e.providerSymbol,
    e.sourceEngine,
    e.evidenceType,
  ].join("|");
}

/**
 * Exact duplicate: same source fingerprint + snapshot + TF + symbol + engine + type.
 * Different snapshots with identical measurements remain distinct.
 */
export function classifyEvidencePair(
  a: MifUnifiedMarketEvidence,
  b: MifUnifiedMarketEvidence,
): MifEvidenceRelationKind {
  if (a.evidenceId === b.evidenceId || fingerprintKey(a) === fingerprintKey(b)) {
    return "EXACT_DUPLICATE";
  }
  if (a.providerSymbol !== b.providerSymbol) return "UNRELATED";
  if (
    a.provenance.snapshotId
    && b.provenance.snapshotId
    && a.provenance.snapshotId !== b.provenance.snapshotId
  ) {
    // Same measurements across snapshots are not identical evidence.
    if (
      a.provenance.sourceAssessmentId
      && a.provenance.sourceAssessmentId === b.provenance.sourceAssessmentId
    ) {
      return "RELATED";
    }
  }
  if (a.candleStatus === "STALE" || b.candleStatus === "STALE") {
    if (
      a.sourceEngine === b.sourceEngine
      && a.evidenceType === b.evidenceType
      && a.timeframe === b.timeframe
    ) {
      return "STALE";
    }
  }
  if (a.candleStatus === "MISSING" || b.candleStatus === "MISSING") {
    if (a.sourceEngine === b.sourceEngine && a.evidenceType === b.evidenceType) {
      return "MISSING";
    }
  }
  const aInvalid = a.warnings.some((w) => /invalid|blocked/i.test(w));
  const bInvalid = b.warnings.some((w) => /invalid|blocked/i.test(w));
  if (aInvalid || bInvalid) {
    if (a.sourceEngine === b.sourceEngine && a.evidenceType === b.evidenceType) {
      return "INVALID";
    }
  }
  const aSupportsB = a.supportingEvidenceIds.includes(b.evidenceId)
    || b.supportingEvidenceIds.includes(a.evidenceId)
    || a.conflictingEvidenceIds.length === 0
      && b.conflictingEvidenceIds.length === 0
      && a.direction === b.direction
      && a.direction !== "NEUTRAL"
      && a.providerSymbol === b.providerSymbol
      && (a.timeframe !== b.timeframe || a.evidenceType !== b.evidenceType);
  const conflictByRef =
    a.conflictingEvidenceIds.includes(b.evidenceId)
    || b.conflictingEvidenceIds.includes(a.evidenceId);
  const conflictByDirection =
    a.direction !== "NEUTRAL"
    && b.direction !== "NEUTRAL"
    && a.direction !== b.direction
    && a.providerSymbol === b.providerSymbol
    && (a.timeframe === b.timeframe || a.evidenceType === b.evidenceType);

  if (conflictByRef || conflictByDirection) return "CONFLICTING";
  if (aSupportsB) return "SUPPORTING";
  if (
    a.providerSymbol === b.providerSymbol
    && (a.sourceEngine === b.sourceEngine || a.evidenceType === b.evidenceType)
  ) {
    return "RELATED";
  }
  return "UNRELATED";
}

export interface DedupeEvidenceResult {
  items: MifUnifiedMarketEvidence[];
  relations: MifEvidenceRelation[];
  droppedDuplicateCount: number;
}

/**
 * Deterministic: sort by evidenceId, keep first of each exact-duplicate group,
 * emit relations for duplicates and conflicts among survivors.
 */
export function dedupeAndRelateEvidence(
  items: readonly MifUnifiedMarketEvidence[],
): DedupeEvidenceResult {
  const sorted = [...items].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  const kept: MifUnifiedMarketEvidence[] = [];
  const seen = new Map<string, MifUnifiedMarketEvidence>();
  const relations: MifEvidenceRelation[] = [];
  let droppedDuplicateCount = 0;

  for (const item of sorted) {
    const key = fingerprintKey(item);
    const prior = seen.get(key);
    if (prior) {
      droppedDuplicateCount += 1;
      relations.push({
        kind: "EXACT_DUPLICATE",
        leftEvidenceId: prior.evidenceId,
        rightEvidenceId: item.evidenceId,
        reason: "identical_source_fingerprint_snapshot_tf",
      });
      continue;
    }
    seen.set(key, item);
    kept.push(item);
  }

  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const kind = classifyEvidencePair(kept[i]!, kept[j]!);
      if (kind === "UNRELATED" || kind === "EXACT_DUPLICATE") continue;
      relations.push({
        kind,
        leftEvidenceId: kept[i]!.evidenceId,
        rightEvidenceId: kept[j]!.evidenceId,
        reason: `classified_${kind.toLowerCase()}`,
      });
    }
  }

  relations.sort((a, b) =>
    `${a.kind}:${a.leftEvidenceId}:${a.rightEvidenceId}`.localeCompare(
      `${b.kind}:${b.leftEvidenceId}:${b.rightEvidenceId}`,
    ),
  );

  return { items: kept, relations, droppedDuplicateCount };
}
