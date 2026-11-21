/**
 * Phase 5 — strict validation of HFM AI reasoning model output (schema v1.2).
 * Missing sections are marked NOT_PROVIDED (never synthetic NEUTRAL/MODERATE conclusions).
 * Evidence IDs and price levels are grounded against the unified input allow-list.
 */
import { normalizeHfmReasoningConfidence } from "./confidence.js";
import {
  HFM_REASONING_CONFIDENCE_DEFINITION,
  HFM_REASONING_DISCLAIMER,
  HFM_REASONING_NOT_PROVIDED,
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_REQUIRED_TFS,
  HFM_REASONING_SCHEMA_VERSION,
} from "./constants.js";
import {
  collectGroundingErrors,
  type HfmReasoningGroundingContext,
} from "./grounding.js";
import {
  buildUnavailablePricePrecision,
  validateTradePlanPricesAgainstInstrument,
  type HfmReasoningInstrumentMeta,
} from "./price-precision.js";
import type {
  HfmReasoningDecisionAction,
  HfmReasoningDecisionStatus,
  HfmReasoningDirectionalAssessment,
  HfmReasoningValidatedResult,
  HfmSectionProvision,
} from "./types.js";

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
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
const CONDITIONS = new Set(["TRENDING", "RANGING", "VOLATILE", "UNCLEAR", HFM_REASONING_NOT_PROVIDED]);
const BIASES = new Set(["BULLISH", "BEARISH", "NEUTRAL", "MIXED", HFM_REASONING_NOT_PROVIDED]);
const ALIGN = new Set(["ALIGNED", "PARTIALLY_ALIGNED", "CONFLICTING", "UNCLEAR", HFM_REASONING_NOT_PROVIDED]);
const SCENARIO = new Set(["ACTIVE", "POSSIBLE", "INVALIDATED", "NOT_SUPPORTED"]);
const SETUP = new Set(["READY", "WAITING", "INVALIDATED", "NOT_APPLICABLE"]);
const DIR = new Set(["BUY", "SELL", "NONE"]);
const RISK = new Set(["LOW", "MODERATE", "HIGH", "UNACCEPTABLE", HFM_REASONING_NOT_PROVIDED]);

function notProvidedTfBlock(): HfmReasoningValidatedResult["timeframeAnalysis"]["H1"] {
  return {
    sectionStatus: "NOT_PROVIDED",
    bias: HFM_REASONING_NOT_PROVIDED,
    structure: "Not provided by AI.",
    observations: [],
    supportingEvidence: [],
    risks: ["Not provided by AI."],
  };
}

function defaultScenario(): HfmReasoningValidatedResult["scenarios"]["bullish"] {
  return {
    status: "NOT_SUPPORTED",
    conditions: [],
    confirmation: [],
    invalidation: [],
  };
}

function maybeParseSection(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return v;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return v;
  }
}

function parseTfBlock(
  raw: unknown,
  tf: string,
  provision: HfmSectionProvision,
): { ok: true; value: HfmReasoningValidatedResult["timeframeAnalysis"]["H1"] } | { ok: false; error: string } {
  if (provision === "NOT_PROVIDED") {
    return { ok: true, value: notProvidedTfBlock() };
  }
  if (!isObj(raw)) return { ok: false, error: `timeframeAnalysis.${tf} missing` };
  const observations = asStringArray(raw.observations) ?? coerceStringArray(raw.observations);
  const supportingEvidence = asStringArray(raw.supportingEvidence) ?? coerceStringArray(raw.supportingEvidence);
  const risks = asStringArray(raw.risks) ?? coerceStringArray(raw.risks);
  const bias = asString(raw.bias);
  const structure = asString(raw.structure);
  if (!bias || !structure) {
    return { ok: false, error: `timeframeAnalysis.${tf} incomplete` };
  }
  return {
    ok: true,
    value: {
      sectionStatus: "PROVIDED",
      bias,
      structure,
      observations,
      supportingEvidence,
      risks,
    },
  };
}

function parseScenario(
  raw: unknown,
  name: string,
): { ok: true; value: HfmReasoningValidatedResult["scenarios"]["bullish"] } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: `scenarios.${name} missing` };
  const status = asString(raw.status);
  const conditions = asStringArray(raw.conditions) ?? coerceStringArray(raw.conditions);
  const confirmation = asStringArray(raw.confirmation) ?? coerceStringArray(raw.confirmation);
  const invalidation = asStringArray(raw.invalidation) ?? coerceStringArray(raw.invalidation);
  if (!status || !SCENARIO.has(status)) {
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

export interface HfmNormalizeMeta {
  marketOverviewProvided: boolean;
  timeframeProvided: Record<string, boolean>;
  riskProvided: boolean;
  scenariosProvided: boolean;
  confidenceRaw: unknown;
}

/** Unwrap wrappers / fences; coerce enums; mark missing sections without inventing analysis. */
export function normalizeHfmReasoningRawPayload(
  raw: unknown,
  expected?: {
    symbol: string;
    contextId: string;
    snapshotId: string;
    snapshotHash: string;
    model: string;
  },
): { payload: unknown; meta: HfmNormalizeMeta } {
  const meta: HfmNormalizeMeta = {
    marketOverviewProvided: false,
    timeframeProvided: { H1: false, M30: false, M15: false, M5: false },
    riskProvided: false,
    scenariosProvided: false,
    confidenceRaw: undefined,
  };

  let cur: unknown = raw;
  if (typeof cur === "string") {
    let text = cur.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
    try {
      cur = JSON.parse(text) as unknown;
    } catch {
      return { payload: raw, meta };
    }
  }
  if (!isObj(cur)) return { payload: cur, meta };
  for (const key of ["result", "analysis", "data", "output", "payload"]) {
    const nested = cur[key];
    if (isObj(nested) && (isObj(nested.decision) || typeof nested.schemaVersion === "string")) {
      cur = nested;
      break;
    }
  }
  if (!isObj(cur)) return { payload: cur, meta };

  if (!isObj(cur.decision) && typeof cur.action === "string") {
    cur = {
      ...cur,
      decision: {
        action: cur.action,
        confidence: cur.confidence ?? cur.confidenceScore,
        confidenceLabel: cur.confidenceLabel,
        summary: cur.summary ?? cur.explanation ?? "",
      },
    };
  }
  if (isObj(cur.decision)) {
    const d = { ...cur.decision };
    meta.confidenceRaw = d.confidence;
    const act = enumToken(d.action);
    if (act) d.action = act;
    const conf = normalizeHfmReasoningConfidence(d.confidence);
    if (conf.ok) d.confidence = conf.confidence;
    // leave invalid confidence for validator to reject (no clamp)
    const lab = enumToken(d.confidenceLabel);
    if (lab && CONF_LABELS.has(lab)) d.confidenceLabel = lab;
    else if (conf.ok) {
      d.confidenceLabel = conf.confidence >= 70 ? "HIGH" : conf.confidence >= 40 ? "MODERATE" : "LOW";
    }
    if (d.summary != null && typeof d.summary !== "string") d.summary = String(d.summary);
    if (!d.summary) d.summary = "No summary provided.";
    cur = { ...cur, decision: d };
  }

  // marketOverview — do not invent UNCLEAR/NEUTRAL as model conclusions
  {
    const hadObject = isObj(maybeParseSection(cur.marketOverview))
      || cur.marketCondition != null
      || cur.condition != null
      || cur.overallBias != null
      || cur.bias != null;
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
    const anyProvided = Boolean(
      (mc && CONDITIONS.has(mc) && mc !== HFM_REASONING_NOT_PROVIDED)
      || (ob && BIASES.has(ob) && ob !== HFM_REASONING_NOT_PROVIDED)
      || (ta && ALIGN.has(ta) && ta !== HFM_REASONING_NOT_PROVIDED)
      || (typeof m.higherTimeframeBias === "string" && m.higherTimeframeBias.trim()),
    );
    meta.marketOverviewProvided = hadObject && anyProvided;
    if (!meta.marketOverviewProvided) {
      m.sectionStatus = "NOT_PROVIDED";
      m.marketCondition = HFM_REASONING_NOT_PROVIDED;
      m.overallBias = HFM_REASONING_NOT_PROVIDED;
      m.higherTimeframeBias = "Not provided by AI.";
      m.timeframeAlignment = HFM_REASONING_NOT_PROVIDED;
    } else {
      m.sectionStatus = "PROVIDED";
      m.marketCondition = mc && CONDITIONS.has(mc) ? mc : HFM_REASONING_NOT_PROVIDED;
      m.overallBias = ob && BIASES.has(ob) ? ob : HFM_REASONING_NOT_PROVIDED;
      m.timeframeAlignment = ta && ALIGN.has(ta) ? ta : HFM_REASONING_NOT_PROVIDED;
      if (m.higherTimeframeBias != null && typeof m.higherTimeframeBias !== "string") {
        m.higherTimeframeBias = String(m.higherTimeframeBias);
      }
      if (!m.higherTimeframeBias) m.higherTimeframeBias = "Not provided by AI.";
      if (
        m.marketCondition === HFM_REASONING_NOT_PROVIDED
        && m.overallBias === HFM_REASONING_NOT_PROVIDED
        && m.timeframeAlignment === HFM_REASONING_NOT_PROVIDED
      ) {
        meta.marketOverviewProvided = false;
        m.sectionStatus = "NOT_PROVIDED";
      }
    }
    cur = { ...cur, marketOverview: m };
  }

  // timeframeAnalysis — missing TF → NOT_PROVIDED (not synthetic NEUTRAL)
  {
    let tfaRaw = maybeParseSection(cur.timeframeAnalysis);
    if (!isObj(tfaRaw)) tfaRaw = {};
    const tfa: Record<string, unknown> = { ...(tfaRaw as Record<string, unknown>) };
    for (const tf of HFM_REASONING_REQUIRED_TFS) {
      const block = maybeParseSection(tfa[tf] ?? tfa[tf.toLowerCase()] ?? tfa[tf.toUpperCase()]);
      if (!isObj(block)) {
        meta.timeframeProvided[tf] = false;
        tfa[tf] = notProvidedTfBlock();
        continue;
      }
      const b = { ...block };
      const bias = enumToken(b.bias);
      if (bias) b.bias = bias;
      if (b.structure != null && typeof b.structure !== "string") b.structure = String(b.structure);
      b.observations = coerceStringArray(b.observations);
      b.supportingEvidence = coerceStringArray(b.supportingEvidence ?? b.evidence);
      b.risks = coerceStringArray(b.risks);
      const hasContent = Boolean(
        (typeof b.bias === "string" && b.bias && b.bias !== HFM_REASONING_NOT_PROVIDED)
        || (typeof b.structure === "string" && b.structure.trim() && b.structure !== "Not provided by AI.")
        || b.observations.length
        || b.supportingEvidence.length,
      );
      if (!hasContent) {
        meta.timeframeProvided[tf] = false;
        tfa[tf] = notProvidedTfBlock();
        continue;
      }
      if (!b.bias) b.bias = HFM_REASONING_NOT_PROVIDED;
      if (!b.structure) b.structure = "unspecified";
      b.sectionStatus = "PROVIDED";
      meta.timeframeProvided[tf] = true;
      tfa[tf] = b;
    }
    cur = { ...cur, timeframeAnalysis: tfa };
  }

  // scenarios — missing → NOT_SUPPORTED (explicit unsupported, not an active thesis)
  {
    let scRaw = maybeParseSection(cur.scenarios);
    let sc: Record<string, unknown> = {};
    let hadScenarios = false;
    if (isObj(scRaw)) {
      sc = { ...scRaw };
      hadScenarios = true;
    } else if (Array.isArray(scRaw)) {
      hadScenarios = scRaw.length > 0;
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
    meta.scenariosProvided = hadScenarios || isObj(cur.bullish) || isObj(cur.bearish);
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
        tp.setupStatus = act === "WAITING_FOR_CONFIRMATION" ? "WAITING" : "NOT_APPLICABLE";
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

  // riskAssessment — do not invent MODERATE
  {
    const hadRisk = isObj(maybeParseSection(cur.riskAssessment ?? cur.risk));
    let raRaw = maybeParseSection(cur.riskAssessment ?? cur.risk);
    if (!isObj(raRaw)) raRaw = {};
    const ra: Record<string, unknown> = { ...(raRaw as Record<string, unknown>) };
    if (ra.riskLevel == null) ra.riskLevel = ra.level ?? ra.risk;
    const rl = enumToken(ra.riskLevel);
    ra.reasons = coerceStringArray(ra.reasons);
    ra.reasonsToAvoidTrade = coerceStringArray(ra.reasonsToAvoidTrade ?? ra.avoid ?? ra.reasonsToAvoid);
    if (rl && RISK.has(rl) && rl !== HFM_REASONING_NOT_PROVIDED) {
      meta.riskProvided = hadRisk || true;
      ra.sectionStatus = "PROVIDED";
      ra.riskLevel = rl;
    } else {
      meta.riskProvided = false;
      ra.sectionStatus = "NOT_PROVIDED";
      ra.riskLevel = HFM_REASONING_NOT_PROVIDED;
      if (!ra.reasons.length) ra.reasons = ["Not provided by AI."];
    }
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

  // Phase 5 v1.2 — directional assessments, disagreement, confidence semantics
  {
    const parseAssessment = (
      raw: unknown,
      side: "BULLISH" | "BEARISH",
      fallbackScenario: Record<string, unknown> | null,
    ): Record<string, unknown> => {
      let block = maybeParseSection(raw);
      if (!isObj(block)) block = {};
      const b = { ...(block as Record<string, unknown>) };
      b.side = side;
      if (b.status == null && fallbackScenario) b.status = fallbackScenario.status;
      const st = enumToken(b.status);
      b.status = st && SCENARIO.has(st) ? st : (asString(b.status) ?? "NOT_SUPPORTED");
      if (b.summary != null && typeof b.summary !== "string") b.summary = String(b.summary);
      if (!b.summary) {
        b.summary = side === "BULLISH" ? "Bullish assessment not detailed." : "Bearish assessment not detailed.";
      }
      b.supportingEvidenceIds = coerceStringArray(
        b.supportingEvidenceIds ?? b.supportingEvidenceRefs ?? b.supportingEvidence,
      );
      b.conflictingEvidenceIds = coerceStringArray(
        b.conflictingEvidenceIds ?? b.contradictingEvidenceRefs ?? b.conflictingEvidence,
      );
      b.missingConfirmations = coerceStringArray(b.missingConfirmations ?? b.missingEvidence);
      b.invalidationConditions = coerceStringArray(b.invalidationConditions ?? b.invalidation);
      return b;
    };

    const sc = isObj(cur.scenarios) ? (cur.scenarios as Record<string, unknown>) : {};
    cur = {
      ...cur,
      bullishAssessment: parseAssessment(
        cur.bullishAssessment ?? cur.bullishScenarioAssessment,
        "BULLISH",
        isObj(sc.bullish) ? (sc.bullish as Record<string, unknown>) : null,
      ),
      bearishAssessment: parseAssessment(
        cur.bearishAssessment ?? cur.bearishScenarioAssessment,
        "BEARISH",
        isObj(sc.bearish) ? (sc.bearish as Record<string, unknown>) : null,
      ),
    };

    cur.supportingEvidenceIds = coerceStringArray(
      cur.supportingEvidenceIds
        ?? (cur.bullishAssessment as Record<string, unknown>)?.supportingEvidenceIds,
    );
    cur.conflictingEvidenceIds = coerceStringArray(
      cur.conflictingEvidenceIds
        ?? (cur.bearishAssessment as Record<string, unknown>)?.conflictingEvidenceIds,
    );
    cur.missingConfirmations = coerceStringArray(cur.missingConfirmations);
    cur.invalidationConditions = coerceStringArray(cur.invalidationConditions);

    let dd = maybeParseSection(cur.deterministicDisagreement ?? cur.disagreement);
    if (!isObj(dd)) dd = {};
    const disagreement: Record<string, unknown> = { ...(dd as Record<string, unknown>) };
    const asBoolOrNull = (v: unknown): boolean | null => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "boolean") return v;
      const s = String(v).trim().toLowerCase();
      if (s === "true" || s === "agree" || s === "agrees" || s === "yes") return true;
      if (s === "false" || s === "disagree" || s === "disagrees" || s === "no") return false;
      return null;
    };
    disagreement.agreesWithRanking = asBoolOrNull(disagreement.agreesWithRanking);
    disagreement.agreesWithScenarioOutcome = asBoolOrNull(
      disagreement.agreesWithScenarioOutcome ?? disagreement.agreesWithOutcome,
    );
    if (disagreement.disagreementReason != null && typeof disagreement.disagreementReason !== "string") {
      disagreement.disagreementReason = String(disagreement.disagreementReason);
    }
    // Do not invent a disagreement reason — validator rejects empty reason on disagree.
    if (
      disagreement.disagreementReason == null
      || (typeof disagreement.disagreementReason === "string" && !disagreement.disagreementReason.trim())
    ) {
      disagreement.disagreementReason = null;
    }
    disagreement.alternativeEvidenceIds = coerceStringArray(
      disagreement.alternativeEvidenceIds ?? disagreement.supportingAlternativeEvidenceIds,
    );
    cur = { ...cur, deterministicDisagreement: disagreement };

    let cs = maybeParseSection(cur.confidenceSemantics);
    if (!isObj(cs)) cs = {};
    cur = {
      ...cur,
      confidenceSemantics: {
        decisionConfidenceIsWinProbability: false,
        definition: asString((cs as Record<string, unknown>).definition) || HFM_REASONING_CONFIDENCE_DEFINITION,
      },
    };

    if (cur.selectedScenarioId === undefined) cur.selectedScenarioId = null;
    if (cur.selectedScenarioId != null && typeof cur.selectedScenarioId !== "string") {
      cur.selectedScenarioId = String(cur.selectedScenarioId);
    }
    if (typeof cur.selectedScenarioId === "string" && !cur.selectedScenarioId.trim()) {
      cur.selectedScenarioId = null;
    }

    const ds = enumToken(cur.decisionStatus ?? cur.status);
    const DECISION_STATUSES = new Set([
      "OBSERVING",
      "DEVELOPING",
      "WAITING_FOR_CONFIRMATION",
      "CONFIRMED",
      "INVALIDATED",
      "EXPIRED",
      "INSUFFICIENT",
      "NO_TRADE",
      "NOT_PROVIDED",
    ]);
    if (ds && DECISION_STATUSES.has(ds)) {
      cur.decisionStatus = ds;
    } else if (isObj(cur.decision)) {
      const act = String((cur.decision as Record<string, unknown>).action ?? "");
      if (act === "WAITING_FOR_CONFIRMATION") cur.decisionStatus = "WAITING_FOR_CONFIRMATION";
      else if (act === "NO_TRADE") cur.decisionStatus = "NO_TRADE";
      else if (act === "BUY" || act === "SELL") cur.decisionStatus = "CONFIRMED";
      else cur.decisionStatus = "NOT_PROVIDED";
    } else {
      cur.decisionStatus = "NOT_PROVIDED";
    }

    if (cur.marketRegime != null && typeof cur.marketRegime !== "string") {
      cur.marketRegime = String(cur.marketRegime);
    }
    if (!cur.marketRegime) {
      const mo = isObj(cur.marketOverview) ? (cur.marketOverview as Record<string, unknown>) : null;
      cur.marketRegime = asString(mo?.marketCondition) || HFM_REASONING_NOT_PROVIDED;
    }
  }

  if (expected) {
    cur = {
      ...cur,
      schemaVersion: HFM_REASONING_SCHEMA_VERSION,
      analysisStatus: "COMPLETED",
      provider: "HFM_MT5",
      symbol: expected.symbol,
      contextId: expected.contextId,
      snapshotId: expected.snapshotId,
      snapshotHash: expected.snapshotHash,
      promptVersion: HFM_REASONING_PROMPT_VERSION,
      model: typeof cur.model === "string" ? cur.model : expected.model,
      analysisId: typeof cur.analysisId === "string" && cur.analysisId
        ? cur.analysisId
        : (expected as { analysisId?: string }).analysisId ?? expected.contextId,
      disclaimer: HFM_REASONING_DISCLAIMER,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  }
  return { payload: cur, meta };
}

export function validateHfmReasoningModelResponse(input: {
  raw: unknown;
  expected: {
    symbol: string;
    contextId: string;
    snapshotId: string;
    snapshotHash: string;
    model: string;
    analysisId?: string;
  };
  instrument?: HfmReasoningInstrumentMeta | null;
  grounding?: HfmReasoningGroundingContext | null;
}): { ok: true; result: HfmReasoningValidatedResult } | { ok: false; code: string; error: string } {
  const expectedWithAnalysis = {
    ...input.expected,
    analysisId: input.expected.analysisId ?? input.grounding?.analysisId ?? input.expected.contextId,
  };
  const { payload, meta } = normalizeHfmReasoningRawPayload(input.raw, expectedWithAnalysis);
  const raw = payload;
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
  const confNorm = normalizeHfmReasoningConfidence(raw.decision.confidence);
  if (!confNorm.ok) {
    return { ok: false, code: "INVALID_CONFIDENCE", error: confNorm.error };
  }
  const confidence = confNorm.confidence;
  const confidenceLabel = asString(raw.decision.confidenceLabel);
  const summary = asString(raw.decision.summary);
  if (!action || !ACTIONS.has(action) || !confidenceLabel || !CONF_LABELS.has(confidenceLabel) || !summary) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "decision fields invalid" };
  }

  if (!isObj(raw.marketOverview)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "marketOverview missing" };
  }
  const moStatus = (asString(raw.marketOverview.sectionStatus) === "PROVIDED" ? "PROVIDED" : "NOT_PROVIDED") as HfmSectionProvision;
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
    const provision: HfmSectionProvision = meta.timeframeProvided[tf] ? "PROVIDED" : "NOT_PROVIDED";
    const parsed = parseTfBlock(raw.timeframeAnalysis[tf], tf, provision);
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
  const missingSections: string[] = [];
  const completenessNotes: string[] = [];
  for (const tf of HFM_REASONING_REQUIRED_TFS) {
    if (!meta.timeframeProvided[tf]) {
      missingSections.push(`timeframeAnalysis.${tf}`);
      completenessNotes.push(`${tf} analysis not provided by AI`);
    }
  }
  if (!meta.marketOverviewProvided || moStatus === "NOT_PROVIDED") {
    missingSections.push("marketOverview");
    completenessNotes.push("Market overview not provided by AI");
  }
  if (!meta.riskProvided) {
    missingSections.push("riskAssessment");
    completenessNotes.push("Risk assessment not provided by AI");
  }

  let pricePrecision = buildUnavailablePricePrecision("pending");

  // BUY/SELL require all four TF analyses + market overview (fail closed on gaps)
  if (decisionAction === "BUY" || decisionAction === "SELL") {
    if (missingSections.some((s) => s.startsWith("timeframeAnalysis.") || s === "marketOverview")) {
      return {
        ok: false,
        code: "INVALID_MODEL_RESPONSE",
        error: "BUY/SELL rejected: required multi-timeframe or market overview analysis not provided",
      };
    }
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

    const priceCheck = validateTradePlanPricesAgainstInstrument({
      symbol: input.expected.symbol,
      instrument: input.instrument ?? null,
      prices: [
        { label: "entryLow", value: entryLow, required: true },
        { label: "entryHigh", value: entryHigh, required: true },
        { label: "stopLoss", value: stopLoss, required: true },
        ...takeProfitTargets.map((v, i) => ({ label: `takeProfit[${i}]`, value: v, required: true })),
        { label: "invalidationPrice", value: invalidationPrice, required: false },
      ],
    });
    if (!priceCheck.ok) {
      return {
        ok: false,
        code: priceCheck.precision.source === "UNAVAILABLE"
          ? "INSTRUMENT_METADATA_UNAVAILABLE"
          : "INVALID_PRICE_PRECISION",
        error: priceCheck.error,
      };
    }
    pricePrecision = priceCheck.precision;
  } else {
    if (direction !== "NONE") {
      return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "NO_TRADE/WAITING direction must be NONE" };
    }
    pricePrecision = input.instrument
      ? {
          verified: false,
          digits: input.instrument.digits,
          tickSize: input.instrument.tickSize,
          point: input.instrument.point,
          source: "HFM_CATALOG" as const,
          reason: "Not applicable for non-trade decision",
        }
      : buildUnavailablePricePrecision("Not applicable for non-trade decision");
  }

  if (!isObj(raw.evidence)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "evidence missing" };
  }
  const observedFacts = asStringArray(raw.evidence.observedFacts) ?? coerceStringArray(raw.evidence.observedFacts);
  const interpretations = asStringArray(raw.evidence.interpretations) ?? coerceStringArray(raw.evidence.interpretations);
  const uncertainties = asStringArray(raw.evidence.uncertainties) ?? coerceStringArray(raw.evidence.uncertainties);
  let missingData = asStringArray(raw.evidence.missingData) ?? coerceStringArray(raw.evidence.missingData);
  const dataQualityWarnings = asStringArray(raw.evidence.dataQualityWarnings)
    ?? coerceStringArray(raw.evidence.dataQualityWarnings);
  for (const note of completenessNotes) {
    if (!missingData.includes(note)) missingData = [...missingData, note];
  }

  if (!isObj(raw.riskAssessment)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "riskAssessment missing" };
  }
  const riskSection = (asString(raw.riskAssessment.sectionStatus) === "PROVIDED" ? "PROVIDED" : "NOT_PROVIDED") as HfmSectionProvision;
  const riskLevel = asString(raw.riskAssessment.riskLevel);
  const reasons = asStringArray(raw.riskAssessment.reasons) ?? coerceStringArray(raw.riskAssessment.reasons);
  const reasonsToAvoidTrade = asStringArray(raw.riskAssessment.reasonsToAvoidTrade)
    ?? coerceStringArray(raw.riskAssessment.reasonsToAvoidTrade);
  if (!riskLevel || !RISK.has(riskLevel)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "riskAssessment invalid" };
  }

  if (!isObj(raw.nextConfirmation)) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "nextConfirmation missing" };
  }
  if (typeof raw.nextConfirmation.required !== "boolean") {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "nextConfirmation.required invalid" };
  }
  const conditions = asStringArray(raw.nextConfirmation.conditions)
    ?? coerceStringArray(raw.nextConfirmation.conditions);
  const timeframesToWatch = asStringArray(raw.nextConfirmation.timeframesToWatch)
    ?? coerceStringArray(raw.nextConfirmation.timeframesToWatch);

  const disclaimer = asString(raw.disclaimer);
  if (disclaimer !== HFM_REASONING_DISCLAIMER) {
    return { ok: false, code: "INVALID_MODEL_RESPONSE", error: "disclaimer mismatch" };
  }

  const toAssessment = (
    side: "BULLISH" | "BEARISH",
    block: unknown,
    fallback: HfmReasoningValidatedResult["scenarios"]["bullish"],
  ): HfmReasoningDirectionalAssessment => {
    const o = isObj(block) ? block : {};
    return {
      side,
      status: asString(o.status) ?? fallback.status,
      summary: asString(o.summary) ?? `${side} assessment`,
      supportingEvidenceIds: coerceStringArray(o.supportingEvidenceIds),
      conflictingEvidenceIds: coerceStringArray(o.conflictingEvidenceIds),
      missingConfirmations: coerceStringArray(o.missingConfirmations),
      invalidationConditions: coerceStringArray(o.invalidationConditions),
    };
  };

  const bullishAssessment = toAssessment("BULLISH", raw.bullishAssessment, bullish.value);
  const bearishAssessment = toAssessment("BEARISH", raw.bearishAssessment, bearish.value);

  let supportingEvidenceIds = coerceStringArray(raw.supportingEvidenceIds);
  let conflictingEvidenceIds = coerceStringArray(raw.conflictingEvidenceIds);
  if (!supportingEvidenceIds.length) {
    supportingEvidenceIds = [
      ...bullishAssessment.supportingEvidenceIds,
      ...bearishAssessment.supportingEvidenceIds,
    ];
  }
  if (!conflictingEvidenceIds.length) {
    conflictingEvidenceIds = [
      ...bullishAssessment.conflictingEvidenceIds,
      ...bearishAssessment.conflictingEvidenceIds,
    ];
  }
  const missingConfirmations = coerceStringArray(raw.missingConfirmations).length
    ? coerceStringArray(raw.missingConfirmations)
    : [
        ...bullishAssessment.missingConfirmations,
        ...bearishAssessment.missingConfirmations,
      ];
  const invalidationConditions = coerceStringArray(raw.invalidationConditions).length
    ? coerceStringArray(raw.invalidationConditions)
    : [
        ...bullishAssessment.invalidationConditions,
        ...bearishAssessment.invalidationConditions,
      ];

  const ddRaw = isObj(raw.deterministicDisagreement) ? raw.deterministicDisagreement : {};
  const agreesWithRanking =
    typeof ddRaw.agreesWithRanking === "boolean" ? ddRaw.agreesWithRanking : null;
  const agreesWithScenarioOutcome =
    typeof ddRaw.agreesWithScenarioOutcome === "boolean" ? ddRaw.agreesWithScenarioOutcome : null;
  let disagreementReason =
    ddRaw.disagreementReason === null || ddRaw.disagreementReason === undefined
      ? null
      : asString(ddRaw.disagreementReason);
  const alternativeEvidenceIds = coerceStringArray(ddRaw.alternativeEvidenceIds);

  if (
    (agreesWithRanking === false || agreesWithScenarioOutcome === false)
    && (!disagreementReason || !disagreementReason.trim())
  ) {
    return {
      ok: false,
      code: "INVALID_MODEL_RESPONSE",
      error: "deterministic disagreement requires disagreementReason",
    };
  }

  // Reject win-probability claims in summary / disagreement text
  const winProbRe = /\b(win\s*probability|probability\s+of\s+(profit|success)|calibrated\s+success\s+rate)\b/i;
  if (winProbRe.test(summary) || (disagreementReason && winProbRe.test(disagreementReason))) {
    return {
      ok: false,
      code: "INVALID_MODEL_RESPONSE",
      error: "win-probability claims are not permitted; decision.confidence is analytical only",
    };
  }

  const selectedScenarioId =
    raw.selectedScenarioId === null || raw.selectedScenarioId === undefined || raw.selectedScenarioId === ""
      ? null
      : asString(raw.selectedScenarioId);

  const decisionStatus = (asString(raw.decisionStatus) ?? "NOT_PROVIDED") as HfmReasoningDecisionStatus;
  const marketRegime = asString(raw.marketRegime) || HFM_REASONING_NOT_PROVIDED;
  const analysisId =
    asString(raw.analysisId)
    ?? input.expected.analysisId
    ?? input.grounding?.analysisId
    ?? input.expected.contextId;

  if (input.grounding) {
    const g = collectGroundingErrors({
      supportingEvidenceIds,
      conflictingEvidenceIds,
      alternativeEvidenceIds,
      selectedScenarioId,
      entryLow,
      entryHigh,
      stopLoss,
      takeProfitTargets,
      invalidationPrice,
      riskRewardEstimate,
      decisionAction,
      decisionStatus,
      ctx: {
        ...input.grounding,
        tickSize: input.grounding.tickSize ?? input.instrument?.tickSize ?? null,
      },
    });
    if (g.errors.length) {
      return {
        ok: false,
        code: g.code ?? "EVIDENCE_GROUNDING_FAILED",
        error: g.errors.slice(0, 8).join("; "),
      };
    }
    // Strip unknown optional citations already filtered — keep only allow-listed
    supportingEvidenceIds = supportingEvidenceIds.filter((id) =>
      input.grounding!.allowedEvidenceIds.has(id)
    );
    conflictingEvidenceIds = conflictingEvidenceIds.filter((id) =>
      input.grounding!.allowedEvidenceIds.has(id)
    );
  }

  // When disagreement claims alternative evidence, require at least one ID when disagreeing
  if (
    (agreesWithRanking === false || agreesWithScenarioOutcome === false)
    && alternativeEvidenceIds.length === 0
    && input.grounding
    && input.grounding.allowedEvidenceIds.size > 0
  ) {
    return {
      ok: false,
      code: "INVALID_MODEL_RESPONSE",
      error: "disagreement requires alternativeEvidenceIds from availableEvidenceIds",
    };
  }

  const incomplete = missingSections.length > 0
    || (input.grounding?.inputCompleteness === "PARTIAL");
  if (input.grounding?.inputCompleteness === "PARTIAL") {
    completenessNotes.push("Unified AI input marked PARTIAL — not fully evaluated");
    if (!missingData.includes("Unified AI input marked PARTIAL")) {
      missingData = [...missingData, "Unified AI input marked PARTIAL"];
    }
  }

  const result: HfmReasoningValidatedResult = {
    schemaVersion: HFM_REASONING_SCHEMA_VERSION,
    analysisStatus: incomplete ? "COMPLETED_WITH_GAPS" : "COMPLETED",
    provider: "HFM_MT5",
    symbol: input.expected.symbol.toUpperCase(),
    contextId: input.expected.contextId,
    snapshotId: input.expected.snapshotId,
    snapshotHash: input.expected.snapshotHash,
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    model,
    analysisId,
    marketRegime,
    decision: {
      action: decisionAction,
      confidence,
      confidenceLabel: confidenceLabel as HfmReasoningValidatedResult["decision"]["confidenceLabel"],
      summary,
    },
    decisionStatus,
    selectedScenarioId,
    bullishAssessment,
    bearishAssessment,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    missingConfirmations,
    invalidationConditions,
    deterministicDisagreement: {
      agreesWithRanking,
      agreesWithScenarioOutcome,
      disagreementReason,
      alternativeEvidenceIds: alternativeEvidenceIds.filter((id) =>
        !input.grounding || input.grounding.allowedEvidenceIds.has(id)
      ),
    },
    confidenceSemantics: {
      decisionConfidenceIsWinProbability: false,
      definition: HFM_REASONING_CONFIDENCE_DEFINITION,
    },
    unifiedInputIdentity: input.grounding?.unifiedInputIdentity ?? null,
    evidencePackageId: input.grounding?.evidencePackageId ?? null,
    scenarioPackageId: input.grounding?.scenarioPackageId ?? null,
    inputCompleteness: input.grounding?.inputCompleteness ?? "UNKNOWN",
    marketOverview: {
      sectionStatus: meta.marketOverviewProvided ? "PROVIDED" : "NOT_PROVIDED",
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
      // Null RR on non-trade or when incomplete (never fabricate)
      riskRewardEstimate:
        decisionAction === "BUY" || decisionAction === "SELL"
          ? riskRewardEstimate
          : null,
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
      sectionStatus: riskSection,
      riskLevel: riskLevel as HfmReasoningValidatedResult["riskAssessment"]["riskLevel"],
      reasons,
      reasonsToAvoidTrade,
    },
    nextConfirmation: {
      required: raw.nextConfirmation.required,
      conditions,
      timeframesToWatch,
    },
    completeness: {
      status: incomplete ? "INCOMPLETE" : "COMPLETE",
      missingSections,
      notes: completenessNotes,
    },
    pricePrecision,
    disclaimer: HFM_REASONING_DISCLAIMER,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };

  return { ok: true, result };
}

/** Build a minimal valid fixture for unit tests (schema v1.2). */
export function buildMockValidReasoningPayload(expected: {
  symbol: string;
  contextId: string;
  snapshotId: string;
  snapshotHash: string;
  model: string;
  action?: HfmReasoningDecisionAction;
  analysisId?: string;
  supportingEvidenceIds?: string[];
  selectedScenarioId?: string | null;
  agreesWithRanking?: boolean | null;
  agreesWithScenarioOutcome?: boolean | null;
  disagreementReason?: string | null;
  alternativeEvidenceIds?: string[];
}): Record<string, unknown> {
  const action = expected.action ?? "NO_TRADE";
  const tf = {
    sectionStatus: "PROVIDED",
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
  const assessment = (side: "BULLISH" | "BEARISH") => ({
    side,
    status: "NOT_SUPPORTED",
    summary: `${side} not supported in mock`,
    supportingEvidenceIds: expected.supportingEvidenceIds ?? [],
    conflictingEvidenceIds: [],
    missingConfirmations: isTrade ? [] : ["await confirmation"],
    invalidationConditions: [],
  });
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
    analysisId: expected.analysisId ?? expected.contextId,
    marketRegime: "UNCLEAR",
    decision: {
      action,
      confidence: isTrade ? 62 : 40,
      confidenceLabel: isTrade ? "MODERATE" : "LOW",
      summary: "Mock summary",
    },
    decisionStatus: isTrade
      ? "CONFIRMED"
      : action === "WAITING_FOR_CONFIRMATION"
      ? "WAITING_FOR_CONFIRMATION"
      : "NO_TRADE",
    selectedScenarioId: expected.selectedScenarioId ?? null,
    bullishAssessment: assessment("BULLISH"),
    bearishAssessment: assessment("BEARISH"),
    supportingEvidenceIds: expected.supportingEvidenceIds ?? [],
    conflictingEvidenceIds: [],
    missingConfirmations: isTrade ? [] : ["await confirmation"],
    invalidationConditions: [],
    deterministicDisagreement: {
      agreesWithRanking: expected.agreesWithRanking ?? true,
      agreesWithScenarioOutcome: expected.agreesWithScenarioOutcome ?? true,
      disagreementReason: expected.disagreementReason ?? null,
      alternativeEvidenceIds: expected.alternativeEvidenceIds ?? [],
    },
    confidenceSemantics: {
      decisionConfidenceIsWinProbability: false,
      definition: HFM_REASONING_CONFIDENCE_DEFINITION,
    },
    marketOverview: {
      sectionStatus: "PROVIDED",
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
        ? { low: 100, high: 101 }
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
      sectionStatus: "PROVIDED",
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
