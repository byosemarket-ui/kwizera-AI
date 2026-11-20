/**
 * Phase 5F STEP 2 — bounded deterministic analogue search.
 * Serial only. Similarity computed before any outcome attachment.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../../quality/stable-identity.js";
import { clipResearchBarsToTip } from "../replay-bridge.js";
import type { MifHistoricalResearchStorage } from "../storage.js";
import type { MifResearchDatasetManifest, MifResearchStoredBar } from "../types.js";
import {
  MIF_ANALOGUE_CONTRACT_ID,
  MIF_ANALOGUE_CONTRACT_VERSION,
  MIF_ANALOGUE_DEFAULT_MAX_CANDIDATES_SCANNED,
  MIF_ANALOGUE_DEFAULT_MAX_DATASETS,
  MIF_ANALOGUE_DEFAULT_MAX_RESULTS,
  MIF_ANALOGUE_DEFAULT_MIN_FEATURE_COVERAGE,
  MIF_ANALOGUE_DEFAULT_OUTCOME_HORIZONS,
  MIF_ANALOGUE_DEFAULT_OVERLAP_IOU,
  MIF_ANALOGUE_DEFAULT_STRIDE,
  MIF_ANALOGUE_DEFAULT_TIMEOUT_MS,
  MIF_ANALOGUE_ENGINE_ID,
  MIF_ANALOGUE_ENGINE_VERSION,
  MIF_ANALOGUE_FEATURE_SET_ID,
  MIF_ANALOGUE_FEATURE_SET_VERSION,
  MIF_ANALOGUE_HARD_MAX_RESULTS,
  MIF_ANALOGUE_NORMALIZATION_POLICY_ID,
  MIF_ANALOGUE_NORMALIZATION_POLICY_VERSION,
  MIF_ANALOGUE_OVERLAP_POLICY_ID,
  MIF_ANALOGUE_OVERLAP_POLICY_VERSION,
  MIF_ANALOGUE_SIMILARITY_ALGORITHM_ID,
  MIF_ANALOGUE_SIMILARITY_ALGORITHM_VERSION,
  MIF_ANALOGUE_WEIGHT_TABLE_ID,
  MIF_ANALOGUE_WEIGHT_TABLE_VERSION,
  type MifAnalogueEligibilityMode,
} from "./contracts.js";
import { assessAnalogueDatasetEligibility, resolveComparisonMode } from "./eligibility.js";
import { extractAnalogueFeatures } from "./features.js";
import { suppressOverlappingAnalogues } from "./overlap.js";
import { attachAnalogueOutcomes } from "./outcomes.js";
import { scoreAnalogueSimilarity } from "./similarity.js";
import {
  MIF_ANALOGUE_SAFETY,
  type MifAnalogueCandidateRecord,
  type MifAnalogueExclusionReason,
  type MifAnalogueReferenceState,
  type MifAnalogueSearchParams,
  type MifAnalogueSearchRecord,
  type MifAnalogueSearchStatus,
} from "./types.js";

export interface RunAnalogueSearchInput {
  storage: MifHistoricalResearchStorage;
  reference: MifAnalogueReferenceState;
  /** Optional override corpus; default = all COMPLETE eligible registry entries. */
  corpusDatasetIds?: readonly string[];
  params?: Partial<MifAnalogueSearchParams>;
  signal?: { aborted?: boolean };
  nowMs?: () => number;
}

function defaultParams(p?: Partial<MifAnalogueSearchParams>): MifAnalogueSearchParams {
  return {
    eligibilityMode: (p?.eligibilityMode ?? "PRICE_ACTION") as MifAnalogueEligibilityMode,
    lookbackBars: p?.lookbackBars ?? 32,
    warmupBars: p?.warmupBars ?? 40,
    maxDatasets: Math.min(200, Math.max(1, p?.maxDatasets ?? MIF_ANALOGUE_DEFAULT_MAX_DATASETS)),
    maxCandidatesScanned: Math.min(
      50_000,
      Math.max(1, p?.maxCandidatesScanned ?? MIF_ANALOGUE_DEFAULT_MAX_CANDIDATES_SCANNED),
    ),
    maxResults: Math.min(
      MIF_ANALOGUE_HARD_MAX_RESULTS,
      Math.max(1, p?.maxResults ?? MIF_ANALOGUE_DEFAULT_MAX_RESULTS),
    ),
    stride: Math.max(1, p?.stride ?? MIF_ANALOGUE_DEFAULT_STRIDE),
    timeoutMs: Math.max(100, p?.timeoutMs ?? MIF_ANALOGUE_DEFAULT_TIMEOUT_MS),
    minFeatureCoverage: Math.min(
      1,
      Math.max(0.1, p?.minFeatureCoverage ?? MIF_ANALOGUE_DEFAULT_MIN_FEATURE_COVERAGE),
    ),
    overlapIouThreshold: Math.min(
      1,
      Math.max(0, p?.overlapIouThreshold ?? MIF_ANALOGUE_DEFAULT_OVERLAP_IOU),
    ),
    outcomeHorizons: p?.outcomeHorizons ?? [...MIF_ANALOGUE_DEFAULT_OUTCOME_HORIZONS],
    allowCrossInstrument: p?.allowCrossInstrument ?? true,
    includeStructureFeatures: p?.includeStructureFeatures ?? false,
  };
}

function compareRank(a: MifAnalogueCandidateRecord, b: MifAnalogueCandidateRecord): number {
  if (b.similarity.score !== a.similarity.score) return b.similarity.score - a.similarity.score;
  if (a.tipOpenTimeSec !== b.tipOpenTimeSec) return a.tipOpenTimeSec - b.tipOpenTimeSec;
  const ds = a.datasetId.localeCompare(b.datasetId);
  if (ds !== 0) return ds;
  const inst = a.instrument.localeCompare(b.instrument);
  if (inst !== 0) return inst;
  return a.timeframe.localeCompare(b.timeframe);
}

function bump(
  map: Map<MifAnalogueExclusionReason, number>,
  reason: MifAnalogueExclusionReason,
): void {
  map.set(reason, (map.get(reason) ?? 0) + 1);
}

function tipClose(bars: readonly MifResearchStoredBar[], tip: number): number {
  const b = bars.find((x) => x.time === tip);
  return b?.close ?? NaN;
}

export async function runAnalogueSearch(
  input: RunAnalogueSearchInput,
): Promise<MifAnalogueSearchRecord> {
  const started = (input.nowMs ?? Date.now)();
  const params = defaultParams({
    ...input.params,
    lookbackBars: input.params?.lookbackBars ?? input.reference.lookbackBars,
    warmupBars: input.params?.warmupBars ?? input.reference.warmupBars,
    eligibilityMode: input.params?.eligibilityMode ?? input.reference.eligibilityMode,
  });
  const exclusionCounts = new Map<MifAnalogueExclusionReason, number>();
  const scored: MifAnalogueCandidateRecord[] = [];
  const corpusMeta: MifAnalogueSearchRecord["corpus"] = [];

  let datasetsConsidered = 0;
  let datasetsExcluded = 0;
  let candidatesScanned = 0;
  let candidatesExcluded = 0;
  let candidatesScored = 0;
  let status: MifAnalogueSearchStatus = "COMPLETED";
  let statusReason: string | null = null;

  const registry = await input.storage.listRegistry();
  let entries = registry.filter((e) => e.status === "COMPLETE");
  if (input.corpusDatasetIds?.length) {
    const allow = new Set(input.corpusDatasetIds);
    entries = entries.filter((e) => allow.has(e.datasetId));
  }
  // Prefer latest version per datasetId
  const byId = new Map<string, (typeof entries)[number]>();
  for (const e of entries) {
    const prev = byId.get(e.datasetId);
    if (!prev || e.version > prev.version) byId.set(e.datasetId, e);
  }
  const corpusEntries = [...byId.values()]
    .sort((a, b) => a.datasetId.localeCompare(b.datasetId))
    .slice(0, params.maxDatasets);

  const need = params.lookbackBars + params.warmupBars;

  outer: for (const entry of corpusEntries) {
    if (input.signal?.aborted) {
      status = "CANCELLED";
      statusReason = "search cancelled";
      bump(exclusionCounts, "CANCELLED");
      break;
    }
    if ((input.nowMs ?? Date.now)() - started > params.timeoutMs) {
      status = "PARTIAL_TIMEOUT";
      statusReason = `timeout after ${params.timeoutMs}ms`;
      bump(exclusionCounts, "TIMEOUT");
      break;
    }

    datasetsConsidered += 1;
    const manifest = await input.storage.getDatasetManifest(entry.datasetId, entry.version);
    if (!manifest) {
      datasetsExcluded += 1;
      bump(exclusionCounts, "OTHER");
      continue;
    }
    const elig = assessAnalogueDatasetEligibility(manifest, params.eligibilityMode);
    if (!elig.eligible) {
      datasetsExcluded += 1;
      for (const r of elig.reasons) bump(exclusionCounts, r);
      continue;
    }

    const cmp = resolveComparisonMode({
      referenceInstrument: input.reference.instrument,
      referenceTimeframe: input.reference.timeframe,
      candidateInstrument: manifest.instrument,
      candidateTimeframe: manifest.timeframe,
      allowCrossInstrument: params.allowCrossInstrument,
    });
    if (!cmp.allowed) {
      datasetsExcluded += 1;
      bump(exclusionCounts, cmp.reason ?? "OTHER");
      continue;
    }

    const page = await input.storage.getDatasetBars(entry.datasetId, entry.version);
    if (!page || page.bars.length < need) {
      datasetsExcluded += 1;
      bump(exclusionCounts, "INSUFFICIENT_HISTORY");
      continue;
    }

    corpusMeta.push({
      datasetId: entry.datasetId,
      version: entry.version,
      contentHash: manifest.contentHash,
      instrument: manifest.instrument,
      timeframe: manifest.timeframe,
    });

    const bars = [...page.bars].sort((a, b) => a.time - b.time);

    // Candidate tips: indices where we have need bars ending at tip.
    for (let tipIdx = need - 1; tipIdx < bars.length; tipIdx += params.stride) {
      if (input.signal?.aborted) {
        status = "CANCELLED";
        statusReason = "search cancelled";
        bump(exclusionCounts, "CANCELLED");
        break outer;
      }
      if ((input.nowMs ?? Date.now)() - started > params.timeoutMs) {
        status = "PARTIAL_TIMEOUT";
        statusReason = `timeout after ${params.timeoutMs}ms`;
        bump(exclusionCounts, "TIMEOUT");
        break outer;
      }
      if (candidatesScanned >= params.maxCandidatesScanned) {
        status = "PARTIAL_TRUNCATED";
        statusReason = `maxCandidatesScanned=${params.maxCandidatesScanned}`;
        bump(exclusionCounts, "MAX_CANDIDATES_REACHED");
        break outer;
      }

      candidatesScanned += 1;
      const tipBar = bars[tipIdx]!;
      const tip = tipBar.time;

      // Exclude exact self-reference tip on same dataset
      if (
        entry.datasetId === input.reference.datasetId &&
        tip === input.reference.tipOpenTimeSec
      ) {
        candidatesExcluded += 1;
        bump(exclusionCounts, "SELF_REFERENCE_EXCLUDED");
        continue;
      }

      const throughTip = bars.slice(0, tipIdx + 1);
      const clipped = clipResearchBarsToTip(throughTip, tip);
      if (!clipped.noFutureLeakage || clipped.bars.length < need) {
        candidatesExcluded += 1;
        bump(exclusionCounts, clipped.noFutureLeakage ? "INSUFFICIENT_HISTORY" : "FUTURE_BARS_IN_WINDOW");
        continue;
      }
      const windowBars = clipped.bars.slice(clipped.bars.length - need);
      const features = extractAnalogueFeatures({
        barsThroughTip: windowBars,
        lookbackBars: params.lookbackBars,
        warmupBars: params.warmupBars,
      });
      const similarity = scoreAnalogueSimilarity({
        reference: input.reference.features,
        candidate: features,
        minFeatureCoverage: params.minFeatureCoverage,
      });
      if (similarity.insufficientComparableFeatures && similarity.comparableCoverage < params.minFeatureCoverage) {
        candidatesExcluded += 1;
        bump(exclusionCounts, "INSUFFICIENT_COMPARABLE_FEATURES");
        continue;
      }

      candidatesScored += 1;
      const lookStart = windowBars[windowBars.length - params.lookbackBars]!.time;
      const analogueId = `an:${createHash("sha256")
        .update(
          stableSerialize({
            ds: entry.datasetId,
            v: entry.version,
            tip,
            ref: input.reference.referenceId,
            score: similarity.score,
          }),
        )
        .digest("hex")
        .slice(0, 20)}`;

      const pitWarnings = [...input.reference.pitWarnings];
      const costWarnings = [...input.reference.costWarnings];
      if (manifest.researchEligibility?.metadataAuthority !== "HISTORICALLY_AUTHORITATIVE") {
        if (!pitWarnings.includes("METADATA_LIMITED: PIT sessions/specs are observation-only")) {
          pitWarnings.push("METADATA_LIMITED: PIT sessions/specs are observation-only");
        }
      }

      scored.push({
        analogueId,
        instrument: manifest.instrument,
        timeframe: manifest.timeframe,
        tipOpenTimeSec: tip,
        windowStartOpenTimeSec: lookStart,
        windowEndOpenTimeSec: tip,
        datasetId: entry.datasetId,
        datasetVersion: entry.version,
        contentHash: manifest.contentHash,
        similarity,
        explanation: {
          selectedBecause: `Similarity score ${similarity.score.toFixed(2)}/100 under ${similarity.algorithmId}@${similarity.algorithmVersion}`,
          factualNotes: [
            `Agreeing features: ${similarity.agreeingFeatures.slice(0, 8).join(", ") || "none"}`,
            `Disagreeing features: ${similarity.disagreeingFeatures.slice(0, 8).join(", ") || "none"}`,
            `Comparable coverage: ${(similarity.comparableCoverage * 100).toFixed(1)}%`,
            `Comparison mode: ${cmp.mode}`,
          ],
          disclaimer:
            "Historical similarity is not a probability, forecast, or trade recommendation. Past analogues do not guarantee future outcomes.",
        },
        qualityNotes: elig.notes,
        pitWarnings,
        costWarnings,
        outcome: null, // attached after ranking
        suppressed: false,
        suppressionReason: null,
      });
    }
  }

  scored.sort(compareRank);
  const { kept, suppressed } = suppressOverlappingAnalogues({
    ranked: scored,
    iouThreshold: params.overlapIouThreshold,
  });
  const top = kept.slice(0, params.maxResults);

  // Post-match outcomes only
  const withOutcomes: MifAnalogueCandidateRecord[] = [];
  for (const cand of top) {
    const page = await input.storage.getDatasetBars(cand.datasetId, cand.datasetVersion);
    const bars = page?.bars ?? [];
    const outcome = attachAnalogueOutcomes({
      tipOpenTimeSec: cand.tipOpenTimeSec,
      tipClose: tipClose(bars, cand.tipOpenTimeSec),
      bars,
      horizons: params.outcomeHorizons,
    });
    withOutcomes.push({ ...cand, outcome });
  }

  const durationMs = (input.nowMs ?? Date.now)() - started;
  const createdAt = new Date(started).toISOString();

  const policyVersions = {
    featureSetId: MIF_ANALOGUE_FEATURE_SET_ID,
    featureSetVersion: MIF_ANALOGUE_FEATURE_SET_VERSION,
    normalizationPolicyId: MIF_ANALOGUE_NORMALIZATION_POLICY_ID,
    normalizationPolicyVersion: MIF_ANALOGUE_NORMALIZATION_POLICY_VERSION,
    weightTableId: MIF_ANALOGUE_WEIGHT_TABLE_ID,
    weightTableVersion: MIF_ANALOGUE_WEIGHT_TABLE_VERSION,
    similarityAlgorithmId: MIF_ANALOGUE_SIMILARITY_ALGORITHM_ID,
    similarityAlgorithmVersion: MIF_ANALOGUE_SIMILARITY_ALGORITHM_VERSION,
    overlapPolicyId: MIF_ANALOGUE_OVERLAP_POLICY_ID,
    overlapPolicyVersion: MIF_ANALOGUE_OVERLAP_POLICY_VERSION,
  };

  const searchHash = createHash("sha256")
    .update(
      stableSerialize({
        referenceId: input.reference.referenceId,
        referenceHash: input.reference.contentHash,
        corpus: corpusMeta,
        params,
        policyVersions,
        contractVersion: MIF_ANALOGUE_CONTRACT_VERSION,
      }),
    )
    .digest("hex");
  const searchId = `search:${searchHash.slice(0, 24)}`;

  return {
    contractId: MIF_ANALOGUE_CONTRACT_ID,
    contractVersion: MIF_ANALOGUE_CONTRACT_VERSION,
    engineId: MIF_ANALOGUE_ENGINE_ID,
    engineVersion: MIF_ANALOGUE_ENGINE_VERSION,
    searchId,
    searchHash,
    createdAt,
    status,
    statusReason,
    reference: input.reference,
    params,
    corpus: corpusMeta,
    policyVersions,
    stats: {
      datasetsConsidered,
      datasetsExcluded,
      candidatesScanned,
      candidatesExcluded,
      candidatesScored,
      candidatesSuppressed: suppressed.length,
      resultsReturned: withOutcomes.length,
      durationMs,
    },
    exclusionSummary: [...exclusionCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => a.reason.localeCompare(b.reason)),
    analogues: withOutcomes,
    suppressedAnalogues: suppressed.slice(0, 50),
    ...MIF_ANALOGUE_SAFETY,
    researchReadOnly: true,
  };
}

/** Recompute similarity only (no outcomes) — for leakage tests. */
export function scoreCandidateWindowForTests(input: {
  reference: MifAnalogueReferenceState;
  barsThroughTip: readonly MifResearchStoredBar[];
  lookbackBars: number;
  warmupBars: number;
  minFeatureCoverage?: number;
}) {
  const features = extractAnalogueFeatures({
    barsThroughTip: input.barsThroughTip,
    lookbackBars: input.lookbackBars,
    warmupBars: input.warmupBars,
  });
  return scoreAnalogueSimilarity({
    reference: input.reference.features,
    candidate: features,
    minFeatureCoverage: input.minFeatureCoverage ?? 0.7,
  });
}
