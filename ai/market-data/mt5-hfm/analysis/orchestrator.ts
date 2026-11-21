/**
 * HFM Analysis context orchestrator — multi-TF collect → quality → sync → render → persist.
 * Phase 3: fail-open MIF intelligence orchestration on the same snapshot (no OpenAI evidence yet).
 * Does not submit broker orders. OD worker remains disabled.
 */
import {
  HFM_ANALYSIS_DEFAULT_TF_PACK,
  HFM_ANALYSIS_PROVIDER,
} from "./constants.js";
import { renderHfmAnalysisCandlestickPng } from "./chart-renderer.js";
import { evaluateAnalysisDataQuality } from "./data-quality.js";
import { validateChartImageIdentity } from "./image-identity.js";
import {
  createImmutableAnalysisJob,
  finalizeJob,
  getActiveAnalysisJob,
  isAnalysisJobLocked,
  noteSelectedChartSymbol,
  releaseAnalysisJobLock,
  setActiveAnalysisJob,
  tryAcquireAnalysisJobLock,
} from "./job-context.js";
import { collectHfmAnalysisMultiTf } from "./multi-tf-collector.js";
import { runHfmAnalysisRetentionCleanup } from "./retention.js";
import { createSnapshotIdentity } from "./snapshot-hash.js";
import { getHfmAnalysisStorage } from "./storage.js";
import { synchronizeAnalysisTimeframes } from "./synchronization.js";
import type {
  HfmAnalysisChartImageMeta,
  HfmAnalysisContextResult,
  HfmAnalysisMultiTfSnapshot,
  HfmAnalysisPrepState,
} from "./types.js";
import { HFM_REASONING_REQUIRED_TFS } from "./reasoning/constants.js";
import { runChartsIntelligenceOrchestration } from "../mif/orchestration/charts-bridge.js";

export interface PrepareHfmAnalysisContextInput {
  symbol: string;
  chartTimeframe?: string;
  timeframes?: readonly string[];
  refresh?: boolean;
  skipRender?: boolean;
  skipPersist?: boolean;
  runRetention?: boolean;
}

function emptyTimings() {
  return {
    collectMs: 0,
    normalizeMs: 0,
    validateMs: 0,
    syncMs: 0,
    renderMs: 0,
    totalMs: 0,
  };
}

export async function prepareHfmAnalysisContext(
  input: PrepareHfmAnalysisContextInput,
): Promise<HfmAnalysisContextResult> {
  const totalStart = Date.now();
  const diagnostics: string[] = [];
  const timings = emptyTimings();

  if (!tryAcquireAnalysisJobLock()) {
    const active = getActiveAnalysisJob();
    return {
      ok: false,
      state: "FAILED",
      job: active ?? createImmutableAnalysisJob({
        symbol: input.symbol,
        chartTimeframe: input.chartTimeframe ?? "H1",
      }),
      snapshot: null,
      chartImages: {},
      timings: { ...timings, totalMs: Date.now() - totalStart },
      diagnostics: ["Overlapping analysis preparation rejected (single-flight lock)."],
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  }

  noteSelectedChartSymbol(input.symbol);
  let job = createImmutableAnalysisJob({
    symbol: input.symbol,
    chartTimeframe: input.chartTimeframe ?? "H1",
    analysisTimeframes: input.timeframes ?? HFM_ANALYSIS_DEFAULT_TF_PACK,
  });
  setActiveAnalysisJob(job);

  let state: HfmAnalysisPrepState = "COLLECTING_DATA";
  try {
    const t0 = Date.now();
    const collected = await collectHfmAnalysisMultiTf({
      symbol: job.symbolAtStart,
      timeframes: job.analysisTimeframes,
      refresh: input.refresh,
    });
    timings.collectMs = Date.now() - t0;
    timings.normalizeMs = timings.collectMs; // normalize happens inside collector
    diagnostics.push(...collected.collectErrors.map((e) => `collect: ${e}`));

    // Immutable symbol — ignore mid-run selection changes for this job.
    if (collected.symbol !== job.symbolAtStart) {
      diagnostics.push(`collector symbol ${collected.symbol} coerced to job ${job.symbolAtStart}`);
    }

    state = "VALIDATING";
    const t1 = Date.now();
    const dataQuality = evaluateAnalysisDataQuality({
      provider: HFM_ANALYSIS_PROVIDER,
      symbol: job.symbolAtStart,
      requiredTimeframes: job.analysisTimeframes,
      datasets: collected.datasets,
      quote: { ...collected.quote, symbol: job.symbolAtStart },
    });
    timings.validateMs = Date.now() - t1;

    state = "SYNCHRONIZING";
    const t2 = Date.now();
    const synchronization = synchronizeAnalysisTimeframes({
      symbol: job.symbolAtStart,
      datasets: collected.datasets,
      quote: { ...collected.quote, symbol: job.symbolAtStart },
      requiredTimeframes: job.analysisTimeframes,
    });
    timings.syncMs = Date.now() - t2;

    const identity = createSnapshotIdentity({
      symbol: job.symbolAtStart,
      chartTimeframeAtStart: job.chartTimeframeAtStart,
      datasets: collected.datasets,
      quote: { ...collected.quote, symbol: job.symbolAtStart },
      qualityStatus: dataQuality.status,
    });

    const snapshot: HfmAnalysisMultiTfSnapshot = {
      snapshotId: identity.snapshotId,
      snapshotHash: identity.snapshotHash,
      hashVersion: identity.hashVersion,
      provider: HFM_ANALYSIS_PROVIDER,
      symbol: job.symbolAtStart,
      capturedAt: identity.capturedAt,
      chartTimeframeAtStart: job.chartTimeframeAtStart,
      timeframes: collected.datasets,
      quote: { ...collected.quote, symbol: job.symbolAtStart },
      dataQuality,
      synchronization,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };

    const chartImages: Record<string, HfmAnalysisChartImageMeta> = {};
    const pngByTf: Record<string, Buffer> = {};

    if (!input.skipRender && dataQuality.status !== "INVALID" && dataQuality.status !== "INCOMPLETE") {
      state = "RENDERING_IMAGES";
      const t3 = Date.now();
      for (const tf of job.analysisTimeframes) {
        const ds = collected.datasets[tf];
        if (!ds || !ds.historical.length) {
          diagnostics.push(`render skip ${tf}: no candles`);
          continue;
        }
        const candles = ds.current
          ? [...ds.historical.filter((c) => c.timestamp !== ds.current!.timestamp), ds.current]
          : ds.historical;
        const rendered = renderHfmAnalysisCandlestickPng({
          symbol: job.symbolAtStart,
          timeframe: tf,
          candles,
          snapshotId: snapshot.snapshotId,
          snapshotHash: snapshot.snapshotHash,
          capturedAt: snapshot.capturedAt,
        });
        if (!rendered.ok || !rendered.png || !rendered.meta) {
          diagnostics.push(`render ${tf}: ${rendered.error ?? "failed"}`);
          continue;
        }
        state = "VALIDATING_IMAGES";
        const v = validateChartImageIdentity({
          meta: rendered.meta,
          png: rendered.png,
          snapshot,
          timeframe: tf,
        });
        if (!v.ok) {
          diagnostics.push(`image identity ${tf}: ${v.errors.join("; ")}`);
          rendered.meta.validationStatus = "rejected";
          rendered.meta.validationErrors = v.errors;
          continue;
        }
        chartImages[tf] = rendered.meta;
        pngByTf[tf] = rendered.png;
      }
      timings.renderMs = Date.now() - t3;
    } else if (input.skipRender) {
      diagnostics.push("render skipped by request");
    } else {
      diagnostics.push("render skipped: data quality INVALID/INCOMPLETE");
    }

    // OpenAI still requires H1/M30/M15/M5 images; H4 is supplemental intelligence only.
    const requiredImagesOk = HFM_REASONING_REQUIRED_TFS.every((tf) => Boolean(chartImages[tf]));
    const aiReady = dataQuality.approvedForAiReasoning && requiredImagesOk;
    const failedHard = dataQuality.status === "INVALID" || dataQuality.status === "INCOMPLETE";
    state = failedHard ? "FAILED" : aiReady ? "COMPLETED" : "DEGRADED";
    job = finalizeJob(job, failedHard ? "FAILED" : aiReady ? "COMPLETED" : "DEGRADED");
    setActiveAnalysisJob(job);

    // Phase 3 — fail-open intelligence orchestration on the same snapshot series.
    let intelligenceOrchestration: unknown | null = null;
    if (!failedHard && snapshot) {
      try {
        const orch = runChartsIntelligenceOrchestration({
          snapshot,
          correlationId: snapshot.snapshotId,
        });
        intelligenceOrchestration = orch;
        diagnostics.push(
          `intelligence:${orch.orchestrationStatus}:trusted=${orch.completeness.evidenceTrustedComplete}:warnings=${orch.warnings.length}`,
        );
      } catch (err) {
        diagnostics.push(
          `intelligence:FAILED:${err instanceof Error ? err.message : String(err)}`,
        );
        intelligenceOrchestration = null;
      }
    }

    const result: HfmAnalysisContextResult = {
      ok: !failedHard,
      state,
      job,
      snapshot,
      chartImages,
      intelligenceOrchestration,
      timings: { ...timings, totalMs: Date.now() - totalStart },
      diagnostics,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };

    if (!input.skipPersist) {
      const storage = getHfmAnalysisStorage();
      await storage.saveContext(result);
      for (const [tf, meta] of Object.entries(chartImages)) {
        const png = pngByTf[tf];
        if (png) await storage.saveImage(meta, png);
      }
      if (
        intelligenceOrchestration
        && typeof intelligenceOrchestration === "object"
        && intelligenceOrchestration != null
        && "evidencePackage" in intelligenceOrchestration
      ) {
        await storage.saveIntelligenceOrchestration(
          snapshot.snapshotId,
          intelligenceOrchestration,
        );
        const orch = intelligenceOrchestration as {
          scenarioPackage?: unknown;
        };
        if (orch.scenarioPackage) {
          await storage.saveScenarioPackage(snapshot.snapshotId, orch.scenarioPackage);
        }
      }
    }

    if (input.runRetention) {
      const cleanup = await runHfmAnalysisRetentionCleanup({
        activeImageIds: new Set(Object.values(chartImages).map((m) => m.imageId)),
      });
      diagnostics.push(
        `retention: imagesDeleted=${cleanup.imagesDeleted} contextsDeleted=${cleanup.contextsDeleted}`,
      );
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job = finalizeJob(job, "FAILED");
    setActiveAnalysisJob(job);
    return {
      ok: false,
      state: "FAILED",
      job,
      snapshot: null,
      chartImages: {},
      timings: { ...timings, totalMs: Date.now() - totalStart },
      diagnostics: [...diagnostics, message],
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  } finally {
    releaseAnalysisJobLock(getActiveAnalysisJob());
  }
}

export function getHfmAnalysisPrepStatus(): {
  locked: boolean;
  activeJob: ReturnType<typeof getActiveAnalysisJob>;
} {
  return {
    locked: isAnalysisJobLocked(),
    activeJob: getActiveAnalysisJob(),
  };
}
