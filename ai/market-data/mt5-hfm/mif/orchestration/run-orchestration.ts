/**
 * Phase 3 — bounded intelligence orchestration from a verified Charts snapshot.
 * Fail-open: callers may continue Charts OHLC+images path when this fails.
 * Ranking only — probability batch skipped. OD worker not used.
 */
import { randomUUID } from "node:crypto";
import type { HfmAnalysisMultiTfSnapshot } from "../../analysis/types.js";
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import { assembleEvidenceFromProduction } from "../market-evidence/assemble-from-production.js";
import { validateMarketEvidencePackage } from "../market-evidence/validate.js";
import { runMifHfmOpportunityPipelineFromSeries } from "../production-integration/run-pipeline.js";
import { getMifOdWorkerStatus } from "../production-integration/worker.js";
import { buildScenarioIntelligence } from "../scenario-intelligence/build-scenarios.js";
import type { MifScenarioPackage } from "../scenario-intelligence/types.js";
import {
  MIF_ORCHESTRATION_CONTRACT_ID,
  MIF_ORCHESTRATION_CONTRACT_VERSION,
  MIF_ORCHESTRATION_DEADLINE_MS,
  MIF_ORCHESTRATION_PRIMARY_TIMEFRAME,
  MIF_ORCHESTRATION_TF_PACK,
} from "./contracts.js";
import {
  isOrchestrationLocked,
  releaseOrchestrationLock,
  tryAcquireOrchestrationLock,
} from "./lock.js";
import { buildMifSeriesFromChartsSnapshot } from "./series-from-snapshot.js";
import type {
  MifOrchestrationCompleteness,
  MifOrchestrationResult,
  MifOrchestrationStatus,
  MifOrchestrationTimingsMs,
} from "./types.js";

function emptyTimings(): MifOrchestrationTimingsMs {
  return {
    validateMs: 0,
    seriesAdaptMs: 0,
    pipelineMs: 0,
    assembleMs: 0,
    persistMs: 0,
    totalMs: 0,
  };
}

function baseResult(partial: Partial<MifOrchestrationResult> & {
  correlationId: string;
  snapshotId: string;
  snapshotHash: string;
  hashVersion: string;
  providerSymbol: string;
  orchestrationStatus: MifOrchestrationStatus;
  completeness: MifOrchestrationCompleteness;
  snapshotIdSourceVerified?: boolean;
}): MifOrchestrationResult {
  const identityOk =
    partial.snapshotIdSourceVerified === true
    || (
      Boolean(String(partial.snapshotId || "").trim())
      && Boolean(String(partial.snapshotHash || "").trim())
      && partial.snapshotIdSourceVerified !== false
    );
  return {
    contractId: MIF_ORCHESTRATION_CONTRACT_ID,
    contractVersion: MIF_ORCHESTRATION_CONTRACT_VERSION,
    correlationId: partial.correlationId,
    snapshotId: partial.snapshotId,
    snapshotHash: partial.snapshotHash,
    hashVersion: partial.hashVersion,
    snapshotIdSourceVerified: identityOk,
    providerId: "HFM_MT5",
    providerSymbol: partial.providerSymbol,
    timeframePack: partial.timeframePack ?? MIF_ORCHESTRATION_TF_PACK,
    candleTipStates: partial.candleTipStates ?? {},
    mifRequestId: partial.mifRequestId ?? null,
    mifRunId: partial.mifRunId ?? null,
    evidencePackageId: partial.evidencePackageId ?? null,
    evidencePackage: partial.evidencePackage ?? null,
    scenarioPackage: partial.scenarioPackage ?? null,
    scenarioPackageId: partial.scenarioPackageId ?? null,
    orchestrationStatus: partial.orchestrationStatus,
    completeness: partial.completeness,
    warnings: partial.warnings ?? [],
    failureReason: partial.failureReason ?? null,
    timingsMs: partial.timingsMs ?? emptyTimings(),
    capturedAt: partial.capturedAt ?? new Date().toISOString(),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalOrchestrationOnly: true,
    notExecutable: true,
  };
}

export interface RunHfmIntelligenceOrchestrationInput {
  snapshot: HfmAnalysisMultiTfSnapshot;
  correlationId?: string | null;
  timeframePack?: readonly string[];
  deadlineMs?: number;
  /** When true, skip acquiring lock (caller already holds it). */
  alreadyLocked?: boolean;
}

/**
 * Orchestrate bounded MIF intelligence from an existing Charts snapshot.
 * Does not re-fetch HFM market data. Does not call OpenAI. Does not enable OD worker.
 */
export function runHfmIntelligenceOrchestration(
  input: RunHfmIntelligenceOrchestrationInput,
): MifOrchestrationResult {
  const started = Date.now();
  const timings = emptyTimings();
  const correlationId = String(input.correlationId || "").trim() || randomUUID();
  const pack = input.timeframePack ?? MIF_ORCHESTRATION_TF_PACK;
  const deadlineMs = input.deadlineMs ?? MIF_ORCHESTRATION_DEADLINE_MS;
  const deadlineAtMs = started + deadlineMs;
  const snap = input.snapshot;
  const symbol = String(snap.symbol || "").trim().toUpperCase();
  const warnings: string[] = [];

  const emptyCompleteness = (notes: string[]): MifOrchestrationCompleteness => ({
    expectedTimeframes: [...pack],
    presentTimeframes: [],
    missingTimeframes: [...pack],
    enginesCompleted: [],
    enginesSkipped: [],
    rankingIncluded: false,
    probabilityIncluded: false,
    scenarioIncluded: false,
    evidenceItemCount: 0,
    evidenceTrustedComplete: false,
    notes,
  });

  if (snap.provider !== "HFM_MT5" && snap.provider !== MIF_PROVIDER_ID) {
    return baseResult({
      correlationId,
      snapshotId: snap.snapshotId,
      snapshotHash: snap.snapshotHash,
      hashVersion: snap.hashVersion,
      providerSymbol: symbol,
      orchestrationStatus: "FAILED",
      completeness: emptyCompleteness(["WRONG_PROVIDER"]),
      warnings: ["WRONG_PROVIDER"],
      failureReason: "Snapshot provider is not HFM_MT5",
      timingsMs: { ...timings, totalMs: Date.now() - started },
      capturedAt: snap.capturedAt,
    });
  }

  if (!symbol) {
    return baseResult({
      correlationId,
      snapshotId: snap.snapshotId,
      snapshotHash: snap.snapshotHash,
      hashVersion: snap.hashVersion,
      providerSymbol: "",
      orchestrationStatus: "FAILED",
      completeness: emptyCompleteness(["MISSING_SYMBOL"]),
      warnings: ["MISSING_SYMBOL"],
      failureReason: "Snapshot symbol is required",
      timingsMs: { ...timings, totalMs: Date.now() - started },
      capturedAt: snap.capturedAt,
    });
  }

  if (!snap.snapshotId || !snap.snapshotHash) {
    return baseResult({
      correlationId,
      snapshotId: snap.snapshotId ?? "",
      snapshotHash: snap.snapshotHash ?? "",
      hashVersion: snap.hashVersion,
      providerSymbol: symbol,
      snapshotIdSourceVerified: false,
      orchestrationStatus: "FAILED",
      completeness: emptyCompleteness(["MISSING_SNAPSHOT_IDENTITY"]),
      warnings: ["MISSING_SNAPSHOT_IDENTITY"],
      failureReason: "Charts snapshotId/snapshotHash required; refusing to fabricate",
      timingsMs: { ...timings, totalMs: Date.now() - started },
      capturedAt: snap.capturedAt,
    });
  }

  const worker = getMifOdWorkerStatus();
  if (worker.enabled) {
    warnings.push("OD_WORKER_ENABLED_UNEXPECTED");
  }

  let acquired = input.alreadyLocked === true;
  if (!acquired) {
    acquired = tryAcquireOrchestrationLock(correlationId);
  }
  if (!acquired) {
    return baseResult({
      correlationId,
      snapshotId: snap.snapshotId,
      snapshotHash: snap.snapshotHash,
      hashVersion: snap.hashVersion,
      providerSymbol: symbol,
      orchestrationStatus: "SKIPPED",
      completeness: emptyCompleteness(["ORCHESTRATION_ALREADY_RUNNING"]),
      warnings: ["ORCHESTRATION_ALREADY_RUNNING", ...warnings],
      failureReason: "Another intelligence orchestration job is already running",
      timingsMs: { ...timings, totalMs: Date.now() - started },
      capturedAt: snap.capturedAt,
    });
  }

  try {
    const t0 = Date.now();
    const converted = buildMifSeriesFromChartsSnapshot({
      snapshot: snap,
      timeframePack: pack,
    });
    timings.seriesAdaptMs = Date.now() - t0;
    timings.validateMs = timings.seriesAdaptMs;
    warnings.push(...converted.warnings);

    if (!converted.series.length) {
      return baseResult({
        correlationId,
        snapshotId: snap.snapshotId,
        snapshotHash: snap.snapshotHash,
        hashVersion: snap.hashVersion,
        providerSymbol: symbol,
        timeframePack: pack,
        candleTipStates: converted.tipStates,
        orchestrationStatus: "FAILED",
        completeness: {
          ...emptyCompleteness(["NO_USABLE_SERIES"]),
          missingTimeframes: converted.missingTimeframes,
          presentTimeframes: converted.presentTimeframes,
        },
        warnings,
        failureReason: "No usable synchronized series from Charts snapshot",
        timingsMs: { ...timings, totalMs: Date.now() - started },
        capturedAt: snap.capturedAt,
      });
    }

    if (Date.now() >= deadlineAtMs) {
      return baseResult({
        correlationId,
        snapshotId: snap.snapshotId,
        snapshotHash: snap.snapshotHash,
        hashVersion: snap.hashVersion,
        providerSymbol: symbol,
        timeframePack: pack,
        candleTipStates: converted.tipStates,
        orchestrationStatus: "PARTIAL",
        completeness: {
          expectedTimeframes: [...pack],
          presentTimeframes: converted.presentTimeframes,
          missingTimeframes: converted.missingTimeframes,
          enginesCompleted: [],
          enginesSkipped: ["pipeline", "ranking", "evidence_assembly", "scenario_intelligence"],
          rankingIncluded: false,
          probabilityIncluded: false,
          scenarioIncluded: false,
          evidenceItemCount: 0,
          evidenceTrustedComplete: false,
          notes: ["TIMEOUT_BEFORE_PIPELINE"],
        },
        warnings: [...warnings, "TIMEOUT:before_pipeline"],
        failureReason: "Orchestration deadline exceeded before MIF pipeline",
        timingsMs: { ...timings, totalMs: Date.now() - started },
        capturedAt: snap.capturedAt,
      });
    }

    const t1 = Date.now();
    let pipeline;
    try {
      pipeline = runMifHfmOpportunityPipelineFromSeries(
        {
          requestId: correlationId,
          providerId: MIF_PROVIDER_ID,
          providerSymbol: symbol,
          timeframes: pack,
          primaryTimeframe: MIF_ORCHESTRATION_PRIMARY_TIMEFRAME,
          series: converted.series,
          assessmentTimestamp: snap.capturedAt,
        },
        {
          persist: false,
          skipProbability: true,
          deadlineAtMs,
        },
      );
    } catch (err) {
      warnings.push(`pipeline_threw:${err instanceof Error ? err.message : String(err)}`);
      return baseResult({
        correlationId,
        snapshotId: snap.snapshotId,
        snapshotHash: snap.snapshotHash,
        hashVersion: snap.hashVersion,
        providerSymbol: symbol,
        timeframePack: pack,
        candleTipStates: converted.tipStates,
        orchestrationStatus: "FAILED",
        completeness: {
          expectedTimeframes: [...pack],
          presentTimeframes: converted.presentTimeframes,
          missingTimeframes: converted.missingTimeframes,
          enginesCompleted: [],
          enginesSkipped: ["pipeline", "scenario_intelligence"],
          rankingIncluded: false,
          probabilityIncluded: false,
          scenarioIncluded: false,
          evidenceItemCount: 0,
          evidenceTrustedComplete: false,
          notes: ["PIPELINE_EXCEPTION"],
        },
        warnings,
        failureReason: err instanceof Error ? err.message : String(err),
        timingsMs: { ...timings, pipelineMs: Date.now() - t1, totalMs: Date.now() - started },
        capturedAt: snap.capturedAt,
      });
    }
    timings.pipelineMs = Date.now() - t1;
    warnings.push(...(pipeline.warnings ?? []));

    const rankingIncluded = pipeline.ranking != null;
    const enginesCompleted = [
      "integrity",
      "structure",
      "support_resistance",
      "liquidity",
      "momentum",
      "displacement",
      "buyer_seller_pressure",
      "regime",
      "fibonacci",
      "patterns",
      "harmonics",
      "candlestick_patterns",
      "deep_technical_intelligence",
      "unified",
      "mtf",
      "opportunity_detection",
      ...(rankingIncluded ? ["ranking"] : []),
    ];
    const enginesSkipped = [
      "probability",
      ...(rankingIncluded ? [] : ["ranking"]),
    ];
    if (pipeline.warnings.some((w) => String(w).startsWith("TIMEOUT:"))) {
      enginesSkipped.push("timeout_partial");
    }

    const t2 = Date.now();
    let evidencePackage = null as ReturnType<typeof assembleEvidenceFromProduction> | null;
    let evidencePackageId: string | null = null;
    let evidenceTrustedComplete = false;
    const rankingRun = (pipeline as { _rankingRun?: Parameters<
      typeof assembleEvidenceFromProduction
    >[0]["rankingRun"] })._rankingRun ?? null;

    try {
      const pkg = assembleEvidenceFromProduction({
        result: pipeline,
        rankingRun: rankingRun ?? undefined,
        probabilityBundles: null,
        eligibility: pipeline.eligibility ?? null,
        analysisId: snap.snapshotId,
        snapshotId: snap.snapshotId,
        snapshotIdSourceVerified: true,
      });
      const vr = validateMarketEvidencePackage(pkg);
      if (!vr.ok) {
        warnings.push(`evidence_invalid:${vr.errors.join(",")}`);
        evidencePackage = null;
        evidenceTrustedComplete = false;
      } else {
        evidencePackage = pkg;
        evidencePackageId = pkg.packageId;
        const timedOut = pipeline.warnings.some((w) => String(w).startsWith("TIMEOUT:"));
        const missingTf = converted.missingTimeframes.length > 0;
        evidenceTrustedComplete =
          !timedOut
          && !missingTf
          && converted.presentTimeframes.length === pack.length
          && pipeline.analysisStatus !== "FAILED_VALIDATION"
          && pipeline.analysisStatus !== "FAILED_PROVIDER"
          && pipeline.analysisStatus !== "FAILED_UPSTREAM_DATA"
          && pipeline.analysisStatus !== "FAILED_ASSESSMENT"
          && pipeline.analysisStatus !== "FAILED_ORCHESTRATOR";
        if (!evidenceTrustedComplete) {
          warnings.push("EVIDENCE_NOT_TRUSTED_COMPLETE");
        }
      }
    } catch (err) {
      warnings.push(`assemble_failed:${err instanceof Error ? err.message : String(err)}`);
    }
    timings.assembleMs = Date.now() - t2;

    // Phase 4 — deterministic scenario synthesis on already-available pipeline outputs.
    let scenarioPackage: MifScenarioPackage | null = null;
    let scenarioPackageId: string | null = null;
    if (Date.now() >= deadlineAtMs) {
      warnings.push("TIMEOUT:skipped_scenario_intelligence");
      enginesSkipped.push("scenario_intelligence");
    } else {
      try {
        const scenarioResult = buildScenarioIntelligence({
          pipeline,
          rankingRun: rankingRun ?? undefined,
          snapshotId: snap.snapshotId,
          snapshotHash: snap.snapshotHash,
          snapshotIdSourceVerified: true,
          tipStates: converted.tipStates,
          presentTimeframes: converted.presentTimeframes,
          missingTimeframes: converted.missingTimeframes,
          expectedTimeframes: pack,
          deadlineAtMs,
        });
        scenarioPackage = scenarioResult.package;
        scenarioPackageId = scenarioResult.package.packageId;
        enginesCompleted.push("scenario_intelligence");
        warnings.push(...scenarioResult.package.warnings);
        warnings.push(`scenario_outcome=${scenarioResult.package.outcome}`);
      } catch (err) {
        warnings.push(
          `scenario_intelligence_failed:${err instanceof Error ? err.message : String(err)}`,
        );
        enginesSkipped.push("scenario_intelligence");
      }
    }

    const timedOut = pipeline.warnings.some((w) => String(w).startsWith("TIMEOUT:"))
      || Date.now() >= deadlineAtMs;
    let orchestrationStatus: MifOrchestrationStatus = "COMPLETE";
    if (!evidencePackage || !evidenceTrustedComplete) {
      orchestrationStatus = timedOut || converted.missingTimeframes.length ? "PARTIAL" : "PARTIAL";
    }
    if (
      pipeline.analysisStatus === "FAILED_VALIDATION"
      || pipeline.analysisStatus === "FAILED_PROVIDER"
      || pipeline.analysisStatus === "FAILED_ORCHESTRATOR"
    ) {
      orchestrationStatus = evidencePackage ? "PARTIAL" : "FAILED";
    }
    if (evidenceTrustedComplete && evidencePackage) {
      orchestrationStatus = "COMPLETE";
    }

    // Validated packages may be returned as PARTIAL with evidenceTrustedComplete=false.
    // Never mark incomplete/timeout packages as trusted/complete.
    if (evidencePackage && !evidenceTrustedComplete) {
      warnings.push("EVIDENCE_PACKAGE_PARTIAL_NOT_TRUSTED");
    }

    timings.totalMs = Date.now() - started;
    return baseResult({
      correlationId,
      snapshotId: snap.snapshotId,
      snapshotHash: snap.snapshotHash,
      hashVersion: snap.hashVersion,
      providerSymbol: symbol,
      timeframePack: pack,
      candleTipStates: converted.tipStates,
      mifRequestId: pipeline.requestId,
      mifRunId: pipeline.persistence?.runId ?? pipeline.requestId,
      evidencePackageId: evidencePackage?.packageId ?? evidencePackageId,
      evidencePackage,
      scenarioPackage,
      scenarioPackageId,
      orchestrationStatus,
      completeness: {
        expectedTimeframes: [...pack],
        presentTimeframes: converted.presentTimeframes,
        missingTimeframes: converted.missingTimeframes,
        enginesCompleted,
        enginesSkipped,
        rankingIncluded,
        probabilityIncluded: false,
        scenarioIncluded: scenarioPackage != null,
        evidenceItemCount: evidencePackage?.items.length ?? 0,
        evidenceTrustedComplete,
        notes: timedOut ? ["TIMEOUT"] : [],
      },
      warnings: [...new Set(warnings)],
      failureReason:
        orchestrationStatus === "FAILED"
          ? (pipeline.errors?.[0] ?? "MIF pipeline failed")
          : null,
      timingsMs: timings,
      capturedAt: snap.capturedAt,
    });
  } finally {
    if (input.alreadyLocked !== true) {
      releaseOrchestrationLock(correlationId);
    }
    // Ensure lock never sticks even if correlation mismatches.
    if (isOrchestrationLocked() && input.alreadyLocked !== true) {
      releaseOrchestrationLock();
    }
  }
}
