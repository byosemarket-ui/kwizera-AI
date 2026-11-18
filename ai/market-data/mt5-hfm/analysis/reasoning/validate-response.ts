/**
 * Strict validation of HFM AI reasoning model output.
 */
import {
  HFM_REASONING_DISCLAIMER,
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_REQUIRED_TFS,
  HFM_REASONING_SCHEMA_VERSION,
} from "./constants.js";
import type {
  HfmReasoningDecisionAction,
  HfmReasoningValidatedResult,
} from "./types.js";

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  if (!v.every((x) => typeof x === "string")) return null;
  return v as string[];
}

function asNullableNumber(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Normalize model enum strings: trim, upper-case, spaces → underscores; MEDIUM → MODERATE. */
function enumToken(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!t) return null;
  if (t === "MEDIUM") return "MODERATE";
  if (t === "PARTIAL" || t === "PARTIALLY" || t === "PARTIAL_ALIGNMENT") return "PARTIALLY_ALIGNED";
  if (t === "WAIT" || t === "WAITING") return "WAITING_FOR_CONFIRMATION";
  if (t === "NO" || t === "NONE_TRADE" || t === "NOTRADE") return "NO_TRADE";
  return t;
}

function coerceStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => (x == null ? "" : String(x))).filter((s) => s.length > 0);
  }
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function coerceNullableNumberField(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const ACTIONS = new Set(["BUY", "SELL", "NO_TRADE", "WAITING_FOR_CONFIRMATION"]);
const CONF_LABELS = new Set(["LOW", "MODERATE", "HIGH"]);
const CONDITIONS = new Set(["TRENDING", "RANGING", "VOLATILE", "UNCLEAR"]);
const BIASES = new Set(["BULLISH", "BEARISH", "NEUTRAL", "MIXED"]);
const ALIGN = new Set(["ALIGNED", "PARTIALLY_ALIGNED", "CONFLICTING", "UNCLEAR"]);
const SCENARIO = new Set(["ACTIVE", "POSSIBLE", "INVALIDATED", "NOT_SUPPORTED"]);
const SETUP = new Set(["READY", "WAITING", "INVALIDATED", "NOT_APPLICABLE"]);
const DIR = new Set(["BUY", "SELL", "NONE"]);
const RISK = new Set(["LOW", "MODERATE", "HIGH", "UNACCEPTABLE"]);

function parseTfBlock(raw: unknown, tf: string): { ok: true; value: HfmReasoningValidatedResult["timeframeAnalysis"]["H1"] } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: `timeframeAnalysis.${tf} missing` };
  const observations = asStringArray(raw.observations);
  const supportingEvidence = asStringArray(raw.supportingEvidence);
  const risks = asStringArray(raw.risks);
  const bias = asString(raw.bias);
  const structure = asString(raw.structure);
  if (!bias || !structure || !observations || !supportingEvidence || !risks) {
    return { ok: false, error: `timeframeAnalysis.${tf} incomplete` };
  }
  return {
    ok: true,
    value: { bias, structure, observations, supportingEvidence, risks },
  };
}

function parseScenario(raw: unknown, name: string): { ok: true; value: HfmReasoningValidatedResult["scenarios"]["bullish"] } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: `scenarios.${name} missing` };
  const status = asString(raw.status);
  const conditions = asStringArray(raw.conditions);
  const confirmation = asStringArray(raw.confirmation);
  const invalidation = asStringArray(raw.invalidation);
  if (!status || !SCENARIO.has(status) || !conditions || !confirmation || !invalidation) {
    return { ok: false, error: `scenarios.${name} invalid` };
  }
  return {
    ok: true,
    value: {
      status: status as HfmReasoningValidatedResult["scenarios"]["bullish"]["status"],
      conditions,
      confirmation,
      invalidation,
    },
  };
}

/** Unwrap common model wrappers / markdown fences before schema validation. */
export function normalizeHfmReasoningRawPayload(
  raw: unknown,
  expected?: {
    symbol: string;
    contextId: string;
    snapshotId: string;
    snapshotHash: string;
    model: string;
  },
): unknown {
  let cur: unknown = raw;
  if (typeof cur === "string") {
    let text = cur.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
    try {
      cur = JSON.parse(text) as unknown;
    } catch {
      return raw;
    }
  }
  if (!isObj(cur)) return cur;
  for (const key of ["result", "analysis", "data", "output", "payload"]) {
    const nested = cur[key];
    if (isObj(nested) && (isObj(nested.decision) || typeof nested.schemaVersion === "string")) {
      cur = nested;
      break;
    }
  }
  if (!isObj(cur)) return cur;

  /** Parse a section that may be a JSON string; leave other types unchanged. */
  const maybeParseSection = (v: unknown): unknown => {
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) return v;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return v;
    }
  };

  const defaultScenario = (): Record<string, unknown> => ({
    status: "NOT_SUPPORTED",
    conditions: [],
    confirmation: [],
    invalidation: [],
  });

  // Coerce flattened decision fields into decision object.
  if (!isObj(cur.decision) && typeof cur.action === "string") {
    cur = {
      ...cur,
      decision: {
        action: cur.action,
        confidence: cur.confidence ?? cur.confidenceScore ?? 0,
        confidenceLabel: cur.confidenceLabel ?? "LOW",
        summary: cur.summary ?? cur.explanation ?? "",
      },
    };
  }
  if (isObj(cur.decision)) {
    const d = { ...cur.decision };
    const act = enumToken(d.action);
    if (act) d.action = act;
    if (typeof d.confidence === "string" && d.confidence.trim() !== "") {
      const n = Number(d.confidence);
      if (Number.isFinite(n)) d.confidence = n;
    }
    if (typeof d.confidence === "number" && Number.isFinite(d.confidence)) {
      d.confidence = Math.max(0, Math.min(100, d.confidence));
    }
    const lab = enumToken(d.confidenceLabel);
    if (lab && CONF_LABELS.has(lab)) {
      d.confidenceLabel = lab;
    } else if (typeof d.confidence === "number") {
      d.confidenceLabel = d.confidence >= 70 ? "HIGH" : d.confidence >= 40 ? "MODERATE" : "LOW";
    }
    if (d.summary != null && typeof d.summary !== "string") d.summary = String(d.summary);
    if (!d.summary) d.summary = "No summary provided.";
    cur = { ...cur, decision: d };
  }

  // marketOverview — accept alternate key names and synthesize when missing/non-object.
  {
    let moRaw = maybeParseSection(cur.marketOverview);
    if (!isObj(moRaw)) {
      moRaw = {
        marketCondition: cur.marketCondition ?? cur.condition,
        overallBias: cur.overallBias ?? cur.bias,
        higherTimeframeBias: cur.higherTimeframeBias ?? cur.htfBias,
        timeframeAlignment: cur.timeframeAlignment ?? cur.alignment,
      };
    }
    const m: Record<string, unknown> = { ...(moRaw as Record<string, unknown>) };
    if (m.marketCondition == null) m.marketCondition = m.condition ?? m.market_condition;
    if (m.overallBias == null) m.overallBias = m.bias ?? m.overall_bias;
    if (m.higherTimeframeBias == null) {
      m.higherTimeframeBias = m.htfBias ?? m.higher_timeframe_bias ?? m.htf;
    }
    if (m.timeframeAlignment == null) {
      m.timeframeAlignment = m.alignment ?? m.timeframe_alignment ?? m.tfAlignment;
    }
    const mc = enumToken(m.marketCondition);
    const ob = enumToken(m.overallBias);
    const ta = enumToken(m.timeframeAlignment);
    if (mc && CONDITIONS.has(mc)) m.marketCondition = mc;
    else m.marketCondition = "UNCLEAR";
    if (ob && BIASES.has(ob)) m.overallBias = ob;
    else m.overallBias = "NEUTRAL";
    if (ta && ALIGN.has(ta)) m.timeframeAlignment = ta;
    else m.timeframeAlignment = "UNCLEAR";
    if (m.higherTimeframeBias != null && typeof m.higherTimeframeBias !== "string") {
      m.higherTimeframeBias = String(m.higherTimeframeBias);
    }
    if (!m.higherTimeframeBias) m.higherTimeframeBias = String(m.overallBias ?? "NEUTRAL");
    cur = { ...cur, marketOverview: m };
  }

  // timeframeAnalysis
  {
    let tfaRaw = maybeParseSection(cur.timeframeAnalysis);
    if (!isObj(tfaRaw)) tfaRaw = {};
    const tfa: Record<string, unknown> = { ...(tfaRaw as Record<string, unknown>) };
    for (const tf of HFM_REASONING_REQUIRED_TFS) {
      let block = maybeParseSection(tfa[tf] ?? tfa[tf.toLowerCase()] ?? tfa[tf.toUpperCase()]);
      if (!isObj(block)) {
        tfa[tf] = {
          bias: "NEUTRAL",
          structure: "unavailable",
          observations: [],
          supportingEvidence: [],
          risks: ["Timeframe block missing from model response."],
        };
        continue;
      }
      const b = { ...block };
      const bias = enumToken(b.bias);
      if (bias) b.bias = bias;
      else if (!b.bias) b.bias = "NEUTRAL";
      if (b.structure != null && typeof b.structure !== "string") b.structure = String(b.structure);
      if (!b.structure) b.structure = "unspecified";
      b.observations = coerceStringArray(b.observations);
      b.supportingEvidence = coerceStringArray(b.supportingEvidence ?? b.evidence);
      b.risks = coerceStringArray(b.risks);
      tfa[tf] = b;
    }
    cur = { ...cur, timeframeAnalysis: tfa };
  }

  // scenarios — object, array, or alternate top-level bullish/bearish keys
  {
    let scRaw = maybeParseSection(cur.scenarios);
    let sc: Record<string, unknown> = {};
    if (isObj(scRaw)) {
      sc = { ...scRaw };
    } else if (Array.isArray(scRaw)) {
      for (const item of scRaw) {
        if (!isObj(item)) continue;
        const name = String(item.name ?? item.side ?? item.type ?? item.scenario ?? "")
          .trim()
          .toLowerCase();
        if (name.includes("bull")) sc.bullish = item;
        else if (name.includes("bear")) sc.bearish = item;
      }
    }
    if (!isObj(sc.bullish)) {
      sc.bullish = maybeParseSection(cur.bullishScenario ?? cur.bullish) ?? sc.Bullish ?? defaultScenario();
    }
    if (!isObj(sc.bearish)) {
      sc.bearish = maybeParseSection(cur.bearishScenario ?? cur.bearish) ?? sc.Bearish ?? defaultScenario();
    }
    for (const name of ["bullish", "bearish"] as const) {
      let block = maybeParseSection(sc[name]);
      if (!isObj(block)) {
        sc[name] = defaultScenario();
        continue;
      }
      const b = { ...block };
      const st = enumToken(b.status);
      if (st && SCENARIO.has(st)) b.status = st;
      else b.status = "NOT_SUPPORTED";
      b.conditions = coerceStringArray(b.conditions);
      b.confirmation = coerceStringArray(b.confirmation ?? b.confirmations);
      b.invalidation = coerceStringArray(b.invalidation ?? b.invalidations);
      sc[name] = b;
    }
    cur = { ...cur, scenarios: { bullish: sc.bullish, bearish: sc.bearish } };
  }

  // tradePlan
  {
    let tpRaw = maybeParseSection(cur.tradePlan ?? cur.plan ?? cur.trade_plan);
    if (!isObj(tpRaw)) tpRaw = {};
    const tp: Record<string, unknown> = { ...(tpRaw as Record<string, unknown>) };
    if (tp.direction == null) tp.direction = tp.dir ?? tp.side;
    if (tp.setupStatus == null) tp.setupStatus = tp.status ?? tp.setup ?? tp.setup_status;
    if (tp.entryZone == null) tp.entryZone = tp.entry ?? tp.entry_zone;
    if (tp.stopLoss == null) tp.stopLoss = tp.sl ?? tp.stop ?? tp.stop_loss;
    if (tp.takeProfitTargets == null) {
      tp.takeProfitTargets = tp.targets ?? tp.takeProfits ?? tp.take_profit_targets ?? tp.tp;
    }
    if (tp.invalidationPrice == null) tp.invalidationPrice = tp.invalidation ?? tp.invalidation_price;
    if (tp.riskRewardEstimate == null) tp.riskRewardEstimate = tp.rr ?? tp.riskReward ?? tp.risk_reward;
    if (tp.explanation == null) tp.explanation = tp.notes ?? tp.reason ?? tp.rationale;

    const dir = enumToken(tp.direction);
    if (dir === "BUY" || dir === "SELL" || dir === "NONE") tp.direction = dir;
    else tp.direction = "NONE";
    let setup = enumToken(tp.setupStatus);
    if (setup === "WAITING_FOR_CONFIRMATION") setup = "WAITING";
    if (setup && SETUP.has(setup)) tp.setupStatus = setup;
    else tp.setupStatus = "NOT_APPLICABLE";
    if (!isObj(tp.entryZone)) {
      if (typeof tp.entryZone === "number" || typeof tp.entry === "number") {
        const px = coerceNullableNumberField(tp.entryZone ?? tp.entry);
        tp.entryZone = { low: px, high: px };
      } else {
        tp.entryZone = { low: null, high: null };
      }
    } else {
      const ez = tp.entryZone as Record<string, unknown>;
      tp.entryZone = {
        low: coerceNullableNumberField(ez.low ?? ez.min ?? ez.from),
        high: coerceNullableNumberField(ez.high ?? ez.max ?? ez.to),
      };
    }
    tp.stopLoss = coerceNullableNumberField(tp.stopLoss);
    tp.invalidationPrice = coerceNullableNumberField(tp.invalidationPrice);
    tp.riskRewardEstimate = coerceNullableNumberField(tp.riskRewardEstimate);
    if (Array.isArray(tp.takeProfitTargets)) {
      tp.takeProfitTargets = tp.takeProfitTargets
        .map((x) => coerceNullableNumberField(x))
        .filter((x): x is number => x != null);
    } else if (typeof tp.takeProfitTargets === "number") {
      tp.takeProfitTargets = [tp.takeProfitTargets];
    } else {
      tp.takeProfitTargets = [];
    }
    if (tp.explanation != null && typeof tp.explanation !== "string") tp.explanation = String(tp.explanation);
    if (!tp.explanation) tp.explanation = "No trade-plan explanation provided.";
    if (isObj(cur.decision)) {
      const act = String((cur.decision as Record<string, unknown>).action ?? "");
      if (act === "NO_TRADE" || act === "WAITING_FOR_CONFIRMATION") {
        tp.direction = "NONE";
        if (!SETUP.has(String(tp.setupStatus)) || act === "WAITING_FOR_CONFIRMATION") {
          tp.setupStatus = act === "WAITING_FOR_CONFIRMATION" ? "WAITING" : "NOT_APPLICABLE";
        }
      }
    }
    cur = { ...cur, tradePlan: tp };
  }

  // evidence
  {
    let evRaw = maybeParseSection(cur.evidence);
    if (!isObj(evRaw)) evRaw = {};
    const ev: Record<string, unknown> = { ...(evRaw as Record<string, unknown>) };
    ev.observedFacts = coerceStringArray(ev.observedFacts ?? ev.facts ?? ev.observations);
    ev.interpretations = coerceStringArray(ev.interpretations ?? ev.analysis);
    ev.uncertainties = coerceStringArray(ev.uncertainties ?? ev.unknowns);
    ev.missingData = coerceStringArray(ev.missingData ?? ev.missing);
    ev.dataQualityWarnings = coerceStringArray(ev.dataQualityWarnings ?? ev.warnings);
    cur = { ...cur, evidence: ev };
  }

  // riskAssessment
  {
    let raRaw = maybeParseSection(cur.riskAssessment ?? cur.risk);
    if (!isObj(raRaw)) raRaw = {};
    const ra: Record<string, unknown> = { ...(raRaw as Record<string, unknown>) };
    if (ra.riskLevel == null) ra.riskLevel = ra.level ?? ra.risk;
    const rl = enumToken(ra.riskLevel);
    if (rl && RISK.has(rl)) ra.riskLevel = rl;
    else ra.riskLevel = "MODERATE";
    ra.reasons = coerceStringArray(ra.reasons);
    ra.reasonsToAvoidTrade = coerceStringArray(ra.reasonsToAvoidTrade ?? ra.avoid ?? ra.reasonsToAvoid);
    cur = { ...cur, riskAssessment: ra };
  }

  // nextConfirmation
  {
    let ncRaw = maybeParseSection(cur.nextConfirmation ?? cur.confirmation);
    if (!isObj(ncRaw)) ncRaw = {};
    const nc: Record<string, unknown> = { ...(ncRaw as Record<string, unknown>) };
    if (typeof nc.required !== "boolean") {
      const req = nc.required;
      nc.required = req === true || String(req).toLowerCase() === "true"
        || (isObj(cur.decision)
          && String((cur.decision as Record<string, unknown>).action) === "WAITING_FOR_CONFIRMATION");
    }
    nc.conditions = coerceStringArray(nc.conditions ?? nc.requirements);
    nc.timeframesToWatch = coerceStringArray(nc.timeframesToWatch ?? nc.timeframes ?? nc.watch);
    cur = { ...cur, nextConfirmation: nc };
  }

  if (expected) {
    cur = {
      ...cur,
      schemaVersion: cur.schemaVersion ?? HFM_REASONING_SCHEMA_VERSION,
      analysisStatus: "COMPLETED",
      provider: "HFM_MT5",
      symbol: expected.symbol,
      contextId: expected.contextId,
      snapshotId: expected.snapshotId,
      snapshotHash: expected.snapshotHash,
      promptVersion: HFM_REASONING_PROMPT_VERSION,
      model: typeof cur.model === "string" ? cur.model : expected.model,
      disclaimer: HFM_REASONING_DISCLAIMER,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  }
  return cur;
}

export function validateHfmReasoningModelResponse(input: {
  raw: unknown;
  expected: {
    symbol: string;
    contextId: string;
    snapshotId: string;
    snapshotHash: string;
    model: string;
  };
}): { ok: true; result: HfmReasoningValidatedResult } | { ok: false; code: string; error: string } {
  const raw = normalizeHfmReasoningRawPayload(input.raw, input.expected);
  if (!isObj(raw)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "Response is not an object" };
  }

  const schemaVersion = asString(raw.schemaVersion);
  if (schemaVersion !== HFM_REASONING_SCHEMA_VERSION) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "schemaVersion mismatch" };
  }

  const provider = asString(raw.provider);
  const symbol = asString(raw.symbol)?.toUpperCase() ?? null;
  const contextId = asString(raw.contextId);
  const snapshotId = asString(raw.snapshotId);
  const snapshotHash = asString(raw.snapshotHash);
  const promptVersion = asString(raw.promptVersion);
  const model = asString(raw.model) ?? input.expected.model;

  if (provider !== "HFM_MT5") {
    return { ok: false, code: "MODEL_RESPONSE_IDENTITY_MISMATCH", error: "provider mismatch" };
  }
  if (symbol !== input.expected.symbol.toUpperCase()) {
    return { ok: false, code: "MODEL_RESPONSE_IDENTITY_MISMATCH", error: "symbol mismatch" };
  }
  if (contextId !== input.expected.contextId || snapshotId !== input.expected.snapshotId) {
    return { ok: false, code: "MODEL_RESPONSE_IDENTITY_MISMATCH", error: "context/snapshot id mismatch" };
  }
  if (snapshotHash !== input.expected.snapshotHash) {
    return { ok: false, code: "MODEL_RESPONSE_IDENTITY_MISMATCH", error: "snapshotHash mismatch" };
  }
  if (promptVersion !== HFM_REASONING_PROMPT_VERSION) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "promptVersion mismatch" };
  }

  if (!isObj(raw.decision)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "decision missing" };
  }
  const action = asString(raw.decision.action);
  const confidence = asNumber(raw.decision.confidence);
  const confidenceLabel = asString(raw.decision.confidenceLabel);
  const summary = asString(raw.decision.summary);
  if (!action || !ACTIONS.has(action) || confidence == null || confidence < 0 || confidence > 100
    || !confidenceLabel || !CONF_LABELS.has(confidenceLabel) || !summary) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "decision fields invalid" };
  }

  if (!isObj(raw.marketOverview)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "marketOverview missing" };
  }
  const marketCondition = asString(raw.marketOverview.marketCondition);
  const overallBias = asString(raw.marketOverview.overallBias);
  const higherTimeframeBias = asString(raw.marketOverview.higherTimeframeBias);
  const timeframeAlignment = asString(raw.marketOverview.timeframeAlignment);
  if (!marketCondition || !CONDITIONS.has(marketCondition) || !overallBias || !BIASES.has(overallBias)
    || !higherTimeframeBias || !timeframeAlignment || !ALIGN.has(timeframeAlignment)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "marketOverview invalid" };
  }

  if (!isObj(raw.timeframeAnalysis)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "timeframeAnalysis missing" };
  }
  const tfBlocks: Record<string, HfmReasoningValidatedResult["timeframeAnalysis"]["H1"]> = {};
  for (const tf of HFM_REASONING_REQUIRED_TFS) {
    const parsed = parseTfBlock(raw.timeframeAnalysis[tf], tf);
    if (!parsed.ok) return { ok: false, code: "INVALID_MODEL_RESPONSE", error: parsed.error };
    tfBlocks[tf] = parsed.value;
  }

  if (!isObj(raw.scenarios)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "scenarios missing" };
  }
  const bullish = parseScenario(raw.scenarios.bullish, "bullish");
  const bearish = parseScenario(raw.scenarios.bearish, "bearish");
  if (!bullish.ok) return { ok: false, code: "INVALID_MODEL_RESPONSE", error: bullish.error };
  if (!bearish.ok) return { ok: false, code: "INVALID_MODEL_RESPONSE", error: bearish.error };

  if (!isObj(raw.tradePlan)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "tradePlan missing" };
  }
  const direction = asString(raw.tradePlan.direction);
  const setupStatus = asString(raw.tradePlan.setupStatus);
  const explanation = asString(raw.tradePlan.explanation);
  if (!direction || !DIR.has(direction) || !setupStatus || !SETUP.has(setupStatus) || !explanation) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "tradePlan core invalid" };
  }
  if (!isObj(raw.tradePlan.entryZone)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "entryZone missing" };
  }
  const entryLow = asNullableNumber(raw.tradePlan.entryZone.low);
  const entryHigh = asNullableNumber(raw.tradePlan.entryZone.high);
  if (entryLow === undefined || entryHigh === undefined) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "entryZone values invalid" };
  }
  if (entryLow != null && entryHigh != null && entryLow > entryHigh) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "entryZone low > high" };
  }
  const stopLoss = asNullableNumber(raw.tradePlan.stopLoss);
  const invalidationPrice = asNullableNumber(raw.tradePlan.invalidationPrice);
  const riskRewardEstimate = asNullableNumber(raw.tradePlan.riskRewardEstimate);
  if (stopLoss === undefined || invalidationPrice === undefined || riskRewardEstimate === undefined) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "tradePlan prices invalid" };
  }
  const tpsRaw = raw.tradePlan.takeProfitTargets;
  if (!Array.isArray(tpsRaw) || !tpsRaw.every((x) => typeof x === "number" && Number.isFinite(x))) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "takeProfitTargets invalid" };
  }
  const takeProfitTargets = tpsRaw as number[];

  const decisionAction = action as HfmReasoningDecisionAction;
  if (decisionAction === "BUY" || decisionAction === "SELL") {
    if (direction !== decisionAction) {
      return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "direction must match BUY/SELL decision" };
    }
    if (entryLow == null || entryHigh == null || stopLoss == null) {
      return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "BUY/SELL requires entry zone and stopLoss" };
    }
    if (decisionAction === "BUY" && !(stopLoss < entryLow)) {
      return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "BUY stopLoss must be below entry" };
    }
    if (decisionAction === "SELL" && !(stopLoss > entryHigh)) {
      return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "SELL stopLoss must be above entry" };
    }
    for (const tp of takeProfitTargets) {
      if (decisionAction === "BUY" && !(tp > entryHigh)) {
        return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "BUY takeProfit must be above entry" };
      }
      if (decisionAction === "SELL" && !(tp < entryLow)) {
        return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "SELL takeProfit must be below entry" };
      }
    }
  } else {
    if (direction !== "NONE") {
      return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "NO_TRADE/WAITING direction must be NONE" };
    }
  }

  if (!isObj(raw.evidence)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "evidence missing" };
  }
  const observedFacts = asStringArray(raw.evidence.observedFacts);
  const interpretations = asStringArray(raw.evidence.interpretations);
  const uncertainties = asStringArray(raw.evidence.uncertainties);
  const missingData = asStringArray(raw.evidence.missingData);
  const dataQualityWarnings = asStringArray(raw.evidence.dataQualityWarnings);
  if (!observedFacts || !interpretations || !uncertainties || !missingData || !dataQualityWarnings) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "evidence arrays invalid" };
  }

  if (!isObj(raw.riskAssessment)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "riskAssessment missing" };
  }
  const riskLevel = asString(raw.riskAssessment.riskLevel);
  const reasons = asStringArray(raw.riskAssessment.reasons);
  const reasonsToAvoidTrade = asStringArray(raw.riskAssessment.reasonsToAvoidTrade);
  if (!riskLevel || !RISK.has(riskLevel) || !reasons || !reasonsToAvoidTrade) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "riskAssessment invalid" };
  }

  if (!isObj(raw.nextConfirmation)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "nextConfirmation missing" };
  }
  if (typeof raw.nextConfirmation.required !== "boolean") {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "nextConfirmation.required invalid" };
  }
  const conditions = asStringArray(raw.nextConfirmation.conditions);
  const timeframesToWatch = asStringArray(raw.nextConfirmation.timeframesToWatch);
  if (!conditions || !timeframesToWatch) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "nextConfirmation arrays invalid" };
  }

  const disclaimer = asString(raw.disclaimer);
  if (disclaimer !== HFM_REASONING_DISCLAIMER) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "disclaimer mismatch" };
  }

  const result: HfmReasoningValidatedResult = {
    schemaVersion: HFM_REASONING_SCHEMA_VERSION,
    analysisStatus: "COMPLETED",
    provider: "HFM_MT5",
    symbol: input.expected.symbol.toUpperCase(),
    contextId: input.expected.contextId,
    snapshotId: input.expected.snapshotId,
    snapshotHash: input.expected.snapshotHash,
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    model,
    decision: {
      action: decisionAction,
      confidence,
      confidenceLabel: confidenceLabel as HfmReasoningValidatedResult["decision"]["confidenceLabel"],
      summary,
    },
    marketOverview: {
      marketCondition: marketCondition as HfmReasoningValidatedResult["marketOverview"]["marketCondition"],
      overallBias: overallBias as HfmReasoningValidatedResult["marketOverview"]["overallBias"],
      higherTimeframeBias,
      timeframeAlignment: timeframeAlignment as HfmReasoningValidatedResult["marketOverview"]["timeframeAlignment"],
    },
    timeframeAnalysis: {
      H1: tfBlocks.H1!,
      M30: tfBlocks.M30!,
      M15: tfBlocks.M15!,
      M5: tfBlocks.M5!,
    },
    scenarios: { bullish: bullish.value, bearish: bearish.value },
    tradePlan: {
      direction: direction as HfmReasoningValidatedResult["tradePlan"]["direction"],
      setupStatus: setupStatus as HfmReasoningValidatedResult["tradePlan"]["setupStatus"],
      entryZone: { low: entryLow, high: entryHigh },
      stopLoss,
      takeProfitTargets,
      invalidationPrice,
      riskRewardEstimate,
      explanation,
    },
    evidence: {
      observedFacts,
      interpretations,
      uncertainties,
      missingData,
      dataQualityWarnings,
    },
    riskAssessment: {
      riskLevel: riskLevel as HfmReasoningValidatedResult["riskAssessment"]["riskLevel"],
      reasons,
      reasonsToAvoidTrade,
    },
    nextConfirmation: {
      required: raw.nextConfirmation.required,
      conditions,
      timeframesToWatch,
    },
    disclaimer: HFM_REASONING_DISCLAIMER,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };

  return { ok: true, result };
}

/** Build a minimal valid fixture for unit tests. */
export function buildMockValidReasoningPayload(expected: {
  symbol: string;
  contextId: string;
  snapshotId: string;
  snapshotHash: string;
  model: string;
  action?: HfmReasoningDecisionAction;
}): Record<string, unknown> {
  const action = expected.action ?? "NO_TRADE";
  const tf = {
    bias: "NEUTRAL",
    structure: "range",
    observations: ["obs"],
    supportingEvidence: ["ev"],
    risks: ["risk"],
  };
  const scenario = {
    status: "NOT_SUPPORTED",
    conditions: [],
    confirmation: [],
    invalidation: [],
  };
  const isTrade = action === "BUY" || action === "SELL";
  return {
    schemaVersion: HFM_REASONING_SCHEMA_VERSION,
    analysisStatus: "COMPLETED",
    provider: "HFM_MT5",
    symbol: expected.symbol,
    contextId: expected.contextId,
    snapshotId: expected.snapshotId,
    snapshotHash: expected.snapshotHash,
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    model: expected.model,
    decision: {
      action,
      confidence: isTrade ? 62 : 40,
      confidenceLabel: isTrade ? "MODERATE" : "LOW",
      summary: "Mock summary",
    },
    marketOverview: {
      marketCondition: "UNCLEAR",
      overallBias: "NEUTRAL",
      higherTimeframeBias: "neutral",
      timeframeAlignment: "UNCLEAR",
    },
    timeframeAnalysis: { H1: tf, M30: tf, M15: tf, M5: tf },
    scenarios: { bullish: scenario, bearish: scenario },
    tradePlan: {
      direction: isTrade ? action : "NONE",
      setupStatus: isTrade ? "READY" : "NOT_APPLICABLE",
      entryZone: isTrade
        ? action === "BUY"
          ? { low: 100, high: 101 }
          : { low: 100, high: 101 }
        : { low: null, high: null },
      stopLoss: isTrade ? (action === "BUY" ? 99 : 102) : null,
      takeProfitTargets: isTrade ? (action === "BUY" ? [103] : [98]) : [],
      invalidationPrice: isTrade ? (action === "BUY" ? 98.5 : 102.5) : null,
      riskRewardEstimate: isTrade ? 2 : null,
      explanation: "mock plan",
    },
    evidence: {
      observedFacts: ["fact"],
      interpretations: ["interp"],
      uncertainties: ["unc"],
      missingData: [],
      dataQualityWarnings: [],
    },
    riskAssessment: {
      riskLevel: "MODERATE",
      reasons: ["r"],
      reasonsToAvoidTrade: isTrade ? [] : ["no setup"],
    },
    nextConfirmation: {
      required: !isTrade,
      conditions: isTrade ? [] : ["wait"],
      timeframesToWatch: ["M5"],
    },
    disclaimer: HFM_REASONING_DISCLAIMER,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}
