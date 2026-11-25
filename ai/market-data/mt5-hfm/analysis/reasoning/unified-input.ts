/**
 * Phase 5 — Unified OpenAI AI Analysis input builder.
 * Contract: kwizera.hfm.unified-ai-analysis-input.v1
 *
 * Loads Phase 2 evidence + Phase 4 scenarios for the exact Charts snapshotId.
 * Never invents prices, levels, IDs, or evidence. H4 is text/context only.
 */
import { createHash } from "node:crypto";
import {
  HFM_REASONING_CONTEXT_TFS,
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_REQUIRED_TFS,
  HFM_REASONING_SCHEMA_VERSION,
  HFM_UNIFIED_AI_INPUT_CONTRACT_ID,
  HFM_UNIFIED_AI_INPUT_CONTRACT_VERSION,
  HFM_UNIFIED_AI_MAX_CANDIDATES,
  HFM_UNIFIED_AI_MAX_CANDLES_PER_TF,
  HFM_UNIFIED_AI_MAX_EVIDENCE,
  HFM_UNIFIED_AI_MAX_JSON_CHARS,
  HFM_UNIFIED_AI_MAX_NOTE_CHARS,
} from "./constants.js";
import type { HfmAnalysisContextResult } from "../types.js";
import type { HfmReasoningImageRef, HfmUnifiedInputCompleteness } from "./types.js";
import { stableSerialize } from "../../mif/quality/stable-identity.js";
import { filterIdsToAllowlist } from "../../mif/market-evidence/integrity.js";
import { prioritizeEvidenceItemsForCap } from "../../mif/market-evidence/package.js";
import type { MifMarketEvidencePackage, MifUnifiedMarketEvidence } from "../../mif/market-evidence/types.js";
import type { MifOrchestrationResult } from "../../mif/orchestration/types.js";
import type {
  MifDirectionalScenario,
  MifScenarioPackage,
} from "../../mif/scenario-intelligence/types.js";

function clipNote(s: unknown, max = HFM_UNIFIED_AI_MAX_NOTE_CHARS): string {
  const t = String(s ?? "");
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function sampleCandles(
  candles: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    tickVolume: number | null;
    realVolume: number | null;
    isCurrent?: boolean;
  }>,
  max = HFM_UNIFIED_AI_MAX_CANDLES_PER_TF,
): unknown[] {
  if (candles.length <= max) {
    return candles.map((c) => ({
      t: c.timestamp,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      tv: c.tickVolume,
      rv: c.realVolume,
      cur: Boolean(c.isCurrent),
    }));
  }
  const out: typeof candles = [];
  const step = (candles.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) {
    const idx = Math.min(candles.length - 1, Math.round(i * step));
    out.push(candles[idx]!);
  }
  if (out[out.length - 1] !== candles[candles.length - 1]) {
    out[out.length - 1] = candles[candles.length - 1]!;
  }
  return out.map((c) => ({
    t: c.timestamp,
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    tv: c.tickVolume,
    rv: c.realVolume,
    cur: Boolean(c.isCurrent),
  }));
}

function addFinitePrice(set: Set<number>, v: unknown): void {
  if (typeof v === "number" && Number.isFinite(v)) set.add(v);
}

/** Prefer numeric indicator + provenance measurements over meta presence fields for AI. */
function prioritizeMeasurementsForAi(
  measurements: readonly MifUnifiedMarketEvidence["measurements"][number][],
  max = 16,
): MifUnifiedMarketEvidence["measurements"][number][] {
  const priority = new Set([
    "rsi",
    "roc",
    "atr",
    "rsiPeriod",
    "rocPeriod",
    "atrPeriod",
    "rsiMethod",
    "rocMethod",
    "atrMethod",
    "trAtr",
    "bodyAtr",
    "tipOpenTimeSec",
    "tipCloseTimeSec",
    "candleState",
    "timeframe",
    "symbol",
    "conflictKind",
    "resolutionStatus",
    "structurePrice",
    "supportMid",
    "resistanceMid",
    "primaryMid",
    "liquidityPrice",
    "calculationStatus",
    "dataQualityStatus",
    "direction",
    "phase",
    "overallRegimeLabel",
    "warmUpComplete",
    "snapshotRef",
  ]);
  const preferred = measurements.filter((m) => priority.has(String(m.id)));
  const rest = measurements.filter((m) => !priority.has(String(m.id)));
  return [...preferred, ...rest].slice(0, max);
}

function summarizeEvidenceItem(e: MifUnifiedMarketEvidence): Record<string, unknown> {
  return {
    evidenceId: e.evidenceId,
    evidenceType: e.evidenceType,
    direction: e.direction,
    timeframe: e.timeframe,
    sourceEngine: e.sourceEngine,
    candleStatus: e.candleStatus,
    observedAt: e.observedAt,
    eventTime: e.eventTime,
    levels: (e.levels ?? []).map((lv) => ({
      id: lv.id,
      kind: lv.kind,
      price: lv.price,
      side: lv.side,
      note: lv.note != null ? clipNote(lv.note, 120) : null,
    })),
    measurements: prioritizeMeasurementsForAi(e.measurements ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      value: m.value,
      unit: m.unit,
      note: m.note != null ? clipNote(String(m.note), 120) : null,
    })),
    supportingEvidenceIds: e.supportingEvidenceIds ?? [],
    conflictingEvidenceIds: e.conflictingEvidenceIds ?? [],
    warnings: (e.warnings ?? []).slice(0, 6).map((w) => clipNote(w)),
    limitations: (e.limitations ?? []).slice(0, 6).map((w) => clipNote(w)),
    score: e.score
      ? {
          confidenceType: e.score.confidenceType,
          value: e.score.value,
          scale: e.score.scale,
          isWinProbability: e.score.isWinProbability,
          definition: clipNote(e.score.definition, 160),
        }
      : null,
    provenance: {
      sourceAssessmentId: e.provenance?.sourceAssessmentId ?? null,
      snapshotId: e.provenance?.snapshotId ?? null,
      snapshotIdSourceVerified: e.provenance?.snapshotIdSourceVerified ?? false,
      sourceFingerprint: e.provenance?.sourceFingerprint ?? null,
    },
  };
}

function summarizeScenario(
  s: MifDirectionalScenario,
  allowEvidenceIds?: ReadonlySet<string>,
): Record<string, unknown> {
  const support = allowEvidenceIds
    ? filterIdsToAllowlist(s.supportingEvidenceIds, allowEvidenceIds)
    : { ids: [...(s.supportingEvidenceIds ?? [])], dropped: [] as string[] };
  const conflict = allowEvidenceIds
    ? filterIdsToAllowlist(s.conflictingEvidenceIds, allowEvidenceIds)
    : { ids: [...(s.conflictingEvidenceIds ?? [])], dropped: [] as string[] };
  return {
    scenarioId: s.scenarioId,
    setupFingerprint: s.setupFingerprint,
    side: s.side,
    status: s.status,
    lifecycleState: s.lifecycleState,
    thesis: clipNote(s.thesis, 400),
    rationale: clipNote(s.rationale, 400),
    supportingEvidenceIds: support.ids,
    conflictingEvidenceIds: conflict.ids,
    evidenceIdsScrubbedFromPackage:
      support.dropped.length + conflict.dropped.length > 0
        ? {
            droppedSupportSample: support.dropped.slice(0, 8),
            droppedConflictSample: conflict.dropped.slice(0, 8),
          }
        : null,
    missingConfirmations: (s.missingConfirmations ?? []).map((x) => clipNote(x)),
    invalidationConditions: (s.invalidationConditions ?? []).map((x) => clipNote(x)),
    contributingCandidateIds: [...(s.contributingCandidateIds ?? [])].slice(
      0,
      HFM_UNIFIED_AI_MAX_CANDIDATES,
    ),
    levels: {
      status: s.levels.status,
      entry: s.levels.entry,
      invalidation: s.levels.invalidation,
      targets: s.levels.targets,
      riskReward: s.levels.riskReward,
      notes: (s.levels.notes ?? []).map((n) => clipNote(n)),
    },
    evidenceCompleteness: s.evidenceCompleteness,
    warnings: (s.warnings ?? []).map((w) => clipNote(w)),
    assessmentTimestamp: s.assessmentTimestamp,
    snapshotId: s.snapshotId,
    snapshotIdSourceVerified: s.snapshotIdSourceVerified,
    analyticalScenarioOnly: true,
    notExecutable: true,
  };
}

function collectScenarioPrices(s: MifDirectionalScenario | null | undefined, into: Set<number>): void {
  if (!s?.levels) return;
  addFinitePrice(into, s.levels.entry?.price);
  addFinitePrice(into, s.levels.invalidation?.price);
  for (const t of s.levels.targets ?? []) addFinitePrice(into, t.price);
}

function collectEvidencePrices(items: readonly MifUnifiedMarketEvidence[], into: Set<number>): void {
  for (const e of items) {
    for (const lv of e.levels ?? []) addFinitePrice(into, lv.price);
  }
}

export type { HfmUnifiedInputCompleteness };

export interface HfmUnifiedAiGroundingAllowlist {
  allowedEvidenceIds: string[];
  allowedScenarioIds: string[];
  allowedCandidateIds: string[];
  allowedPrices: number[];
  formingOnlyConfirmationBlocked: boolean;
  scenarioOutcome: string | null;
  rankingIsNotProbability: true;
}

export interface HfmUnifiedAiAnalysisInputBuildResult {
  contractId: typeof HFM_UNIFIED_AI_INPUT_CONTRACT_ID;
  contractVersion: typeof HFM_UNIFIED_AI_INPUT_CONTRACT_VERSION;
  packageObject: Record<string, unknown>;
  json: string;
  unifiedInputIdentity: string;
  completeness: HfmUnifiedInputCompleteness;
  warnings: string[];
  candleCounts: Record<string, number>;
  imageCount: number;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  scenarioIds: string[];
  grounding: HfmUnifiedAiGroundingAllowlist;
  truncated: boolean;
}

export interface BuildHfmUnifiedAiAnalysisInputArgs {
  analysisId: string;
  context: HfmAnalysisContextResult;
  imageRefs: HfmReasoningImageRef[];
  /** Phase 2/3 orchestration artifact for this snapshot (may be null). */
  orchestration: MifOrchestrationResult | null;
  /** Phase 4 scenario package for this snapshot (may be null). */
  scenarioPackage: MifScenarioPackage | null;
  /**
   * Phase 7 — optional economic calendar package summary (cache-only join).
   * Informational only; must never alter Phase 4 ranking.
   */
  fundamentalPackage?: Record<string, unknown> | null;
  maxEvidence?: number;
  maxCandidates?: number;
}

function isOrchestration(v: unknown): v is MifOrchestrationResult {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v)
    && typeof (v as MifOrchestrationResult).snapshotId === "string";
}

function isScenarioPackage(v: unknown): v is MifScenarioPackage {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v)
    && typeof (v as MifScenarioPackage).packageId === "string"
    && (v as MifScenarioPackage).bullishScenario != null
    && (v as MifScenarioPackage).bearishScenario != null;
}

function isEvidencePackage(v: unknown): v is MifMarketEvidencePackage {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v)
    && Array.isArray((v as MifMarketEvidencePackage).items)
    && typeof (v as MifMarketEvidencePackage).packageId === "string";
}

/**
 * Verify loaded artifacts belong to the exact Charts snapshot/symbol.
 * Returns warnings; never silently swaps packages.
 */
export function verifyUnifiedPackageIdentity(input: {
  snapshotId: string;
  snapshotHash: string;
  symbol: string;
  orchestration: unknown | null;
  scenarioPackage: unknown | null;
}): {
  orchestration: MifOrchestrationResult | null;
  scenarioPackage: MifScenarioPackage | null;
  evidencePackage: MifMarketEvidencePackage | null;
  warnings: string[];
  rejected: string[];
} {
  const warnings: string[] = [];
  const rejected: string[] = [];
  const snapId = String(input.snapshotId ?? "").trim();
  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  let orchestration: MifOrchestrationResult | null = null;
  let scenarioPackage: MifScenarioPackage | null = null;
  let evidencePackage: MifMarketEvidencePackage | null = null;

  if (input.orchestration == null) {
    warnings.push("intelligence_orchestration_missing");
  } else if (!isOrchestration(input.orchestration)) {
    rejected.push("intelligence_orchestration_malformed");
    warnings.push("intelligence_orchestration_malformed");
  } else {
    const orch = input.orchestration;
    if (orch.snapshotId !== snapId) {
      rejected.push("orchestration_snapshot_mismatch");
      warnings.push(`orchestration_snapshot_mismatch expected=${snapId} got=${orch.snapshotId}`);
    } else if (String(orch.providerSymbol ?? "").toUpperCase() !== symbol) {
      rejected.push("orchestration_symbol_mismatch");
      warnings.push(`orchestration_symbol_mismatch expected=${symbol} got=${orch.providerSymbol}`);
    } else {
      orchestration = orch;
      if (orch.snapshotHash && orch.snapshotHash !== input.snapshotHash) {
        warnings.push("orchestration_snapshot_hash_mismatch");
      }
      if (orch.evidencePackage && isEvidencePackage(orch.evidencePackage)) {
        const ep = orch.evidencePackage;
        // Phase 02 — Charts path requires package snapshotId when analysis snapshot is known.
        if (ep.snapshotId == null || String(ep.snapshotId).trim() === "") {
          warnings.push("evidence_package_snapshot_missing");
          rejected.push("evidence_package_snapshot_missing");
        } else if (ep.snapshotId !== snapId) {
          warnings.push("evidence_package_snapshot_mismatch");
          rejected.push("evidence_package_snapshot_mismatch");
        } else if (
          ep.providerSymbol
          && String(ep.providerSymbol).toUpperCase() !== symbol
        ) {
          warnings.push("evidence_package_symbol_mismatch");
          rejected.push("evidence_package_symbol_mismatch");
        } else {
          evidencePackage = ep;
        }
      } else if (orch.evidencePackageId) {
        warnings.push("evidence_package_absent_but_id_present");
      } else {
        warnings.push("evidence_package_missing");
      }
    }
  }

  if (input.scenarioPackage == null) {
    warnings.push("scenario_package_missing");
  } else if (!isScenarioPackage(input.scenarioPackage)) {
    rejected.push("scenario_package_malformed");
    warnings.push("scenario_package_malformed");
  } else {
    const sp = input.scenarioPackage;
    if (sp.snapshotId != null && sp.snapshotId !== snapId) {
      rejected.push("scenario_package_snapshot_mismatch");
      warnings.push(`scenario_package_snapshot_mismatch expected=${snapId} got=${sp.snapshotId}`);
    } else if (String(sp.providerSymbol ?? "").toUpperCase() !== symbol) {
      rejected.push("scenario_package_symbol_mismatch");
      warnings.push(`scenario_package_symbol_mismatch expected=${symbol} got=${sp.providerSymbol}`);
    } else {
      scenarioPackage = sp;
      if (sp.snapshotHash && sp.snapshotHash !== input.snapshotHash) {
        warnings.push("scenario_package_snapshot_hash_mismatch");
      }
    }
  }

  return { orchestration, scenarioPackage, evidencePackage, warnings, rejected };
}

/**
 * Build the versioned unified AI analysis input for Charts Analyze Now / Auto Analysis.
 */
export function buildHfmUnifiedAiAnalysisInput(
  args: BuildHfmUnifiedAiAnalysisInputArgs,
): HfmUnifiedAiAnalysisInputBuildResult {
  const snap = args.context.snapshot;
  if (!snap) {
    throw new Error("buildHfmUnifiedAiAnalysisInput: snapshot required");
  }

  const maxEvidence = Math.min(
    HFM_UNIFIED_AI_MAX_EVIDENCE,
    Math.max(1, args.maxEvidence ?? HFM_UNIFIED_AI_MAX_EVIDENCE),
  );
  const maxCandidates = Math.min(
    HFM_UNIFIED_AI_MAX_CANDIDATES,
    Math.max(1, args.maxCandidates ?? HFM_UNIFIED_AI_MAX_CANDIDATES),
  );

  const verified = verifyUnifiedPackageIdentity({
    snapshotId: snap.snapshotId,
    snapshotHash: snap.snapshotHash,
    symbol: snap.symbol,
    orchestration: args.orchestration,
    scenarioPackage: args.scenarioPackage,
  });

  const warnings = [...verified.warnings];
  const timeframes: Record<string, unknown> = {};
  const candleCounts: Record<string, number> = {};
  const missingTf: string[] = [];
  const staleTf: string[] = [];

  for (const tf of HFM_REASONING_CONTEXT_TFS) {
    const ds = snap.timeframes[tf];
    if (!ds) {
      timeframes[tf] = { timeframe: tf, missing: true };
      candleCounts[tf] = 0;
      missingTf.push(tf);
      continue;
    }
    const series = ds.current
      ? [...ds.historical.filter((c) => c.timestamp !== ds.current!.timestamp), ds.current]
      : ds.historical;
    candleCounts[tf] = series.length;
    if (ds.freshness === "STALE" || /stale/i.test(String(ds.validationStatus))) {
      staleTf.push(tf);
    }
    const isImageTf = (HFM_REASONING_REQUIRED_TFS as readonly string[]).includes(tf);
    timeframes[tf] = {
      timeframe: tf,
      symbol: ds.symbol,
      candleCount: series.length,
      oldestTimestamp: ds.oldestTimestamp,
      newestTimestamp: ds.newestTimestamp,
      freshness: ds.freshness,
      validationStatus: ds.validationStatus,
      hasCurrent: Boolean(ds.current),
      role: tf === "H4"
        ? "higher-timeframe text context (no chart image)"
        : tf === "H1"
        ? "higher-timeframe context"
        : tf === "M30"
        ? "intermediate structure"
        : tf === "M15"
        ? "setup development"
        : "trigger and confirmation",
      imageAttached: isImageTf,
      candlesSampled: sampleCandles(series, HFM_UNIFIED_AI_MAX_CANDLES_PER_TF),
      note: series.length > HFM_UNIFIED_AI_MAX_CANDLES_PER_TF
        ? `Sampled ${HFM_UNIFIED_AI_MAX_CANDLES_PER_TF} of ${series.length} candles; full count is authoritative.`
        : "Full candle series included.",
    };
  }

  if (missingTf.length) warnings.push(`missing_timeframes=${missingTf.join(",")}`);
  if (staleTf.length) warnings.push(`stale_timeframes=${staleTf.join(",")}`);

  const imageRefs = args.imageRefs.slice(0, 4);
  if (imageRefs.length !== 4) {
    warnings.push(`image_count=${imageRefs.length}_expected=4`);
  }

  let evidenceItems: MifUnifiedMarketEvidence[] = [];
  let evidenceTruncated = false;
  const evidencePkg = verified.evidencePackage;
  if (evidencePkg) {
    // Phase 02 — reuse Phase 01 priority cap (do not head-slice blindly).
    const capped = prioritizeEvidenceItemsForCap(evidencePkg.items, maxEvidence);
    if (capped.droppedIds.length > 0) {
      evidenceTruncated = true;
      warnings.push(`evidence_truncated_to_${maxEvidence}_of_${evidencePkg.items.length}`);
      warnings.push(
        `evidence_dropped_ids_sample=${capped.droppedIds.slice(0, 12).join(",")}`,
      );
    }
    evidenceItems = capped.kept;
  }

  const scenarioPkg = verified.scenarioPackage;
  let formingOnlyBlocked = false;
  if (scenarioPkg) {
    formingOnlyBlocked =
      scenarioPkg.bullishScenario.evidenceCompleteness.formingOnlyConfirmationBlocked
      || scenarioPkg.bearishScenario.evidenceCompleteness.formingOnlyConfirmationBlocked;
  } else {
    warnings.push("deterministic_scenarios_unavailable");
  }

  // Phase 01 — balanced allowlist: do not fill entirely from bullish first.
  const candidateIds = new Set<string>();
  if (scenarioPkg) {
    const bull = [...(scenarioPkg.bullishScenario.contributingCandidateIds ?? [])];
    const bear = [...(scenarioPkg.bearishScenario.contributingCandidateIds ?? [])];
    const half = Math.max(1, Math.floor(maxCandidates / 2));
    for (const id of bull.slice(0, half)) {
      if (candidateIds.size >= maxCandidates) break;
      candidateIds.add(id);
    }
    for (const id of bear.slice(0, half)) {
      if (candidateIds.size >= maxCandidates) break;
      candidateIds.add(id);
    }
    // Fill remaining slots round-robin from leftovers.
    let i = half;
    while (candidateIds.size < maxCandidates && (i < bull.length || i < bear.length)) {
      if (i < bull.length) candidateIds.add(bull[i]!);
      if (candidateIds.size >= maxCandidates) break;
      if (i < bear.length) candidateIds.add(bear[i]!);
      i += 1;
    }
  }

  const allowedPrices = new Set<number>();
  collectEvidencePrices(evidenceItems, allowedPrices);
  if (scenarioPkg) {
    collectScenarioPrices(scenarioPkg.bullishScenario, allowedPrices);
    collectScenarioPrices(scenarioPkg.bearishScenario, allowedPrices);
  }

  let allowedEvidenceIds = evidenceItems.map((e) => e.evidenceId).sort();
  const allowEvidenceSet = new Set(allowedEvidenceIds);
  // Compact presence matrix so AI can distinguish ABSENT (missing) from opposing evidence.
  let productionEvidencePresence = evidenceItems
    .map((e) => {
      const presence = e.measurements?.find((m) => m.id === "presence")?.value ?? null;
      const family = e.measurements?.find((m) => m.id === "family")?.value ?? null;
      if (presence == null && family == null) return null;
      return {
        evidenceId: e.evidenceId,
        family,
        presence,
        note:
          presence === "ABSENT"
            ? "missing_or_insufficient_not_directional"
            : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .slice(0, maxEvidence);
  const scenarioIds = scenarioPkg
    ? [scenarioPkg.bullishScenario.scenarioId, scenarioPkg.bearishScenario.scenarioId]
    : [];
  const staleEvidenceCount = evidenceItems.filter(
    (e) => String(e.candleStatus ?? "").toUpperCase() === "STALE",
  ).length;
  if (staleEvidenceCount > 0) {
    warnings.push(`stale_evidence_items=${staleEvidenceCount}`);
  }
  const engineConflictItem = evidenceItems.find(
    (e) => e.evidenceId === "ume.engine_conflict.regime_dti_structure",
  );
  const engineConflictKind =
    engineConflictItem?.measurements?.find((m) => m.id === "conflictKind")?.value
    ?? null;

  const fusionPkg = verified.orchestration?.directionalFusion ?? null;
  const rankingSummary = verified.orchestration
    ? {
        isWinProbability: false as const,
        note: "Deterministic ranking / scenario outcome / directional fusion are non-probability guidance. OpenAI must not treat scores as win probability.",
        orchestrationStatus: verified.orchestration.orchestrationStatus,
        evidenceTrustedComplete: verified.orchestration.completeness?.evidenceTrustedComplete ?? false,
        scenarioOutcome: scenarioPkg?.outcome ?? null,
        strongerSide: scenarioPkg?.strongerSide ?? null,
        comparisonExplanation: scenarioPkg
          ? clipNote(scenarioPkg.comparisonExplanation, 400)
          : null,
        directionalFusionDirection: fusionPkg?.conviction.direction ?? null,
        directionalConvictionScore: fusionPkg?.conviction.directionalConvictionScore ?? null,
      }
    : {
        isWinProbability: false as const,
        note: "No deterministic ranking available for this snapshot.",
        orchestrationStatus: null,
        evidenceTrustedComplete: false,
        scenarioOutcome: null,
        strongerSide: null,
        comparisonExplanation: null,
        directionalFusionDirection: null,
        directionalConvictionScore: null,
      };

  const truncated = evidenceTruncated || imageRefs.length !== 4;
  const packagesComplete = Boolean(evidencePkg && scenarioPkg && verified.rejected.length === 0);
  const completeness: HfmUnifiedInputCompleteness =
    packagesComplete && !truncated && missingTf.length === 0 && warnings.every((w) =>
      !/mismatch|missing|malformed|unavailable|stale|truncated/i.test(w)
    )
      ? "COMPLETE"
      : "PARTIAL";

  if (completeness === "PARTIAL") {
    warnings.push("input_completeness=PARTIAL");
  }

  const packageObject: Record<string, unknown> = {
    contractId: HFM_UNIFIED_AI_INPUT_CONTRACT_ID,
    contractVersion: HFM_UNIFIED_AI_INPUT_CONTRACT_VERSION,
    completeness,
    truncated,
    provider: snap.provider,
    symbol: snap.symbol,
    analysisId: args.analysisId,
    contextId: snap.snapshotId,
    snapshotId: snap.snapshotId,
    snapshotHash: snap.snapshotHash,
    capturedAt: snap.capturedAt,
    assessmentTimestamp: new Date().toISOString(),
    chartTimeframeAtStart: snap.chartTimeframeAtStart,
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    schemaVersion: HFM_REASONING_SCHEMA_VERSION,
    marketContext: {
      quote: snap.quote ?? null,
      dataQuality: snap.dataQuality,
      synchronization: snap.synchronization,
      candleTipStates: verified.orchestration?.candleTipStates ?? null,
      timeframes,
      missingTimeframeWarnings: missingTf,
      staleTimeframeWarnings: staleTf,
    },
    deterministicEvidence: {
      evidencePackageId: evidencePkg?.packageId ?? verified.orchestration?.evidencePackageId ?? null,
      evidencePackageVersion: evidencePkg?.contractVersion ?? null,
      evidenceContractId: evidencePkg?.contractId ?? null,
      itemCount: evidenceItems.length,
      totalAvailable: evidencePkg?.items.length ?? 0,
      truncated: evidenceTruncated,
      items: evidenceItems.map(summarizeEvidenceItem),
      productionEvidencePresence,
      relations: (evidencePkg?.relations ?? []).slice(0, 40),
      packageWarnings: (evidencePkg?.warnings ?? []).map((w) => clipNote(w)),
      packageLimitations: (evidencePkg?.limitations ?? []).map((w) => clipNote(w)),
      provenanceTrusted: evidencePkg?.snapshotIdSourceVerified ?? false,
    },
    scenarioPackage: scenarioPkg
      ? {
          scenarioPackageId: scenarioPkg.packageId,
          contractId: scenarioPkg.contractId,
          contractVersion: scenarioPkg.contractVersion,
          engineId: scenarioPkg.engineId,
          engineVersion: scenarioPkg.engineVersion,
          outcome: scenarioPkg.outcome,
          strongerSide: scenarioPkg.strongerSide,
          comparisonExplanation: clipNote(scenarioPkg.comparisonExplanation, 400),
          completenessTrusted: scenarioPkg.completenessTrusted,
          warnings: (scenarioPkg.warnings ?? []).map((w) => clipNote(w)),
          timeframeContext: scenarioPkg.timeframeContext,
          bullishScenario: summarizeScenario(
            scenarioPkg.bullishScenario,
            allowEvidenceSet,
          ),
          bearishScenario: summarizeScenario(
            scenarioPkg.bearishScenario,
            allowEvidenceSet,
          ),
          crossSnapshotContinuity: {
            snapshotId: scenarioPkg.snapshotId,
            snapshotHash: scenarioPkg.snapshotHash,
            snapshotIdSourceVerified: scenarioPkg.snapshotIdSourceVerified,
          },
        }
      : null,
    /** Deterministic BUY|SELL fusion — primary directional guidance (not execution auth). */
    directionalFusion: fusionPkg
      ? {
          contractId: fusionPkg.contractId,
          contractVersion: fusionPkg.contractVersion,
          engineId: fusionPkg.engineId,
          engineVersion: fusionPkg.engineVersion,
          direction: fusionPkg.conviction.direction,
          directionalConvictionScore: fusionPkg.conviction.directionalConvictionScore,
          convictionLabel: fusionPkg.conviction.convictionLabel,
          bullishEvidenceScore: fusionPkg.conviction.bullishEvidenceScore,
          bearishEvidenceScore: fusionPkg.conviction.bearishEvidenceScore,
          evidenceCompleteness: fusionPkg.conviction.evidenceCompleteness,
          dataQuality: fusionPkg.conviction.dataQuality,
          conflictSeverity: fusionPkg.conviction.conflictSeverity,
          conflictKind: fusionPkg.conviction.conflictKind,
          supportingEngineIds: fusionPkg.conviction.supportingEngineIds.slice(0, 24),
          contradictingEngineIds: fusionPkg.conviction.contradictingEngineIds.slice(0, 24),
          keyEvidence: fusionPkg.conviction.keyEvidence.slice(0, 12).map((k) => clipNote(k, 160)),
          knownLimitations: fusionPkg.conviction.knownLimitations.slice(0, 16).map((k) => clipNote(k, 120)),
          calculationVersion: fusionPkg.conviction.calculationVersion,
          tieBreakApplied: fusionPkg.conviction.tieBreakApplied,
          tieBreakReason: fusionPkg.conviction.tieBreakReason,
          scoreSemantics: fusionPkg.conviction.scoreSemantics,
          executionAuthorizationImplied: false as const,
          familyCapsApplied: fusionPkg.familyCapsApplied,
          note: "Primary market direction MUST be BUY or SELL. Fusion score is analytical conviction, not win probability, and does not authorize execution.",
        }
      : null,
    /** Phase 7 economic calendar — informational; never modifies Phase 4 ranking. */
    fundamentalPackage: args.fundamentalPackage ?? {
      availability: "NOT_CONFIGURED",
      informationalOnly: true,
      rankingUnaffected: true,
      events: [],
      note: "No fundamentalPackage supplied for this analysis.",
    },
    analysisMetadata: {
      analysisId: args.analysisId,
      snapshotId: snap.snapshotId,
      snapshotHash: snap.snapshotHash,
      evidencePackageId: evidencePkg?.packageId ?? null,
      scenarioPackageId: scenarioPkg?.packageId ?? null,
      promptVersion: HFM_REASONING_PROMPT_VERSION,
      schemaVersion: HFM_REASONING_SCHEMA_VERSION,
      rankingSummary,
      dataQualityWarnings: [
        ...(snap.dataQuality?.warnings ?? []),
        ...warnings,
      ].map((w) => clipNote(w)),
      inputCompleteness: completeness,
    },
    images: imageRefs.map((r) => ({
      timeframe: r.timeframe,
      imageId: r.imageId,
      imageHash: r.imageHash,
      orderHint: `Image for ${r.timeframe} follows in multimodal payload`,
    })),
    availableEvidenceIds: allowedEvidenceIds,
    availableScenarioIds: scenarioIds,
    availableCandidateIds: [...candidateIds].sort(),
    allowedSourcePrices: [...allowedPrices].sort((a, b) => a - b),
    knownLimitations: [
      "rankingScore≠winProbability",
      "decision.confidence≠winProbability",
      "H4_is_text_context_only",
      "exactly_four_chart_images_H1_M30_M15_M5",
      "AI_must_not_invent_prices_or_evidence_ids",
      "FORMING_candles_alone_cannot_confirm",
      "ABSENT_evidence_means_missing_or_insufficient_not_bearish_or_bullish",
      "fundamentalPackage_is_informational_only_does_not_alter_phase4_ranking",
      "do_not_invent_economic_releases_forecasts_or_actuals",
      "Charts_path_skipProbability_ranking_only_not_calibrated_probability",
      "scenario_evidence_ids_scrubbed_to_availableEvidenceIds",
      ...(staleEvidenceCount > 0
        ? ["stale_evidence_present_do_not_confirm_from_stale_only"]
        : []),
      ...(completeness === "PARTIAL" ? ["input_package_PARTIAL_do_not_describe_as_complete"] : []),
      ...(formingOnlyBlocked ? ["formingOnlyConfirmationBlocked=true"] : []),
      ...(engineConflictKind && engineConflictKind !== "AGREEMENT"
        ? [
            `engine_conflict_kind=${String(engineConflictKind)}`,
            "do_not_silently_prefer_one_engine_when_conflict_present",
            "DTI_overallRegimeLabel_is_presentation_overlay_not_independent_regime_vote",
          ]
        : []),
    ],
    safety: {
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      analyticalOnly: true,
    },
    inputWarnings: warnings,
  };

  // Phase 01 — compute identity before final stringify; never discard size bound
  // by re-stringifying an untruncated packageObject after a hard slice.
  const identityPayload = {
    contractId: HFM_UNIFIED_AI_INPUT_CONTRACT_ID,
    contractVersion: HFM_UNIFIED_AI_INPUT_CONTRACT_VERSION,
    snapshotId: snap.snapshotId,
    snapshotHash: snap.snapshotHash,
    symbol: snap.symbol,
    evidencePackageId: evidencePkg?.packageId ?? null,
    scenarioPackageId: scenarioPkg?.packageId ?? null,
    availableEvidenceIds: allowedEvidenceIds,
    availableScenarioIds: scenarioIds,
    completeness,
    imageHashes: imageRefs.map((r) => r.imageHash).sort(),
  };
  const unifiedInputIdentity = createHash("sha256")
    .update(stableSerialize(identityPayload), "utf8")
    .digest("hex");
  packageObject.unifiedInputIdentity = unifiedInputIdentity;

  let json = JSON.stringify(packageObject);
  let sizeTruncated = false;
  if (json.length > HFM_UNIFIED_AI_MAX_JSON_CHARS) {
    sizeTruncated = true;
    const mc = packageObject.marketContext as Record<string, unknown>;
    const tfs = mc.timeframes as Record<string, Record<string, unknown>>;
    for (const tf of Object.keys(tfs)) {
      if (tfs[tf] && typeof tfs[tf] === "object") {
        tfs[tf] = {
          ...tfs[tf],
          candlesSampled: Array.isArray(tfs[tf]!.candlesSampled)
            ? (tfs[tf]!.candlesSampled as unknown[]).slice(-12)
            : [],
          note: "Candle samples truncated for JSON size bound; counts remain authoritative.",
        };
      }
    }
    packageObject.truncated = true;
    packageObject.completeness = "PARTIAL";
    (packageObject.inputWarnings as string[]).push("json_size_truncated");
    warnings.push("json_size_truncated");
    json = JSON.stringify(packageObject);
    if (json.length > HFM_UNIFIED_AI_MAX_JSON_CHARS) {
      // Drop evidence item bodies further rather than mid-JSON slice.
      const det = packageObject.deterministicEvidence as Record<string, unknown>;
      if (Array.isArray(det.items)) {
        det.items = (det.items as unknown[]).slice(0, Math.min(40, (det.items as unknown[]).length));
        det.truncated = true;
        det.itemCount = (det.items as unknown[]).length;
        // Phase 02 — keep allowlist / scenario citations aligned with emitted bodies.
        const keptIds = new Set(
          (det.items as Array<{ evidenceId?: string }>)
            .map((x) => x.evidenceId)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        );
        allowedEvidenceIds = [...keptIds].sort();
        packageObject.availableEvidenceIds = allowedEvidenceIds;
        if (Array.isArray(det.productionEvidencePresence)) {
          det.productionEvidencePresence = (
            det.productionEvidencePresence as Array<{ evidenceId: string }>
          ).filter((row) => keptIds.has(row.evidenceId));
          productionEvidencePresence = det.productionEvidencePresence as typeof productionEvidencePresence;
        }
        if (scenarioPkg && packageObject.scenarioPackage) {
          const sp = packageObject.scenarioPackage as Record<string, unknown>;
          sp.bullishScenario = summarizeScenario(scenarioPkg.bullishScenario, keptIds);
          sp.bearishScenario = summarizeScenario(scenarioPkg.bearishScenario, keptIds);
        }
      }
      (packageObject.inputWarnings as string[]).push("json_size_evidence_shrunk");
      warnings.push("json_size_evidence_shrunk");
      json = JSON.stringify(packageObject);
      if (json.length > HFM_UNIFIED_AI_MAX_JSON_CHARS) {
        packageObject.completeness = "PARTIAL";
        (packageObject.inputWarnings as string[]).push("json_size_exceeds_bound_partial");
        warnings.push("json_size_exceeds_bound_partial");
        // Last resort: omit candle samples entirely.
        for (const tf of Object.keys(tfs)) {
          if (tfs[tf] && typeof tfs[tf] === "object") {
            tfs[tf] = { ...tfs[tf], candlesSampled: [], note: "Candles omitted for JSON size bound." };
          }
        }
        json = JSON.stringify(packageObject);
      }
    }
  }

  const finalCompleteness: HfmUnifiedInputCompleteness =
    sizeTruncated || truncated || completeness === "PARTIAL" ? "PARTIAL" : "COMPLETE";

  return {
    contractId: HFM_UNIFIED_AI_INPUT_CONTRACT_ID,
    contractVersion: HFM_UNIFIED_AI_INPUT_CONTRACT_VERSION,
    packageObject,
    json,
    unifiedInputIdentity,
    completeness: finalCompleteness,
    warnings,
    candleCounts,
    imageCount: imageRefs.length,
    evidencePackageId: evidencePkg?.packageId ?? null,
    scenarioPackageId: scenarioPkg?.packageId ?? null,
    scenarioIds,
    truncated: truncated || sizeTruncated,
    grounding: {
      allowedEvidenceIds,
      allowedScenarioIds: scenarioIds,
      allowedCandidateIds: [...candidateIds].sort(),
      allowedPrices: [...allowedPrices].sort((a, b) => a - b),
      formingOnlyConfirmationBlocked: formingOnlyBlocked,
      scenarioOutcome: scenarioPkg?.outcome ?? null,
      rankingIsNotProbability: true,
    },
  };
}

/**
 * Load orchestration + scenario artifacts for a snapshot from analysis storage shape.
 */
export function extractPackagesFromLoadedArtifacts(input: {
  orchestrationRaw: unknown | null;
  scenarioRaw: unknown | null;
}): {
  orchestration: MifOrchestrationResult | null;
  scenarioPackage: MifScenarioPackage | null;
} {
  let orchestration: MifOrchestrationResult | null = null;
  if (isOrchestration(input.orchestrationRaw)) {
    orchestration = input.orchestrationRaw;
  }
  let scenarioPackage: MifScenarioPackage | null = null;
  if (isScenarioPackage(input.scenarioRaw)) {
    scenarioPackage = input.scenarioRaw;
  } else if (
    orchestration
    && orchestration.scenarioPackage
    && isScenarioPackage(orchestration.scenarioPackage)
  ) {
    scenarioPackage = orchestration.scenarioPackage;
  }
  return { orchestration, scenarioPackage };
}
