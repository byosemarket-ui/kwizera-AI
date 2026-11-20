/**
 * Phase 5F STEP 3 — evaluate prediction against validated LIVE_COPYRATES series.
 * Live-market proof is deferred when market is closed; contract tests use fixtures.
 */
import { evaluatePredictionOutcome } from "./engine.js";
import type { MifPredictionOutcomeStorage } from "./persistence.js";
import { isPredictionSnapshotValid } from "./snapshot.js";
import {
  loadLiveCopyRatesForOutcome,
  type LiveCopyRatesBarInput,
} from "./source-live.js";
import type { MifPredictionOutcomeRecord, MifPredictionSnapshot } from "./types.js";

export async function evaluatePredictionAgainstLiveCopyRates(input: {
  snapshot: MifPredictionSnapshot;
  bars: readonly LiveCopyRatesBarInput[];
  brokerNowSec: number;
  outcomeStorage?: MifPredictionOutcomeStorage;
  sourceProvenance?: string;
  snapshotId?: string | null;
  sequenceId?: string | null;
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

  const source = loadLiveCopyRatesForOutcome({
    instrument: input.snapshot.instrument,
    timeframe: input.snapshot.timeframe,
    bars: input.bars,
    activationOpenTimeSec: input.snapshot.activationOpenTimeSec,
    brokerNowSec: input.brokerNowSec,
    sourceProvenance: input.sourceProvenance,
    snapshotId: input.snapshotId,
    sequenceId: input.sequenceId,
  });
  if (!source.ok) {
    return { ok: false, code: source.code, message: source.message };
  }

  const evaluated = evaluatePredictionOutcome({
    snapshot: input.snapshot,
    futureClosedCandles: source.futureClosed,
    activationClose: source.activationClose,
    marketSourceMode: "LIVE_COPYRATES",
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
