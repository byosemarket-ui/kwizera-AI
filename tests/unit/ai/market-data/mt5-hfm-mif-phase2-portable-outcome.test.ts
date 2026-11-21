/**
 * Phase 2 — Windows-safe outcome persistence + portable filename mapping.
 * Logical evaluationId (oe:<hash>:<kind>) preserved in JSON; filename sanitized.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MifOpportunityStorage,
  portablePersistenceFileStem,
  legacyOutcomeFileStem,
  isWindowsUnsafeFileStem,
  MIF_OUTCOME_EVALUATION_CONTRACT_ID,
  MIF_OUTCOME_EVALUATION_CONTRACT_VERSION,
  MIF_OUTCOME_EVALUATION_ENGINE_ID,
  MIF_OUTCOME_EVALUATION_ENGINE_VERSION,
  type MifOutcomeEvaluationRecord,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const LOGICAL_ID = "oe:e9211d1b4418:NO_OBSERVATION_WINDOW";

function sampleRecord(
  over?: Partial<MifOutcomeEvaluationRecord>,
): MifOutcomeEvaluationRecord {
  return {
    contractId: MIF_OUTCOME_EVALUATION_CONTRACT_ID,
    contractVersion: MIF_OUTCOME_EVALUATION_CONTRACT_VERSION,
    engineId: MIF_OUTCOME_EVALUATION_ENGINE_ID,
    engineVersion: MIF_OUTCOME_EVALUATION_ENGINE_VERSION,
    evaluationId: LOGICAL_ID,
    evaluationTimestamp: "2024-01-15T12:00:00.000Z",
    candidateId: "cand-1",
    opportunitySnapshotRef: "snap-1",
    activationOpenTimeSec: 1_700_000_000,
    entryActivationRule: "AFTER_ACTIVATION_CANDLE_CLOSE",
    levels: {
      entryPrice: 2100,
      invalidationPrice: 2090,
      targetPrice: 2110,
      invalidationSide: "BELOW",
      targetSide: "ABOVE",
    },
    resultKind: "NO_OBSERVATION_WINDOW",
    outcomeKind: "NONE",
    resolvedOpenTimeSec: null,
    resolvedClose: null,
    barsObserved: 0,
    barsExcludedBeforeActivation: 0,
    duplicateObservationsDropped: 0,
    gapDetected: false,
    ambiguityReason: null,
    exclusionReason: "no CLOSED candles strictly after activationOpenTimeSec",
    realizedRMultiple: null,
    realizedRMultipleDefinition: "R = (exit - entry) / |entry - invalidation| when levels exist",
    sourceMarketDataRefs: { candleOpenTimeSecs: [], candleCount: 0 },
    evaluationInputsHash: "abc123",
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalOutcomeOnly: true,
    ...over,
  };
}

describe("Phase 2 — portable persistence file stems", () => {
  it("maps colon-bearing logical IDs to Windows-safe stems", () => {
    const stem = portablePersistenceFileStem(LOGICAL_ID);
    expect(stem).toBe("oe_e9211d1b4418_NO_OBSERVATION_WINDOW");
    expect(isWindowsUnsafeFileStem(stem)).toBe(false);
    expect(stem.includes(":")).toBe(false);
  });

  it("is deterministic and collision-resistant for distinct logical IDs", () => {
    const a = portablePersistenceFileStem("oe:aaa:TARGET_REACHED");
    const b = portablePersistenceFileStem("oe:bbb:TARGET_REACHED");
    expect(a).not.toBe(b);
    expect(portablePersistenceFileStem("oe:aaa:TARGET_REACHED")).toBe(a);
  });

  it("legacy stem preserves colon for backward-compatible Linux reads", () => {
    expect(legacyOutcomeFileStem(LOGICAL_ID)).toBe(LOGICAL_ID);
    expect(isWindowsUnsafeFileStem(legacyOutcomeFileStem(LOGICAL_ID))).toBe(true);
  });

  it("handles empty and reserved characters", () => {
    expect(portablePersistenceFileStem("")).toBe("_empty");
    expect(portablePersistenceFileStem('a<>:"/\\|?*b')).toBe("a_________b");
  });
});

describe("Phase 2 — outcome storage portable + legacy read", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-p2-outcome-"));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("persists and reads evaluationId containing ':' via portable filename", async () => {
    const store = new MifOpportunityStorage(tmp);
    const record = sampleRecord();
    const wr = await store.persistOutcomeEvaluation(record);
    expect(wr.ok).toBe(true);
    expect(wr.created).toBe(true);
    expect(path.basename(wr.path).includes(":")).toBe(false);
    expect(path.basename(wr.path)).toBe(
      `${portablePersistenceFileStem(LOGICAL_ID)}.json`,
    );

    const read = await store.getOutcomeEvaluation(LOGICAL_ID);
    expect(read?.evaluationId).toBe(LOGICAL_ID);
    expect(read?.resultKind).toBe("NO_OBSERVATION_WINDOW");

    const again = await store.persistOutcomeEvaluation(record);
    expect(again.created).toBe(false);
  });

  it("reads legacy colon-named files without orphaning them when FS allows", async () => {
    const store = new MifOpportunityStorage(tmp);
    await store.ensureReady();
    const outcomesDir = path.join(tmp, "mt5-hfm", "mif", "opportunities", "outcomes");
    fs.mkdirSync(outcomesDir, { recursive: true });
    const legacyName = `${legacyOutcomeFileStem(LOGICAL_ID)}.json`;
    const legacyPath = path.join(outcomesDir, legacyName);
    let wroteLegacy = false;
    try {
      fs.writeFileSync(legacyPath, `${JSON.stringify(sampleRecord(), null, 2)}\n`, "utf8");
      wroteLegacy = true;
    } catch {
      wroteLegacy = false;
    }

    if (wroteLegacy) {
      const read = await store.getOutcomeEvaluation(LOGICAL_ID);
      expect(read?.evaluationId).toBe(LOGICAL_ID);
      const persist = await store.persistOutcomeEvaluation(sampleRecord());
      expect(persist.created).toBe(false);
      expect(persist.path).toBe(legacyPath);
    } else {
      expect(isWindowsUnsafeFileStem(legacyOutcomeFileStem(LOGICAL_ID))).toBe(true);
      const wr = await store.persistOutcomeEvaluation(sampleRecord());
      expect(wr.ok).toBe(true);
      expect(path.basename(wr.path).includes(":")).toBe(false);
    }
  });

  it("repeated writes remain idempotent on portable path", async () => {
    const store = new MifOpportunityStorage(tmp);
    const r1 = await store.persistOutcomeEvaluation(sampleRecord());
    const r2 = await store.persistOutcomeEvaluation(sampleRecord());
    const r3 = await store.persistOutcomeEvaluation(sampleRecord());
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    expect(r3.created).toBe(false);
    const listed = await store.listOutcomeEvaluations({ candidateId: "cand-1" });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.evaluationId).toBe(LOGICAL_ID);
  });
});
