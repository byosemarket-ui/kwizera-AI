/**
 * R2-HYG-1 — server-side eligibility for Charts production analytics / census.
 * Never trust client-supplied production flags. Never delete or rewrite records.
 */
import path from "node:path";
import { MifPredictionOutcomeStorage } from "../../mif/prediction-outcome/persistence.js";
import type { MifPredictionSnapshot } from "../../mif/prediction-outcome/types.js";
import type { HfmChartsProductionEligibilityDiagnostics } from "./analytics-types.js";
import type { HfmChartsPredictionOutcomeStorage } from "./persistence.js";
import type { HfmChartsPredictionEvaluationRecord } from "./types.js";

async function loadEvaluationsBounded(
  storage: HfmChartsPredictionOutcomeStorage,
  maxRecords = 10_000,
): Promise<HfmChartsPredictionEvaluationRecord[]> {
  const listed = await storage.listAllEvaluations({ offset: 0, limit: 100 });
  const all = [...listed.items];
  let offset = listed.items.length;
  while (offset < listed.total && offset < maxRecords) {
    const page = await storage.listAllEvaluations({ offset, limit: 100 });
    if (!page.items.length) break;
    all.push(...page.items);
    offset += page.items.length;
  }
  return all;
}

export const HFM_CHARTS_PRODUCTION_ELIGIBILITY_POLICY_ID =
  "charts-production-eligibility" as const;
export const HFM_CHARTS_PRODUCTION_ELIGIBILITY_POLICY_VERSION = "1" as const;

export type ChartsNonProductionReason =
  | "TEST_OVERRIDE_CONFIDENCE"
  | "SMOKE_CANDIDATE_ID"
  | "SMOKE_REASONING_RUN_ID"
  | "SMOKE_ANALYSIS_RUN_ID"
  | "SMOKE_SOURCE_ANALYSIS_IDENTITY"
  | "CLIENT_FLAG_IGNORED_TRUSTED_SMOKE";

export type ChartsProductionEligibilityClass =
  | "PRODUCTION_ELIGIBLE"
  | "NON_PRODUCTION"
  | "LEGACY_UNMARKED";

const SMOKE_RE = /(?:^|[-_:.\/])(?:vps[-_]?smoke|smoke[-_]?test|smoke)(?:$|[-_:.\/])/i;

export interface ChartsProductionEligibility {
  class: ChartsProductionEligibilityClass;
  /** True when record must be excluded from production analytics/census. */
  excludeFromProductionAnalytics: boolean;
  reasons: ChartsNonProductionReason[];
  /** Present when a client-ish flag was seen and ignored. */
  ignoredClientProductionClaim: boolean;
}

function looksLikeSmoke(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  return SMOKE_RE.test(s) || s.toLowerCase().includes("vps-smoke");
}

/**
 * Classify an evaluation (+ optional linked prediction snapshot) for production analytics.
 * Client-supplied `isProduction` / `productionEligible` / `excludeFromAnalytics` fields are ignored.
 */
export function classifyChartsProductionEligibility(
  evaluation: HfmChartsPredictionEvaluationRecord,
  snapshot?: MifPredictionSnapshot | null,
  clientHints?: Record<string, unknown> | null,
): ChartsProductionEligibility {
  const reasons: ChartsNonProductionReason[] = [];
  const ignoredClientProductionClaim = Boolean(
    clientHints
      && (clientHints.isProduction === true
        || clientHints.productionEligible === true
        || clientHints.excludeFromAnalytics === false),
  );

  const prov = evaluation.provenance;
  if (prov.confidenceSource === "TEST_OVERRIDE") {
    reasons.push("TEST_OVERRIDE_CONFIDENCE");
  }
  if (looksLikeSmoke(prov.analysisRunId)) {
    reasons.push("SMOKE_ANALYSIS_RUN_ID");
  }
  if (looksLikeSmoke(prov.sourceAnalysisIdentity)) {
    reasons.push("SMOKE_SOURCE_ANALYSIS_IDENTITY");
  }
  if (snapshot) {
    if (looksLikeSmoke(snapshot.candidateId)) {
      reasons.push("SMOKE_CANDIDATE_ID");
    }
    if (looksLikeSmoke(snapshot.reasoningRunId)) {
      reasons.push("SMOKE_REASONING_RUN_ID");
    }
    if (looksLikeSmoke(snapshot.analysisRunId)) {
      reasons.push("SMOKE_ANALYSIS_RUN_ID");
    }
  }

  // If client claimed production but trusted smoke markers exist, record ignore.
  if (ignoredClientProductionClaim && reasons.length > 0) {
    reasons.push("CLIENT_FLAG_IGNORED_TRUSTED_SMOKE");
  }

  if (reasons.length > 0) {
    return {
      class: "NON_PRODUCTION",
      excludeFromProductionAnalytics: true,
      reasons: [...new Set(reasons)],
      ignoredClientProductionClaim,
    };
  }

  // Trusted production bridge markers.
  const sourceOk =
    typeof prov.sourceAnalysisIdentity === "string"
    && prov.sourceAnalysisIdentity.startsWith("hfm-charts:");
  const analysisOk =
    typeof prov.analysisRunId === "string" && prov.analysisRunId.trim().length > 0;
  if (sourceOk || analysisOk) {
    return {
      class: "PRODUCTION_ELIGIBLE",
      excludeFromProductionAnalytics: false,
      reasons: [],
      ignoredClientProductionClaim,
    };
  }

  // Legacy / unmarked — include conservatively, surface in diagnostics.
  return {
    class: "LEGACY_UNMARKED",
    excludeFromProductionAnalytics: false,
    reasons: [],
    ignoredClientProductionClaim,
  };
}

export function isNonProductionChartsRecord(
  evaluation: HfmChartsPredictionEvaluationRecord,
  snapshot?: MifPredictionSnapshot | null,
  clientHints?: Record<string, unknown> | null,
): boolean {
  return classifyChartsProductionEligibility(evaluation, snapshot, clientHints)
    .excludeFromProductionAnalytics;
}

export interface ChartsProductionFilterResult {
  included: HfmChartsPredictionEvaluationRecord[];
  rawEvaluationRecords: number;
  excludedNonProduction: number;
  excludedNonProductionByReason: Record<string, number>;
  legacyUnmarkedIncluded: number;
  clientProductionClaimsIgnored: number;
}

export function filterChartsEvaluationsForProductionAnalytics(
  evaluations: readonly HfmChartsPredictionEvaluationRecord[],
  snapshotByPredictionId?: ReadonlyMap<string, MifPredictionSnapshot | null>,
  clientHintsByEvaluationId?: ReadonlyMap<string, Record<string, unknown> | null>,
): ChartsProductionFilterResult {
  const included: HfmChartsPredictionEvaluationRecord[] = [];
  const excludedNonProductionByReason: Record<string, number> = {};
  let excludedNonProduction = 0;
  let legacyUnmarkedIncluded = 0;
  let clientProductionClaimsIgnored = 0;

  for (const e of evaluations) {
    const snap = snapshotByPredictionId?.get(e.predictionId) ?? null;
    // Client hints never authorize inclusion; used only to prove ignore diagnostics.
    const hints = clientHintsByEvaluationId?.get(e.evaluationId) ?? null;
    const cls = classifyChartsProductionEligibility(e, snap, hints);
    if (cls.ignoredClientProductionClaim) clientProductionClaimsIgnored += 1;
    if (cls.excludeFromProductionAnalytics) {
      excludedNonProduction += 1;
      for (const r of cls.reasons) {
        excludedNonProductionByReason[r] = (excludedNonProductionByReason[r] ?? 0) + 1;
      }
      continue;
    }
    if (cls.class === "LEGACY_UNMARKED") legacyUnmarkedIncluded += 1;
    included.push(e);
  }

  return {
    included,
    rawEvaluationRecords: evaluations.length,
    excludedNonProduction,
    excludedNonProductionByReason,
    legacyUnmarkedIncluded,
    clientProductionClaimsIgnored,
  };
}

export function toProductionEligibilityDiagnostics(
  filter: ChartsProductionFilterResult,
): HfmChartsProductionEligibilityDiagnostics {
  return {
    policyId: HFM_CHARTS_PRODUCTION_ELIGIBILITY_POLICY_ID,
    policyVersion: HFM_CHARTS_PRODUCTION_ELIGIBILITY_POLICY_VERSION,
    rawEvaluationRecords: filter.rawEvaluationRecords,
    includedForAnalytics: filter.included.length,
    excludedNonProduction: filter.excludedNonProduction,
    excludedNonProductionByReason: { ...filter.excludedNonProductionByReason },
    legacyUnmarkedIncluded: filter.legacyUnmarkedIncluded,
    clientProductionClaimsIgnored: filter.clientProductionClaimsIgnored,
    note:
      "Server-side provenance only. Client production/test flags are ignored. "
      + "Non-production records are excluded from analytics/census, not deleted. "
      + "Legacy unmarked records are included conservatively.",
  };
}

/**
 * Load evaluations + linked MIF snapshots, then apply the shared production filter.
 * Used by both Performance Analytics and Calibration Census FromStorage paths.
 */
/** Derive KWIZERA storage root from charts eval dir (.../mt5-hfm/mif/charts-prediction-evaluations). */
function storageRootFromChartsStorage(
  chartsStorage: HfmChartsPredictionOutcomeStorage,
): string {
  return path.dirname(path.dirname(path.dirname(chartsStorage.root)));
}

export async function loadProductionEligibleChartsEvaluations(input: {
  chartsStorage: HfmChartsPredictionOutcomeStorage;
  snapshotStorage?: MifPredictionOutcomeStorage;
  maxRecords?: number;
}): Promise<{
  included: HfmChartsPredictionEvaluationRecord[];
  diagnostics: HfmChartsProductionEligibilityDiagnostics;
  filter: ChartsProductionFilterResult;
}> {
  const evaluations = await loadEvaluationsBounded(
    input.chartsStorage,
    input.maxRecords ?? 10_000,
  );
  const snapStore =
    input.snapshotStorage
    ?? new MifPredictionOutcomeStorage(storageRootFromChartsStorage(input.chartsStorage));
  const snapshotByPredictionId = new Map<string, MifPredictionSnapshot | null>();
  const uniqueIds = [...new Set(evaluations.map((e) => e.predictionId))];
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        snapshotByPredictionId.set(id, await snapStore.getSnapshot(id));
      } catch {
        snapshotByPredictionId.set(id, null);
      }
    }),
  );
  const filter = filterChartsEvaluationsForProductionAnalytics(
    evaluations,
    snapshotByPredictionId,
  );
  return {
    included: filter.included,
    diagnostics: toProductionEligibilityDiagnostics(filter),
    filter,
  };
}
