/**
 * Phase 02 — unified evidence integrity helpers.
 * Preserve Phase 01 grounding/truncation; add scrub + diagnostics only.
 */
import type { MifUnifiedMarketEvidence } from "./types.js";

/** True when string parses as a real date (not merely length >= 10). */
export function isParseableIsoTimestamp(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (t.length < 10) return false;
  const ms = Date.parse(t);
  return Number.isFinite(ms);
}

export function normalizeProviderSymbol(symbol: unknown): string {
  return String(symbol ?? "").trim().toUpperCase();
}

/**
 * Drop supporting/conflicting refs that are not present in the kept evidence set.
 * Prevents dangling citations after truncation/dedupe.
 */
export function scrubEvidenceRefsToKeptSet(
  items: readonly MifUnifiedMarketEvidence[],
): {
  items: MifUnifiedMarketEvidence[];
  danglingRefCount: number;
  danglingRefSample: string[];
} {
  const keptIds = new Set(items.map((i) => i.evidenceId));
  let danglingRefCount = 0;
  const danglingRefSample: string[] = [];
  const scrubbed = items.map((it) => {
    const support = (it.supportingEvidenceIds ?? []).filter((id) => {
      if (keptIds.has(id)) return true;
      danglingRefCount += 1;
      if (danglingRefSample.length < 12) danglingRefSample.push(`${it.evidenceId}->${id}`);
      return false;
    });
    const conflict = (it.conflictingEvidenceIds ?? []).filter((id) => {
      if (keptIds.has(id)) return true;
      danglingRefCount += 1;
      if (danglingRefSample.length < 12) danglingRefSample.push(`${it.evidenceId}->${id}`);
      return false;
    });
    if (
      support.length === (it.supportingEvidenceIds ?? []).length
      && conflict.length === (it.conflictingEvidenceIds ?? []).length
    ) {
      return it;
    }
    return {
      ...it,
      supportingEvidenceIds: support,
      conflictingEvidenceIds: conflict,
    };
  });
  return { items: scrubbed, danglingRefCount, danglingRefSample };
}

/** Filter ID lists to an allowlist; returns filtered list + dropped count. */
export function filterIdsToAllowlist(
  ids: readonly string[] | null | undefined,
  allow: ReadonlySet<string>,
): { ids: string[]; dropped: string[] } {
  const out: string[] = [];
  const dropped: string[] = [];
  for (const id of ids ?? []) {
    if (allow.has(id)) out.push(id);
    else dropped.push(id);
  }
  return { ids: out, dropped };
}

export interface EvidencePackageIntegrityDiagnostics {
  symbolMismatchCount: number;
  symbolMismatchSample: string[];
  snapshotMismatchCount: number;
  snapshotMismatchSample: string[];
  staleItemCount: number;
  nullTimeframeProductionRefCount: number;
  invalidEventTimeCount: number;
  missingObservedAtCount: number;
}

export function collectEvidencePackageIntegrityDiagnostics(
  items: readonly MifUnifiedMarketEvidence[],
  packageSymbol: string,
  packageSnapshotId: string | null,
): EvidencePackageIntegrityDiagnostics {
  const pkgSym = normalizeProviderSymbol(packageSymbol);
  const diag: EvidencePackageIntegrityDiagnostics = {
    symbolMismatchCount: 0,
    symbolMismatchSample: [],
    snapshotMismatchCount: 0,
    snapshotMismatchSample: [],
    staleItemCount: 0,
    nullTimeframeProductionRefCount: 0,
    invalidEventTimeCount: 0,
    missingObservedAtCount: 0,
  };
  for (const it of items) {
    const sym = normalizeProviderSymbol(it.providerSymbol);
    if (pkgSym && sym && sym !== pkgSym) {
      diag.symbolMismatchCount += 1;
      if (diag.symbolMismatchSample.length < 8) {
        diag.symbolMismatchSample.push(`${it.evidenceId}:${sym}`);
      }
    }
    const itemSnap = it.provenance?.snapshotId ?? null;
    if (
      packageSnapshotId
      && itemSnap
      && String(itemSnap) !== String(packageSnapshotId)
    ) {
      diag.snapshotMismatchCount += 1;
      if (diag.snapshotMismatchSample.length < 8) {
        diag.snapshotMismatchSample.push(`${it.evidenceId}:${itemSnap}`);
      }
    }
    if (String(it.candleStatus ?? "").toUpperCase() === "STALE") {
      diag.staleItemCount += 1;
    }
    const isProdRef = (it.limitations ?? []).includes("productionEvidenceRef");
    if (isProdRef && (it.timeframe == null || String(it.timeframe).trim() === "")) {
      diag.nullTimeframeProductionRefCount += 1;
    }
    if (it.eventTime != null && !isParseableIsoTimestamp(it.eventTime)) {
      diag.invalidEventTimeCount += 1;
    }
    if (!isParseableIsoTimestamp(it.observedAt)) {
      diag.missingObservedAtCount += 1;
    }
  }
  return diag;
}

export function integrityDiagnosticsToWarnings(
  diag: EvidencePackageIntegrityDiagnostics,
): string[] {
  const w: string[] = [];
  if (diag.symbolMismatchCount > 0) {
    w.push(
      `symbol_mismatch_count=${diag.symbolMismatchCount};sample=${diag.symbolMismatchSample.join(",")}`,
    );
  }
  if (diag.snapshotMismatchCount > 0) {
    w.push(
      `snapshot_mismatch_count=${diag.snapshotMismatchCount};sample=${diag.snapshotMismatchSample.join(",")}`,
    );
  }
  if (diag.staleItemCount > 0) {
    w.push(`stale_evidence_item_count=${diag.staleItemCount}`);
  }
  if (diag.nullTimeframeProductionRefCount > 0) {
    w.push(
      `null_timeframe_production_ref_count=${diag.nullTimeframeProductionRefCount}`,
    );
  }
  if (diag.invalidEventTimeCount > 0) {
    w.push(`invalid_event_time_count=${diag.invalidEventTimeCount}`);
  }
  if (diag.missingObservedAtCount > 0) {
    w.push(`invalid_observed_at_count=${diag.missingObservedAtCount}`);
  }
  return w;
}
