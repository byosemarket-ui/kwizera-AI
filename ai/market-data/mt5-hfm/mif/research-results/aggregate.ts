/**
 * Phase 5F STEP 5 Phase B — bounded Research Results aggregator.
 * Deterministic for the same source identities + filter + engine version.
 * Never invents missing linkage ids. Never claims calibrated probability.
 * Never fits/tunes calibrators (OOS or otherwise).
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getMifBacktestStorage } from "../backtesting/persistence.js";
import type { MifBacktestRunManifest } from "../backtesting/types.js";
import { getMifAnalogueSearchStorage } from "../historical-research/analogue/persistence.js";
import { getMifHistoricalResearchStorage } from "../historical-research/storage.js";
import type { MifResearchRegistryEntry } from "../historical-research/types.js";
import { getMifProbabilityFreezeStorage } from "../probability-intelligence/freeze-persistence.js";
import type { MifProbabilityFreezeRecord } from "../probability-intelligence/freeze-types.js";
import type { MifProbabilityAssessment } from "../probability-intelligence/types.js";
import { getMifPredictionOutcomeStorage } from "../prediction-outcome/persistence.js";
import type {
  MifPredictionOutcomeRecord,
  MifPredictionSnapshot,
} from "../prediction-outcome/types.js";
import { getMifEvidenceLinkageStorage } from "../evidence-linkage/persistence.js";
import {
  getMifOpportunityStorage,
  MifOpportunityStorage,
} from "../production-integration/persistence/storage.js";
import { getMifWfCalibrationStorage } from "../wf-calibration/persistence.js";
import { stableSerialize } from "../quality/stable-identity.js";
import { buildResearchCalibrationStatus, isDecisiveLevelResultKind } from "./calibration-status.js";
import {
  MIF_RESEARCH_LABEL_COST_UNAVAILABLE,
  MIF_RESEARCH_LABEL_DESCRIPTIVE,
  MIF_RESEARCH_LABEL_INSUFFICIENT,
  MIF_RESEARCH_LABEL_NOT_CALIBRATED,
  MIF_RESEARCH_LABEL_UNCALIBRATED,
  MIF_RESEARCH_RESULTS_CONTRACT_ID,
  MIF_RESEARCH_RESULTS_CONTRACT_VERSION,
  MIF_RESEARCH_RESULTS_ENGINE_ID,
  MIF_RESEARCH_RESULTS_ENGINE_VERSION,
  MIF_RESEARCH_RESULTS_MAX_ASSESSMENTS,
  MIF_RESEARCH_RESULTS_MAX_BACKTESTS,
  MIF_RESEARCH_RESULTS_MAX_CALIBRATION_RUNS,
  MIF_RESEARCH_RESULTS_MAX_DATASETS,
  MIF_RESEARCH_RESULTS_MAX_FREEZES,
  MIF_RESEARCH_RESULTS_MAX_OUTCOMES,
  MIF_RESEARCH_RESULTS_MAX_SEARCHES,
} from "./contracts.js";
import type {
  MifResearchBacktestSummary,
  MifResearchDatasetProvenance,
  MifResearchOutcomeDistribution,
  MifResearchResultFilters,
  MifResearchResultSummary,
  MifResearchSymbolTimeframeSummary,
} from "./types.js";

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

function normalizeFilter(filters?: MifResearchResultFilters | null): MifResearchResultFilters {
  return {
    symbol: filters?.symbol?.trim() ? filters.symbol.trim().toUpperCase() : null,
    timeframe: filters?.timeframe?.trim() ? filters.timeframe.trim() : null,
    datasetId: filters?.datasetId?.trim() ? filters.datasetId.trim() : null,
    backtestRunId: filters?.backtestRunId?.trim() ? filters.backtestRunId.trim() : null,
  };
}

function matchesSymbolTf(
  instrument: string | null | undefined,
  timeframe: string | null | undefined,
  filters: MifResearchResultFilters,
): boolean {
  if (filters.symbol && String(instrument ?? "").toUpperCase() !== filters.symbol) return false;
  if (filters.timeframe && String(timeframe ?? "") !== filters.timeframe) return false;
  return true;
}

async function listSnapshotIds(root: string): Promise<string[]> {
  const dir = path.join(root, "prediction-snapshots");
  try {
    return (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
}

async function listCalibrationRunIds(calibrationDir: string): Promise<string[]> {
  try {
    return (await fs.readdir(calibrationDir))
      .filter((n) => n.endsWith(".json"))
      .slice(0, MIF_RESEARCH_RESULTS_MAX_CALIBRATION_RUNS);
  } catch {
    return [];
  }
}

function pickLatestOutcomes(
  outcomes: readonly MifPredictionOutcomeRecord[],
): MifPredictionOutcomeRecord[] {
  const byPred = new Map<string, MifPredictionOutcomeRecord>();
  for (const o of outcomes) {
    const prev = byPred.get(o.predictionId);
    if (!prev || o.revisionOrdinal >= prev.revisionOrdinal) {
      byPred.set(o.predictionId, o);
    }
  }
  return [...byPred.values()].sort((a, b) =>
    b.computationTimestamp.localeCompare(a.computationTimestamp),
  );
}

function buildOutcomeDistribution(
  latest: readonly MifPredictionOutcomeRecord[],
): MifResearchOutcomeDistribution {
  const completeness: Record<string, number> = {};
  const levelResultKinds: Record<string, number> = {};
  const excludedBreakdown: Record<string, number> = {};
  let decisiveTarget = 0;
  let decisiveInv = 0;
  let excluded = 0;
  for (const o of latest) {
    completeness[o.completeness] = (completeness[o.completeness] ?? 0) + 1;
    const kind = o.levelOutcome?.resultKind ?? "UNKNOWN";
    levelResultKinds[kind] = (levelResultKinds[kind] ?? 0) + 1;
    if (kind === "TARGET_REACHED") decisiveTarget += 1;
    else if (kind === "INVALIDATION_REACHED") decisiveInv += 1;
    else {
      excluded += 1;
      excludedBreakdown[kind] = (excludedBreakdown[kind] ?? 0) + 1;
    }
  }
  return {
    descriptiveOnly: true,
    uniquePredictions: latest.length,
    outcomeRevisionsCountedAsLatestOnly: latest.length,
    completeness,
    levelResultKinds,
    decisiveTargetReached: decisiveTarget,
    decisiveInvalidationReached: decisiveInv,
    decisiveDenominator: decisiveTarget + decisiveInv,
    excludedNonDecisive: excluded,
    excludedBreakdown,
  };
}

function datasetProvenance(e: MifResearchRegistryEntry): MifResearchDatasetProvenance {
  const pit: string[] = [];
  const cost: string[] = [];
  if (!e.suitableForCostAdjustedBacktest) {
    cost.push("COST_INCOMPLETE: slippage/commission/swap unavailable");
  }
  if (e.costCompleteness === "COST_INCOMPLETE") {
    cost.push("costCompleteness=COST_INCOMPLETE");
  }
  pit.push("METADATA_LIMITED: PIT sessions/specs are observation-only");
  return {
    datasetId: e.datasetId,
    version: e.version,
    contentHash: e.contentHash,
    instrument: e.instrument,
    timeframe: e.timeframe,
    status: e.status,
    suitableForCostAdjustedBacktest: Boolean(e.suitableForCostAdjustedBacktest),
    pitLimitations: pit,
    costLimitations: cost,
  };
}

function backtestSummary(m: MifBacktestRunManifest): MifResearchBacktestSummary {
  const foldStatuses: Record<string, number> = {};
  for (const f of m.folds ?? []) {
    const st = String(f.status ?? "UNKNOWN");
    foldStatuses[st] = (foldStatuses[st] ?? 0) + 1;
  }
  return {
    runId: m.runId,
    status: m.status,
    mode: m.mode,
    datasetId: m.dataset?.datasetId ?? null,
    contentHash: m.dataset?.contentHash ?? null,
    costAdjusted: false,
    foldCount: m.folds?.length ?? 0,
    foldStatuses,
    isNotCalibratedProbability: true,
  };
}

function countDecisiveFrozenPairs(input: {
  freezes: readonly MifProbabilityFreezeRecord[];
  latestOutcomes: readonly MifPredictionOutcomeRecord[];
  snapshots: readonly MifPredictionSnapshot[];
}): number {
  const outcomeByPrediction = new Map(
    input.latestOutcomes.map((o) => [o.predictionId, o] as const),
  );
  const snapshotByCandidate = new Map<string, MifPredictionSnapshot[]>();
  for (const s of input.snapshots) {
    const arr = snapshotByCandidate.get(s.candidateId) ?? [];
    arr.push(s);
    snapshotByCandidate.set(s.candidateId, arr);
  }

  let count = 0;
  for (const fr of input.freezes) {
    let outcome: MifPredictionOutcomeRecord | null = null;
    if (fr.predictionId && outcomeByPrediction.has(fr.predictionId)) {
      outcome = outcomeByPrediction.get(fr.predictionId)!;
    } else {
      // Do not invent predictionId. Optional soft join via candidateId only when
      // exactly one snapshot/outcome chain exists for that candidate — otherwise skip.
      const snaps = snapshotByCandidate.get(fr.candidateId) ?? [];
      if (snaps.length === 1) {
        outcome = outcomeByPrediction.get(snaps[0]!.predictionId) ?? null;
      }
    }
    if (!outcome) continue;
    const kind = outcome.levelOutcome?.resultKind;
    if (!isDecisiveLevelResultKind(kind)) continue;
    const resolvedAt =
      outcome.levelOutcome?.evaluationTimestamp || outcome.computationTimestamp;
    if (!resolvedAt || fr.predictedAt >= resolvedAt) continue;
    count += 1;
  }
  return count;
}

export interface AggregateResearchResultsInput {
  filters?: MifResearchResultFilters | null;
  /** Injected generatedAt for deterministic tests; must be ISO when provided. */
  generatedAt?: string;
  storageRoot?: string;
}

export async function aggregateResearchResults(
  input: AggregateResearchResultsInput = {},
): Promise<MifResearchResultSummary> {
  const filters = normalizeFilter(input.filters);
  const research = getMifHistoricalResearchStorage(input.storageRoot);
  const analogues = getMifAnalogueSearchStorage(input.storageRoot);
  const predictions = getMifPredictionOutcomeStorage(input.storageRoot);
  const backtests = getMifBacktestStorage(input.storageRoot);
  const opportunity = input.storageRoot
    ? new MifOpportunityStorage(input.storageRoot)
    : getMifOpportunityStorage();
  const freezesStore = getMifProbabilityFreezeStorage(input.storageRoot);
  const linkageStore = getMifEvidenceLinkageStorage(input.storageRoot);
  const wfStore = getMifWfCalibrationStorage(input.storageRoot);

  const registryAll = await research.listRegistry();
  let registry = registryAll
    .filter((e) => matchesSymbolTf(e.instrument, e.timeframe, filters))
    .filter((e) => !filters.datasetId || e.datasetId === filters.datasetId)
    .slice(0, MIF_RESEARCH_RESULTS_MAX_DATASETS);

  // Prefer latest version per datasetId
  const byId = new Map<string, MifResearchRegistryEntry>();
  for (const e of registry) {
    const prev = byId.get(e.datasetId);
    if (!prev || e.version > prev.version) byId.set(e.datasetId, e);
  }
  registry = [...byId.values()].sort((a, b) => a.datasetId.localeCompare(b.datasetId));

  const datasets = registry.map(datasetProvenance);

  const symbolMap = new Map<string, MifResearchSymbolTimeframeSummary>();
  for (const d of datasets) {
    const key = `${d.instrument}|${d.timeframe}`;
    const cur = symbolMap.get(key) ?? {
      symbol: d.instrument,
      timeframe: d.timeframe,
      datasetCount: 0,
      completeDatasetCount: 0,
      incompleteDatasetCount: 0,
      descriptiveOnly: true as const,
    };
    cur.datasetCount += 1;
    if (d.status === "COMPLETE") cur.completeDatasetCount += 1;
    else cur.incompleteDatasetCount += 1;
    symbolMap.set(key, cur);
  }
  const symbolTimeframeSummaries = [...symbolMap.values()].sort((a, b) =>
    `${a.symbol}|${a.timeframe}`.localeCompare(`${b.symbol}|${b.timeframe}`),
  );

  const searchList = await analogues.listSearches({
    limit: MIF_RESEARCH_RESULTS_MAX_SEARCHES,
  });
  let analogueResultCount = 0;
  let analogueSearchMatched = 0;
  for (const s of searchList.searches) {
    const full = await analogues.getSearch(s.searchId);
    if (!full) continue;
    const refInst = full.reference?.instrument ?? null;
    const refTf = full.reference?.timeframe ?? null;
    if (!matchesSymbolTf(refInst, refTf, filters)) continue;
    analogueSearchMatched += 1;
    analogueResultCount += full.analogues?.length ?? 0;
  }

  const snapshotFiles = await listSnapshotIds(predictions.root);
  const snapshots: MifPredictionSnapshot[] = [];
  for (const f of snapshotFiles.slice(0, MIF_RESEARCH_RESULTS_MAX_OUTCOMES)) {
    const id = f.replace(/\.json$/, "");
    const snap = await predictions.getSnapshot(id);
    if (!snap) continue;
    if (!matchesSymbolTf(snap.instrument, snap.timeframe, filters)) continue;
    snapshots.push(snap);
  }
  const allowedPredictionIds = new Set(snapshots.map((s) => s.predictionId));
  const outcomeListed = await predictions.listOutcomes({
    limit: MIF_RESEARCH_RESULTS_MAX_OUTCOMES,
  });
  const outcomes =
    filters.symbol || filters.timeframe
      ? outcomeListed.items.filter((o) => allowedPredictionIds.has(o.predictionId))
      : outcomeListed.items;
  const latestOutcomes = pickLatestOutcomes(outcomes);
  const outcomeDistribution = buildOutcomeDistribution(latestOutcomes);

  const assessments = await opportunity.listProbabilityAssessments({
    providerSymbol: filters.symbol ?? undefined,
    limit: MIF_RESEARCH_RESULTS_MAX_ASSESSMENTS,
  });
  let assessmentItems: MifProbabilityAssessment[] = assessments.items;
  if (filters.timeframe) {
    assessmentItems = assessmentItems.filter(
      (a) => !a.primaryTimeframe || a.primaryTimeframe === filters.timeframe,
    );
  }

  const freezeListed = await freezesStore.listFreezes({
    providerSymbol: filters.symbol ?? undefined,
    limit: MIF_RESEARCH_RESULTS_MAX_FREEZES,
  });
  let freezes = freezeListed.items;
  if (filters.timeframe) {
    freezes = freezes.filter(
      (f) => !f.primaryTimeframe || f.primaryTimeframe === filters.timeframe,
    );
  }

  const runList = await backtests.listRuns({ limit: MIF_RESEARCH_RESULTS_MAX_BACKTESTS });
  let manifests = runList.items.filter((m) =>
    matchesSymbolTf(m.instrument, m.primaryTimeframe, filters),
  );
  if (filters.datasetId) {
    manifests = manifests.filter((m) => m.dataset?.datasetId === filters.datasetId);
  }
  if (filters.backtestRunId) {
    manifests = manifests.filter((m) => m.runId === filters.backtestRunId);
  }
  const backtestSummaries = manifests.map(backtestSummary);

  const calibrationIds = await listCalibrationRunIds(opportunity.calibrationDir);
  const decisiveFrozenPairCount = countDecisiveFrozenPairs({
    freezes,
    latestOutcomes,
    snapshots,
  });

  const freezeLinkedToPredictionCount = freezes.filter((f) => Boolean(f.predictionId)).length;
  const highTrustFreezeCount = freezes.filter((f) => f.provenanceTrust === "HIGH").length;
  const frozenAssessmentIds = new Set(freezes.map((f) => f.assessmentId));
  const assessmentsWithoutFreezeCount = assessmentItems.filter(
    (a) => !frozenAssessmentIds.has(a.assessmentId),
  ).length;

  const linkages = await linkageStore.list({ limit: 100 });
  const evidenceLinkageLinkedCount = linkages.items.filter((l) => l.status === "LINKED").length;
  const evidenceLinkageUnavailableCount = linkages.items.filter(
    (l) => l.status === "LINKAGE_UNAVAILABLE",
  ).length;

  const wfListed = await wfStore.listRuns({ limit: 5 });
  const latestWf = wfListed.items[0] ?? null;

  const missingLinks: string[] = [];
  if (assessmentItems.length > 0 && freezes.length === 0) {
    missingLinks.push("probability_assessments_have_no_prediction_time_freezes");
  }
  if (freezes.some((f) => !f.predictionId)) {
    missingLinks.push("some_freezes_lack_predictionId_link");
  }
  if (freezes.some((f) => f.provenanceTrust !== "HIGH")) {
    missingLinks.push("some_freezes_have_LIMITED_prediction_time_provenance");
  }
  if (snapshots.length > 0 && latestOutcomes.length === 0) {
    missingLinks.push("snapshots_without_outcomes");
  }
  if (searchList.searches.length > 0 && snapshots.length === 0) {
    missingLinks.push("analogue_searches_not_linked_to_prediction_snapshots");
  }
  if (latestOutcomes.length > 0 && freezes.length === 0) {
    missingLinks.push("outcomes_without_frozen_prediction_time_probabilities");
  }
  if (evidenceLinkageLinkedCount === 0) {
    missingLinks.push("LINKAGE_UNAVAILABLE_no_explicit_analogue_prediction_links");
  }
  // Never invent analogueId/searchId on predictions
  missingLinks.push("prediction_snapshots_do_not_store_analogueId_or_searchId");

  const calibration = buildResearchCalibrationStatus({
    frozenAssessmentCount: freezes.length,
    highTrustFreezeCount,
    decisiveFrozenPairCount,
    scaffoldingCalibrationRunCount: calibrationIds.length,
    wfCalibrationStatus: latestWf?.status ?? null,
    wfEligibleOosCount: latestWf?.totalEligibleObservations ?? 0,
    wfRunId: latestWf?.runId ?? null,
  });

  const warnings: string[] = [];
  if (datasets.every((d) => !d.suitableForCostAdjustedBacktest)) {
    warnings.push(MIF_RESEARCH_LABEL_COST_UNAVAILABLE);
  }
  if (outcomeDistribution.decisiveDenominator === 0) {
    warnings.push("no_decisive_TARGET_INVALIDATION_labels_in_bounded_window");
  }
  if (freezes.length === 0) {
    warnings.push("UNFROZEN_assessments_remain_NOT_CALIBRATED");
  }
  warnings.push("descriptive_statistics_are_not_predictive_estimates");
  warnings.push("overlapping_predictions_may_create_statistical_dependence");
  warnings.push("mid_split_5e_calibration_scaffolding_is_not_walk_forward_calibrated");

  const claimLabels = [
    MIF_RESEARCH_LABEL_DESCRIPTIVE,
    MIF_RESEARCH_LABEL_UNCALIBRATED,
    MIF_RESEARCH_LABEL_NOT_CALIBRATED,
    MIF_RESEARCH_LABEL_INSUFFICIENT,
    MIF_RESEARCH_LABEL_COST_UNAVAILABLE,
  ];

  const identityBody = {
    filters,
    datasetIds: datasets.map((d) => ({
      datasetId: d.datasetId,
      version: d.version,
      contentHash: d.contentHash,
    })),
    outcomeIds: latestOutcomes.map((o) => o.outcomeId).sort(),
    freezeIds: freezes.map((f) => f.freezeId).sort(),
    assessmentIds: assessmentItems.map((a) => a.assessmentId).sort(),
    backtestRunIds: backtestSummaries.map((b) => b.runId).sort(),
    searchIds: searchList.searches.map((s) => s.searchId).sort(),
    engine: MIF_RESEARCH_RESULTS_ENGINE_VERSION,
    contract: MIF_RESEARCH_RESULTS_CONTRACT_VERSION,
  };
  const summaryHash = hashPayload(identityBody);
  const summaryId = `rrsum:${summaryHash.slice(0, 28)}`;

  // Deterministic generatedAt: hash-derived ISO-like marker when not injected.
  // Never use wall-clock for identity; generatedAt is metadata display only.
  const generatedAt =
    input.generatedAt
    ?? `1970-01-01T00:00:00.${summaryHash.slice(0, 3)}Z`;

  return {
    contractId: MIF_RESEARCH_RESULTS_CONTRACT_ID,
    contractVersion: MIF_RESEARCH_RESULTS_CONTRACT_VERSION,
    summaryId,
    summaryHash,
    engineId: MIF_RESEARCH_RESULTS_ENGINE_ID,
    engineVersion: MIF_RESEARCH_RESULTS_ENGINE_VERSION,
    generatedAt,
    filters,
    datasets,
    symbolTimeframeSummaries,
    outcomeDistribution,
    linkage: {
      analogueSearchCount: filters.symbol || filters.timeframe
        ? analogueSearchMatched
        : searchList.total,
      analogueResultCount,
      predictionSnapshotCount: snapshots.length,
      predictionOutcomeCount: latestOutcomes.length,
      probabilityAssessmentCount: assessmentItems.length,
      probabilityFreezeCount: freezes.length,
      highTrustFreezeCount,
      evidenceLinkageCount: linkages.total,
      evidenceLinkageLinkedCount,
      evidenceLinkageUnavailableCount,
      missingLinks,
      freezeLinkedToPredictionCount,
      assessmentsWithoutFreezeCount,
    },
    backtests: backtestSummaries,
    calibration,
    warnings,
    claimLabels,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    descriptiveResearchOnly: true,
    isNotCalibratedProbability: true,
    costAdjusted: false,
    notExecutable: true,
  };
}
