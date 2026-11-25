/**
 * Auditable prompt provenance for Charts AI reasoning.
 * Stores digest + numeric measurement subset — not secrets or image payloads.
 */
import { createHash } from "node:crypto";
import { HFM_REASONING_PROMPT_VERSION } from "./constants.js";

export interface HfmPromptNumericMeasurement {
  evidenceId: string;
  measurementId: string;
  value: number | string | boolean | null;
  unit: string | null;
  timeframe: string | null;
  symbol: string | null;
  candleState: string | null;
  sourceEngine: string | null;
}

export interface HfmPromptLevelRef {
  evidenceId: string;
  kind: string | null;
  price: number | null;
  side: string | null;
}

export interface HfmPromptProvenance {
  schemaVersion: "1.0.0";
  promptVersion: string;
  /** sha256 hex of systemPrompt + "\\n---\\n" + userPrompt (exact rendered text). */
  promptDigest: string;
  systemPromptChars: number;
  userPromptChars: number;
  model: string | null;
  analysisId: string;
  snapshotId: string;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  unifiedInputIdentity: string | null;
  invokedAt: string;
  /** Exact numeric / provenance measurements supplied in the unified AI input. */
  numericMeasurements: readonly HfmPromptNumericMeasurement[];
  levelRefs: readonly HfmPromptLevelRef[];
  conflictEvidenceIds: readonly string[];
  limitationNotes: readonly string[];
  placesOrders: false;
  mutatesBroker: false;
  containsSecrets: false;
}

const NUMERIC_IDS = new Set([
  "rsi",
  "roc",
  "atr",
  "rsiPeriod",
  "rocPeriod",
  "atrPeriod",
  "rsiMethod",
  "rocMethod",
  "atrMethod",
  "tipOpenTimeSec",
  "tipCloseTimeSec",
  "candleState",
  "structurePrice",
  "supportMid",
  "resistanceMid",
  "primaryMid",
  "liquidityPrice",
  "conflictKind",
  "overallRegimeLabel",
  "mtfAlignment",
]);

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function digestPrompt(systemPrompt: string, userPrompt: string): string {
  return createHash("sha256")
    .update(systemPrompt, "utf8")
    .update("\n---\n", "utf8")
    .update(userPrompt, "utf8")
    .digest("hex");
}

/**
 * Extract the numeric / level / conflict subset that was included in unified.json
 * (already prioritised/truncated by buildHfmUnifiedAiAnalysisInput).
 */
export function extractPromptMeasurementSubset(
  unifiedJson: Record<string, unknown>,
): {
  numericMeasurements: HfmPromptNumericMeasurement[];
  levelRefs: HfmPromptLevelRef[];
  conflictEvidenceIds: string[];
  limitationNotes: string[];
} {
  const numericMeasurements: HfmPromptNumericMeasurement[] = [];
  const levelRefs: HfmPromptLevelRef[] = [];
  const conflictEvidenceIds: string[] = [];
  const limitationNotes: string[] = [];

  const det = asRec(unifiedJson.deterministicEvidence);
  const items = Array.isArray(det?.items) ? det!.items : [];
  for (const raw of items) {
    const item = asRec(raw);
    if (!item) continue;
    const evidenceId = String(item.evidenceId ?? "");
    const timeframe = item.timeframe != null ? String(item.timeframe) : null;
    const sourceEngine = item.sourceEngine != null ? String(item.sourceEngine) : null;
    let symbol: string | null = null;
    let candleState: string | null = item.candleStatus != null ? String(item.candleStatus) : null;

    const measurements = Array.isArray(item.measurements) ? item.measurements : [];
    for (const mRaw of measurements) {
      const m = asRec(mRaw);
      if (!m) continue;
      const mid = String(m.id ?? m.name ?? "");
      if (!NUMERIC_IDS.has(mid) && !(typeof m.value === "number" && Number.isFinite(m.value))) {
        continue;
      }
      if (mid === "symbol" && m.value != null) symbol = String(m.value);
      if (mid === "candleState" && m.value != null) candleState = String(m.value);
      if (
        NUMERIC_IDS.has(mid)
        || mid === "rsi"
        || mid === "roc"
        || mid === "atr"
      ) {
        numericMeasurements.push({
          evidenceId,
          measurementId: mid,
          value: (m.value as number | string | boolean | null) ?? null,
          unit: m.unit != null ? String(m.unit) : null,
          timeframe,
          symbol,
          candleState,
          sourceEngine,
        });
      }
    }

    const levels = Array.isArray(item.levels) ? item.levels : [];
    for (const lvRaw of levels) {
      const lv = asRec(lvRaw);
      if (!lv) continue;
      const price = typeof lv.price === "number" && Number.isFinite(lv.price) ? lv.price : null;
      if (price == null) continue;
      levelRefs.push({
        evidenceId,
        kind: lv.kind != null ? String(lv.kind) : null,
        price,
        side: lv.side != null ? String(lv.side) : null,
      });
    }

    for (const id of (item.conflictingEvidenceIds as unknown[]) ?? []) {
      if (typeof id === "string" && id) conflictEvidenceIds.push(id);
    }
    for (const w of (item.warnings as unknown[]) ?? []) {
      if (typeof w === "string" && /conflict|limitation|FORMING|LEVELS_/i.test(w)) {
        limitationNotes.push(w.slice(0, 200));
      }
    }
    for (const w of (item.limitations as unknown[]) ?? []) {
      if (typeof w === "string" && w) limitationNotes.push(w.slice(0, 200));
    }
  }

  const scen = asRec(unifiedJson.scenarioPackage);
  for (const sideKey of ["bullishScenario", "bearishScenario"] as const) {
    const side = asRec(scen?.[sideKey]);
    if (!side) continue;
    const levels = asRec(side.levels);
    if (levels?.status != null) {
      limitationNotes.push(`${sideKey}.levels.status=${String(levels.status)}`);
    }
    for (const id of (side.conflictingEvidenceIds as unknown[]) ?? []) {
      if (typeof id === "string" && id) conflictEvidenceIds.push(id);
    }
  }

  const meta = asRec(unifiedJson.analysisMetadata);
  for (const w of (meta?.dataQualityWarnings as unknown[]) ?? []) {
    if (typeof w === "string" && w) limitationNotes.push(w.slice(0, 200));
  }

  return {
    numericMeasurements: numericMeasurements.slice(0, 80),
    levelRefs: levelRefs.slice(0, 40),
    conflictEvidenceIds: [...new Set(conflictEvidenceIds)].slice(0, 40),
    limitationNotes: [...new Set(limitationNotes)].slice(0, 40),
  };
}

export function buildHfmPromptProvenance(input: {
  systemPrompt: string;
  userPrompt: string;
  unifiedJson: Record<string, unknown>;
  model: string | null;
  analysisId: string;
  snapshotId: string;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  unifiedInputIdentity: string | null;
  invokedAt?: string;
}): HfmPromptProvenance {
  const subset = extractPromptMeasurementSubset(input.unifiedJson);
  return {
    schemaVersion: "1.0.0",
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    promptDigest: digestPrompt(input.systemPrompt, input.userPrompt),
    systemPromptChars: input.systemPrompt.length,
    userPromptChars: input.userPrompt.length,
    model: input.model,
    analysisId: input.analysisId,
    snapshotId: input.snapshotId,
    evidencePackageId: input.evidencePackageId,
    scenarioPackageId: input.scenarioPackageId,
    unifiedInputIdentity: input.unifiedInputIdentity,
    invokedAt: input.invokedAt ?? new Date().toISOString(),
    numericMeasurements: subset.numericMeasurements,
    levelRefs: subset.levelRefs,
    conflictEvidenceIds: subset.conflictEvidenceIds,
    limitationNotes: subset.limitationNotes,
    placesOrders: false,
    mutatesBroker: false,
    containsSecrets: false,
  };
}
