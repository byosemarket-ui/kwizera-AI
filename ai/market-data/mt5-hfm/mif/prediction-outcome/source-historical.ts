/**
 * Phase 5F STEP 3 — HISTORICAL_ARCHIVE source adapter (HFM_MT5 COMPLETE only).
 */
import { adaptHfmHistoricalBar } from "../adapters/historical-adapter.js";
import type { MifCanonicalCandle } from "../canonical/candle.js";
import type { MifHistoricalResearchStorage } from "../historical-research/storage.js";
import { researchBarsToHfmHistorical } from "../historical-research/replay-bridge.js";
import type { MifResearchDatasetManifest } from "../historical-research/types.js";
import { MIF_PREDICTION_MAX_OBSERVATION_BARS } from "./contracts.js";
import {
  selectFutureBarsAfterActivation,
  validateOutcomeCandleSeries,
} from "./closed-candle.js";
import type { MifPredictionDataQuality, MifPredictionHistoricalProvenance } from "./types.js";

export interface HistoricalArchiveSourceResult {
  ok: true;
  provenance: MifPredictionHistoricalProvenance;
  manifest: MifResearchDatasetManifest;
  allClosed: MifCanonicalCandle[];
  futureClosed: MifCanonicalCandle[];
  activationCandle: MifCanonicalCandle | null;
  activationClose: number | null;
  dataQuality: MifPredictionDataQuality;
}

export interface HistoricalArchiveSourceError {
  ok: false;
  code: string;
  message: string;
}

/**
 * Load COMPLETE HFM_MT5 research archive bars for prediction outcome evaluation.
 * Rejects INCOMPLETE, wrong provider, hash mismatch. Never synthesizes gaps.
 */
export async function loadHistoricalArchiveForOutcome(input: {
  storage: MifHistoricalResearchStorage;
  datasetId: string;
  version?: number;
  expectedContentHash?: string | null;
  activationOpenTimeSec: number;
  instrument?: string;
  timeframe?: string;
  maxBars?: number;
}): Promise<HistoricalArchiveSourceResult | HistoricalArchiveSourceError> {
  const consistency = await input.storage.verifyDatasetConsistency(
    input.datasetId,
    input.version ?? (await resolveLatestVersion(input.storage, input.datasetId)),
  );
  const version =
    input.version
    ?? (await resolveLatestVersion(input.storage, input.datasetId));

  if (!consistency.ok) {
    return {
      ok: false,
      code: consistency.code,
      message: consistency.message,
    };
  }

  const manifest = await input.storage.getDatasetManifest(input.datasetId, version);
  if (!manifest) {
    return { ok: false, code: "MANIFEST_MISSING", message: "dataset manifest not found" };
  }

  if (manifest.provider !== "HFM_MT5") {
    return {
      ok: false,
      code: "UNSUPPORTED_PROVIDER",
      message: `provider ${manifest.provider} rejected; HFM_MT5 only`,
    };
  }
  if (manifest.status !== "COMPLETE") {
    return {
      ok: false,
      code: "INCOMPLETE_DATASET",
      message: "authoritative outcome evaluation requires COMPLETE research datasets",
    };
  }
  if (
    input.expectedContentHash
    && input.expectedContentHash !== manifest.contentHash
  ) {
    return {
      ok: false,
      code: "HASH_MISMATCH",
      message: "expected content hash does not match manifest",
    };
  }
  if (
    input.instrument
    && String(input.instrument).toUpperCase() !== String(manifest.instrument).toUpperCase()
  ) {
    return {
      ok: false,
      code: "INSTRUMENT_MISMATCH",
      message: `dataset instrument ${manifest.instrument} != ${input.instrument}`,
    };
  }
  if (
    input.timeframe
    && String(input.timeframe).toUpperCase() !== String(manifest.timeframe).toUpperCase()
  ) {
    return {
      ok: false,
      code: "TIMEFRAME_MISMATCH",
      message: `dataset timeframe ${manifest.timeframe} != ${input.timeframe}`,
    };
  }

  if (
    !Number.isFinite(input.activationOpenTimeSec)
    || input.activationOpenTimeSec <= 0
  ) {
    return {
      ok: false,
      code: "MISSING_ACTIVATION_CUTOFF",
      message: "activationOpenTimeSec required; now() substitution forbidden",
    };
  }

  const page = await input.storage.getDatasetBars(manifest.datasetId, manifest.version);
  if (!page) {
    return { ok: false, code: "BARS_MISSING", message: "bars not found" };
  }

  const maxBars = Math.min(
    input.maxBars ?? MIF_PREDICTION_MAX_OBSERVATION_BARS,
    MIF_PREDICTION_MAX_OBSERVATION_BARS,
  );
  if (page.bars.length > maxBars) {
    return {
      ok: false,
      code: "BAR_LIMIT_EXCEEDED",
      message: `dataset has ${page.bars.length} bars; max ${maxBars}`,
    };
  }

  const hfmBars = researchBarsToHfmHistorical(page.bars);
  const candles: MifCanonicalCandle[] = [];
  for (const bar of hfmBars) {
    const adapted = adaptHfmHistoricalBar({
      bar,
      symbol: manifest.instrument,
      timeframe: manifest.timeframe,
    });
    if (!adapted.ok) continue;
    candles.push(adapted.value);
  }

  const validated = validateOutcomeCandleSeries({
    candles,
    timeframe: manifest.timeframe,
    brokerNowSec: null,
  });

  const { future, activationCandle, excludedAtOrBeforeActivation } =
    selectFutureBarsAfterActivation(validated.accepted, input.activationOpenTimeSec);

  const provenance: MifPredictionHistoricalProvenance = {
    mode: "HISTORICAL_ARCHIVE",
    providerId: "HFM_MT5",
    datasetId: manifest.datasetId,
    datasetVersion: manifest.version,
    contentHash: manifest.contentHash,
  };

  const dataQuality: MifPredictionDataQuality = {
    closedOnly: true,
    activationExcluded: true,
    gapDetected:
      validated.gapFlags.length > 0
      || (manifest.qualitySummary?.missingIntervals?.length ?? 0) > 0,
    gapFlags: [
      ...validated.gapFlags,
      ...(manifest.qualitySummary?.missingIntervals?.map(
        (m) => `ARCHIVE:${m.classification}:${m.fromOpenTimeSec}->${m.toOpenTimeSec}`,
      ) ?? []),
    ],
    duplicateBarsRejected: validated.duplicateBarsRejected,
    outOfOrderRejected: validated.outOfOrderRejected,
    formingRejected: validated.formingRejected,
    staleRejected: validated.staleRejected,
    closureUnverifiedRejected: validated.closureUnverifiedRejected,
    missingIntervals: validated.missingIntervals,
    tipClipped: false,
    futureBarsExcluded: 0,
  };

  void excludedAtOrBeforeActivation;

  return {
    ok: true,
    provenance,
    manifest,
    allClosed: validated.accepted,
    futureClosed: future,
    activationCandle,
    activationClose: activationCandle?.close ?? null,
    dataQuality,
  };
}

async function resolveLatestVersion(
  storage: MifHistoricalResearchStorage,
  datasetId: string,
): Promise<number> {
  const registry = await storage.listRegistry();
  const matches = registry
    .filter((e) => e.datasetId === datasetId)
    .sort((a, b) => b.version - a.version);
  return matches[0]?.version ?? 1;
}
