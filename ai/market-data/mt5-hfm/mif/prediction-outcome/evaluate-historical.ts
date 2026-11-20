/**
 * Phase 5F STEP 3 — evaluate prediction against COMPLETE HFM_MT5 historical archive.
 */
import type { MifHistoricalResearchStorage } from "../historical-research/storage.js";
import { evaluatePredictionOutcome } from "./engine.js";
import type { MifPredictionOutcomeStorage } from "./persistence.js";
import { isPredictionSnapshotValid } from "./snapshot.js";
import { loadHistoricalArchiveForOutcome } from "./source-historical.js";
import type { MifPredictionOutcomeRecord, MifPredictionSnapshot } from "./types.js";

export async function evaluatePredictionAgainstHistoricalArchive(input: {
  snapshot: MifPredictionSnapshot;
  researchStorage: MifHistoricalResearchStorage;
  outcomeStorage?: MifPredictionOutcomeStorage;
  datasetId: string;
  version?: number;
  expectedContentHash?: string | null;
  horizons?: readonly number[];
  persist?: boolean;
}): Promise<
  | { ok: true; outcome: MifPredictionOutcomeRecord; persisted: boolean }
  | { ok: false; code: string; message: string }
> {
  if (!isPredictionSnapshotValid(input.snapshot)) {
    return {
      ok: false,
      code: "INVALID_SNAPSHOT",
      message: input.snapshot.invalidReason ?? "snapshot not FROZEN",
    };
  }

  const source = await loadHistoricalArchiveForOutcome({
    storage: input.researchStorage,
    datasetId: input.datasetId,
    version: input.version,
    expectedContentHash: input.expectedContentHash,
    activationOpenTimeSec: input.snapshot.activationOpenTimeSec,
    instrument: input.snapshot.instrument,
    timeframe: input.snapshot.timeframe,
  });
  if (!source.ok) {
    return { ok: false, code: source.code, message: source.message };
  }

  const evaluated = evaluatePredictionOutcome({
    snapshot: input.snapshot,
    futureClosedCandles: source.futureClosed,
    activationClose: source.activationClose,
    marketSourceMode: "HISTORICAL_ARCHIVE",
    marketProvenance: source.provenance,
    dataQuality: source.dataQuality,
    horizons: input.horizons,
  });
  if (!evaluated.ok) {
    return evaluated;
  }

  let persisted = false;
  if (input.persist !== false && input.outcomeStorage) {
    const snapPersist = await input.outcomeStorage.persistSnapshot(input.snapshot);
    if (!snapPersist.ok) {
      return { ok: false, code: snapPersist.code, message: snapPersist.message };
    }
    const outPersist = await input.outcomeStorage.persistOutcome(evaluated.outcome);
    if (!outPersist.ok) {
      return { ok: false, code: outPersist.code, message: outPersist.message };
    }
    persisted = outPersist.created || snapPersist.created;
  }

  return { ok: true, outcome: evaluated.outcome, persisted };
}
