/**
 * Phase 5F STEP 1 — bounded, serial, read-only HFM_MT5 historical exporter.
 * No auto-worker. No parallel symbol/TF jobs. No fabrication.
 */
import { randomUUID } from "node:crypto";
import {
  fetchHfmHistoricalCandles,
  type HfmHistoricalResult,
} from "../../historical-engine.js";
import {
  isResearchExportExplicitlyEnabled,
  MIF_RESEARCH_DEFAULT_MAX_PAGES,
  MIF_RESEARCH_HARD_MAX_BARS,
  MIF_RESEARCH_MAX_BARS_PER_PAGE,
  MIF_RESEARCH_MAX_START_POS,
} from "./contracts.js";
import { sealResearchDataset } from "./dataset-builder.js";
import type { MifResearchCatalogInstrumentSnapshot } from "./pit-metadata.js";
import { ingestResearchBars } from "./quality.js";
import {
  getMifHistoricalResearchStorage,
  type MifHistoricalResearchStorage,
} from "./storage.js";
import { isOperationallyExportableTimeframe } from "./timeframe-layers.js";
import type {
  MifResearchDatasetManifest,
  MifResearchExportJob,
  MifResearchStoredBar,
} from "./types.js";

export type ResearchHistoryFetchFn = (opts: {
  symbol: string;
  timeframe: string;
  limit?: number;
  startPos?: number;
  refresh?: boolean;
}) => Promise<HfmHistoricalResult>;

export interface RunResearchExportInput {
  instrument: string;
  timeframe: string;
  requestedStartTimeSec?: number | null;
  requestedEndTimeSec?: number | null;
  maxPages?: number;
  maxBars?: number;
  /** Resume an existing job id. */
  resumeJobId?: string | null;
  /** Force allow in tests without env gate. */
  allowExport?: boolean;
  catalogRow?: MifResearchCatalogInstrumentSnapshot | null;
  fetchFn?: ResearchHistoryFetchFn;
  storage?: MifHistoricalResearchStorage;
  /** When true, run only one page then stop (resumable). */
  singlePage?: boolean;
}

export interface RunResearchExportResult {
  job: MifResearchExportJob;
  manifest: MifResearchDatasetManifest | null;
  bars: MifResearchStoredBar[];
}

function emptyJob(partial: Partial<MifResearchExportJob> & Pick<
  MifResearchExportJob,
  "jobId" | "instrument" | "timeframe" | "maxPages" | "maxBars"
>): MifResearchExportJob {
  const now = new Date().toISOString();
  return {
    contractId: "kwizera.mif.historical-research.v1",
    jobId: partial.jobId,
    status: partial.status ?? "PENDING",
    provider: "HFM_MT5",
    instrument: partial.instrument,
    timeframe: partial.timeframe,
    requestedStartTimeSec: partial.requestedStartTimeSec ?? null,
    requestedEndTimeSec: partial.requestedEndTimeSec ?? null,
    maxPages: partial.maxPages,
    maxBars: partial.maxBars,
    pagesFetched: partial.pagesFetched ?? 0,
    nextStartPos: partial.nextStartPos ?? 0,
    barsAccepted: partial.barsAccepted ?? 0,
    barsRejected: partial.barsRejected ?? 0,
    returnedRangeStart: partial.returnedRangeStart ?? null,
    returnedRangeEnd: partial.returnedRangeEnd ?? null,
    hasMore: partial.hasMore ?? false,
    incompleteReason: partial.incompleteReason ?? null,
    datasetId: partial.datasetId ?? null,
    datasetVersion: partial.datasetVersion ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    completedAt: partial.completedAt ?? null,
    errors: partial.errors ?? [],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    researchReadOnly: true,
    autoWorker: false,
  };
}

/**
 * Explicit, serial export. Refuses unless allowExport or env gate is set.
 * Does not start any background worker.
 */
export async function runResearchHistoricalExport(
  input: RunResearchExportInput,
): Promise<RunResearchExportResult> {
  const storage = input.storage ?? getMifHistoricalResearchStorage();
  const fetchFn = input.fetchFn ?? fetchHfmHistoricalCandles;
  const instrument = String(input.instrument || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();

  if (!input.allowExport && !isResearchExportExplicitlyEnabled()) {
    const job = emptyJob({
      jobId: `export-disabled-${randomUUID().slice(0, 8)}`,
      instrument: instrument || "UNKNOWN",
      timeframe: timeframe || "UNKNOWN",
      maxPages: 0,
      maxBars: 0,
      status: "FAILED",
      incompleteReason: "EXPORT_DISABLED",
      errors: [
        "research export is OFF by default; set KWIZERA_MIF_RESEARCH_EXPORT_ENABLED=1 and invoke explicitly",
      ],
      completedAt: new Date().toISOString(),
    });
    await storage.persistExportJob(job);
    return { job, manifest: null, bars: [] };
  }

  if (!instrument) {
    const job = emptyJob({
      jobId: `export-bad-${randomUUID().slice(0, 8)}`,
      instrument: "UNKNOWN",
      timeframe: timeframe || "UNKNOWN",
      maxPages: 0,
      maxBars: 0,
      status: "FAILED",
      incompleteReason: "INVALID_INSTRUMENT",
      errors: ["instrument required"],
      completedAt: new Date().toISOString(),
    });
    await storage.persistExportJob(job);
    return { job, manifest: null, bars: [] };
  }

  if (!isOperationallyExportableTimeframe(timeframe)) {
    const job = emptyJob({
      jobId: `export-tf-${randomUUID().slice(0, 8)}`,
      instrument,
      timeframe: timeframe || "UNKNOWN",
      maxPages: 0,
      maxBars: 0,
      status: "FAILED",
      incompleteReason: "TIMEFRAME_NOT_EXPORTABLE",
      errors: [
        `timeframe ${timeframe} is not operationally exportable (verified-live set only; do not expand silently)`,
      ],
      completedAt: new Date().toISOString(),
    });
    await storage.persistExportJob(job);
    return { job, manifest: null, bars: [] };
  }

  const maxPages = Math.min(
    200,
    Math.max(1, input.maxPages ?? MIF_RESEARCH_DEFAULT_MAX_PAGES),
  );
  const maxBars = Math.min(
    MIF_RESEARCH_HARD_MAX_BARS,
    Math.max(1, input.maxBars ?? MIF_RESEARCH_HARD_MAX_BARS),
  );

  let job: MifResearchExportJob;
  let bars: MifResearchStoredBar[] = [];
  let rejectedCandles = 0;
  let duplicateOrOutOfOrderRejected = 0;
  let invalidOhlcRejected = 0;

  if (input.resumeJobId) {
    const existing = await storage.getExportJob(input.resumeJobId);
    if (!existing) {
      const failed = emptyJob({
        jobId: input.resumeJobId,
        instrument,
        timeframe,
        maxPages,
        maxBars,
        status: "FAILED",
        incompleteReason: "RESUME_JOB_NOT_FOUND",
        errors: [`export job ${input.resumeJobId} not found`],
        completedAt: new Date().toISOString(),
      });
      await storage.persistExportJob(failed);
      return { job: failed, manifest: null, bars: [] };
    }
    job = { ...existing, status: "RUNNING", updatedAt: new Date().toISOString() };
    bars = await storage.loadJobBars(job.jobId);
  } else {
    job = emptyJob({
      jobId: `export:${instrument}:${timeframe}:${randomUUID().slice(0, 8)}`,
      instrument,
      timeframe,
      maxPages,
      maxBars,
      requestedStartTimeSec: input.requestedStartTimeSec ?? null,
      requestedEndTimeSec: input.requestedEndTimeSec ?? null,
      status: "RUNNING",
    });
  }

  await storage.persistExportJob(job);

  const errors: string[] = [...job.errors];
  const freshnessNotes: string[] = [];
  let hasMore = job.hasMore;
  let nextStartPos = job.nextStartPos;
  let pagesFetched = job.pagesFetched;
  let stopReason: string | null = null;

  const pageBudget = input.singlePage ? 1 : maxPages - pagesFetched;

  for (let page = 0; page < pageBudget; page++) {
    if (bars.length >= maxBars) {
      stopReason = "MAX_BARS_REACHED";
      break;
    }
    if (nextStartPos > MIF_RESEARCH_MAX_START_POS) {
      stopReason = "START_POS_LIMIT";
      break;
    }

    const remaining = maxBars - bars.length;
    const limit = Math.min(MIF_RESEARCH_MAX_BARS_PER_PAGE, remaining);
    const pageResult = await fetchFn({
      symbol: instrument,
      timeframe,
      limit,
      startPos: nextStartPos,
      refresh: true,
    });

    if (pageResult.provider !== "HFM_MT5") {
      errors.push("PROVIDER_ISOLATION_VIOLATION");
      stopReason = "PROVIDER_ISOLATION_VIOLATION";
      break;
    }

    pagesFetched += 1;
    hasMore = pageResult.hasMore;
    if (pageResult.freshness) freshnessNotes.push(pageResult.freshness);
    if (pageResult.errors?.length) errors.push(...pageResult.errors);

    if (!pageResult.available || pageResult.bars.length === 0) {
      stopReason = pageResult.available ? "EMPTY_PAGE" : "SOURCE_UNAVAILABLE";
      break;
    }

    // Filter by requested end (newest) / start (oldest) when provided.
    let pageBars = pageResult.bars;
    if (input.requestedEndTimeSec != null) {
      pageBars = pageBars.filter((b) => b.time <= input.requestedEndTimeSec!);
    }
    if (input.requestedStartTimeSec != null) {
      pageBars = pageBars.filter((b) => b.time >= input.requestedStartTimeSec!);
    }

    const ingested = ingestResearchBars(bars, pageBars);
    bars = ingested.accepted;
    rejectedCandles += ingested.rejectedCandles;
    duplicateOrOutOfOrderRejected += ingested.duplicateOrOutOfOrderRejected;
    invalidOhlcRejected += ingested.invalidOhlcRejected;

    // CopyRates startPos advances toward older history.
    nextStartPos = Math.min(
      MIF_RESEARCH_MAX_START_POS,
      nextStartPos + pageResult.bars.length,
    );

    if (
      input.requestedStartTimeSec != null &&
      pageResult.oldestTimestamp != null &&
      pageResult.oldestTimestamp <= input.requestedStartTimeSec
    ) {
      // Reached/passed requested oldest bound on this page.
      stopReason = "REQUESTED_START_REACHED";
      hasMore = false;
      break;
    }

    if (!pageResult.hasMore) {
      stopReason = "SOURCE_EXHAUSTED";
      break;
    }

    if (input.singlePage) {
      stopReason = "SINGLE_PAGE_PAUSE";
      break;
    }
  }

  const returnedRangeStart = bars[0]?.time ?? null;
  const returnedRangeEnd = bars[bars.length - 1]?.time ?? null;

  const reachedRequestedStart =
    input.requestedStartTimeSec == null ||
    (returnedRangeStart != null && returnedRangeStart <= input.requestedStartTimeSec);
  const incompleteExportRange =
    Boolean(stopReason === "MAX_BARS_REACHED" ||
      stopReason === "START_POS_LIMIT" ||
      stopReason === "SINGLE_PAGE_PAUSE" ||
      stopReason === "SOURCE_UNAVAILABLE" ||
      (input.requestedStartTimeSec != null && !reachedRequestedStart) ||
      (hasMore && stopReason !== "REQUESTED_START_REACHED" && stopReason !== "SOURCE_EXHAUSTED"));

  await storage.persistJobBars(job.jobId, bars);

  const now = new Date().toISOString();
  job = {
    ...job,
    status: incompleteExportRange
      ? stopReason === "SOURCE_UNAVAILABLE" && bars.length === 0
        ? "FAILED"
        : "INCOMPLETE"
      : "COMPLETED",
    pagesFetched,
    nextStartPos,
    barsAccepted: bars.length,
    barsRejected: rejectedCandles,
    returnedRangeStart,
    returnedRangeEnd,
    hasMore,
    incompleteReason: incompleteExportRange ? stopReason : null,
    updatedAt: now,
    completedAt: input.singlePage && incompleteExportRange ? null : now,
    errors,
  };

  let manifest: MifResearchDatasetManifest | null = null;

  // Seal when bars exist and export is not mid-resume pause (avoid churn of partial immutable versions).
  // Empty FAILED exports are never datasets. SINGLE_PAGE_PAUSE remains resumable without sealing.
  if (bars.length > 0 && stopReason !== "SINGLE_PAGE_PAUSE") {
    const sealed = await sealResearchDataset(storage, {
      instrument,
      timeframe,
      bars,
      rejectedCandles,
      duplicateOrOutOfOrderRejected,
      invalidOhlcRejected,
      incompleteExportRange: job.status !== "COMPLETED",
      catalogRow: input.catalogRow,
      sourceSnapshotId: freshnessNotes[0] ?? null,
      inclusionRules: {
        providerMustBe: "HFM_MT5",
        timeframeMustBeOperationallyExportable: true,
        rejectInvalidOhlc: true,
        rejectDuplicateOrOutOfOrder: true,
        synthesizeCandles: false,
        interpolateGaps: false,
        repairSilently: false,
        allowOtherProviders: false,
        requestedStartTimeSec: input.requestedStartTimeSec ?? null,
        requestedEndTimeSec: input.requestedEndTimeSec ?? null,
        maxBars,
        maxPages,
      },
      exportProvenance: {
        exportJobId: job.jobId,
        pagesFetched,
        lastStartPos: Math.max(0, nextStartPos - 1),
        nextStartPos: hasMore || incompleteExportRange ? nextStartPos : null,
        requestedCountPerPage: MIF_RESEARCH_MAX_BARS_PER_PAGE,
        returnedBarTotal: bars.length,
        hasMoreAtStop: hasMore,
        incompleteReason: job.incompleteReason,
        sourceFreshnessNotes: freshnessNotes,
        fetchErrors: errors,
      },
      notes: stopReason ? [`export_stop:${stopReason}`] : [],
    });

    if (sealed.ok) {
      manifest = sealed.manifest;
      job = {
        ...job,
        datasetId: sealed.manifest.datasetId,
        datasetVersion: sealed.manifest.version,
      };
    } else {
      job = {
        ...job,
        errors: [...job.errors, sealed.message],
        status: job.status === "COMPLETED" ? "FAILED" : job.status,
      };
      manifest = sealed.manifest ?? null;
    }
  }

  await storage.persistExportJob(job);
  return { job, manifest, bars };
}
