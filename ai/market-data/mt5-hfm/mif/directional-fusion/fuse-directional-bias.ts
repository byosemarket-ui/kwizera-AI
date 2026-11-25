/**
 * Deterministic HFM directional evidence fusion.
 * Always emits BUY | SELL primary direction with analytical conviction (not win probability).
 * Does not authorize broker execution.
 */
import type { MifMarketEvidencePackage, MifUnifiedMarketEvidence } from "../market-evidence/types.js";
import type { MifScenarioPackage } from "../scenario-intelligence/types.js";
import type { MifProductionIntegrationResult } from "../production-integration/types.js";
import {
  HFM_DIRECTIONAL_FUSION_CALCULATION_VERSION,
  HFM_DIRECTIONAL_FUSION_CONTRACT_ID,
  HFM_DIRECTIONAL_FUSION_CONTRACT_VERSION,
  HFM_DIRECTIONAL_FUSION_ENGINE_ID,
  HFM_DIRECTIONAL_FUSION_ENGINE_VERSION,
} from "./contracts.js";
import type {
  HfmConflictKind,
  HfmConvictionLabel,
  HfmDirectionalConvictionResult,
  HfmDirectionalEvidenceAtom,
  HfmDirectionalFusionPackage,
  HfmEvidenceFamily,
  HfmMarketDirection,
} from "./types.js";

/** Family weight caps — prevent correlated engines from dominating. */
const FAMILY_CAP: Record<HfmEvidenceFamily, number> = {
  STRUCTURE_TREND: 28,
  REGIME: 18,
  MOMENTUM: 16,
  OPPORTUNITY: 22,
  SCENARIO: 30,
  DTI: 14,
  MTF_ALIGNMENT: 16,
  LIQUIDITY: 10,
  PATTERNS: 12,
  DATA_QUALITY: 0,
};

const TYPE_TO_FAMILY: Partial<Record<string, HfmEvidenceFamily>> = {
  MARKET_STRUCTURE: "STRUCTURE_TREND",
  STRUCTURE_EVENT: "STRUCTURE_TREND",
  MARKET_REGIME: "REGIME",
  MOMENTUM: "MOMENTUM",
  PRICE_DISPLACEMENT: "MOMENTUM",
  BUYER_SELLER_PRESSURE: "MOMENTUM",
  OPPORTUNITY_CANDIDATE: "OPPORTUNITY",
  OPPORTUNITY_RANKING: "OPPORTUNITY",
  DEEP_TECHNICAL_INTELLIGENCE: "DTI",
  MTF_RELATIONSHIP: "MTF_ALIGNMENT",
  LIQUIDITY_REFERENCE: "LIQUIDITY",
  SUPPORT_RESISTANCE: "LIQUIDITY",
  FIBONACCI: "LIQUIDITY",
  CHART_PATTERN: "PATTERNS",
  HARMONIC_PATTERN: "PATTERNS",
  CANDLESTICK_PATTERN: "PATTERNS",
  DATA_QUALITY: "DATA_QUALITY",
  PRODUCTION_PIPELINE: "DATA_QUALITY",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function directionFromEvidence(dir: string | null | undefined): HfmMarketDirection | "NONE" {
  const d = String(dir ?? "").toUpperCase();
  if (d === "BULLISH" || d === "BUY") return "BUY";
  if (d === "BEARISH" || d === "SELL") return "SELL";
  return "NONE";
}

function tipFactor(state: string | null | undefined): {
  freshness: number;
  formingOnly: boolean;
  quality: number;
} {
  const s = String(state ?? "").toUpperCase();
  if (s === "CLOSED") return { freshness: 1, formingOnly: false, quality: 1 };
  if (s === "FORMING") return { freshness: 0.7, formingOnly: true, quality: 0.75 };
  if (s === "STALE") return { freshness: 0.25, formingOnly: false, quality: 0.4 };
  if (s === "MISSING") return { freshness: 0.1, formingOnly: false, quality: 0.2 };
  return { freshness: 0.5, formingOnly: false, quality: 0.5 };
}

function atomWeight(a: HfmDirectionalEvidenceAtom): number {
  return a.rawWeight * a.qualityFactor * a.freshnessFactor * a.confirmationFactor;
}

function convictionLabel(score: number): HfmConvictionLabel {
  if (score < 20) return "MINIMAL";
  if (score < 40) return "LOW";
  if (score < 60) return "MODERATE";
  if (score < 80) return "HIGH";
  return "VERY_HIGH";
}

function classifyConflict(input: {
  bull: number;
  bear: number;
  hasMtfConflict: boolean;
  incomplete: boolean;
  stale: boolean;
  calcError: boolean;
}): HfmConflictKind {
  if (input.calcError) return "CALCULATION_ERROR";
  if (input.stale) return "STALE_DATA";
  if (input.incomplete && input.bull + input.bear < 8) return "INSUFFICIENT_DATA";
  const gap = Math.abs(input.bull - input.bear);
  const total = input.bull + input.bear;
  if (total < 1) return "INSUFFICIENT_DATA";
  if (input.hasMtfConflict && gap / Math.max(total, 1) < 0.35) return "DIFFERENT_TIMEFRAME";
  if (gap / Math.max(total, 1) < 0.15 && total >= 10) return "GENUINE_CONFLICT";
  if (gap / Math.max(total, 1) < 0.25) return "DIFFERENT_METHODOLOGY";
  return "AGREEMENT";
}

function mapEvidenceAtom(item: MifUnifiedMarketEvidence): HfmDirectionalEvidenceAtom | null {
  const family = TYPE_TO_FAMILY[item.evidenceType] ?? null;
  if (!family || family === "DATA_QUALITY") return null;
  const side = directionFromEvidence(item.direction);
  if (side === "NONE") return null;

  const tip = tipFactor(item.candleStatus);
  const confType = String(item.score?.confidenceType ?? "");
  let confirmation = 0.85;
  if (item.score?.value != null && Number.isFinite(item.score.value)) {
    const v = Number(item.score.value);
    confirmation = clamp(v > 1 ? v / 100 : v, 0.35, 1);
  }
  if (tip.formingOnly) confirmation *= 0.7;
  if (/WIN_PROBABILITY|TRADE_OUTCOME/i.test(confType)) confirmation *= 0.5;

  let raw = 8;
  if (family === "STRUCTURE_TREND") raw = 12;
  if (family === "REGIME") raw = 10;
  if (family === "OPPORTUNITY") raw = 11;
  if (family === "DTI") raw = 9;
  if (family === "MTF_ALIGNMENT") raw = 10;
  if (family === "MOMENTUM") raw = 8;
  if (family === "PATTERNS") raw = 7;
  if (family === "LIQUIDITY") raw = 6;

  // Higher TF gets slight boost
  const tf = String(item.timeframe ?? "").toUpperCase();
  if (tf === "H4" || tf === "H1") raw *= 1.15;
  if (tf === "M5") raw *= 0.9;

  return {
    engineId: item.sourceEngine || item.evidenceId,
    family,
    side,
    rawWeight: raw,
    qualityFactor: tip.quality * (item.provenance?.snapshotIdSourceVerified ? 1 : 0.85),
    freshnessFactor: tip.freshness,
    confirmationFactor: confirmation,
    formingOnly: tip.formingOnly,
    note: `${item.evidenceType}:${item.direction}@${tf || "?"}`,
  };
}

function scenarioAtoms(pkg: MifScenarioPackage | null): HfmDirectionalEvidenceAtom[] {
  if (!pkg) return [];
  const out: HfmDirectionalEvidenceAtom[] = [];
  const bull = pkg.bullishScenario;
  const bear = pkg.bearishScenario;
  const statusWeight = (status: string): number => {
    const s = status.toUpperCase();
    if (s === "CONFIRMED") return 1;
    if (s === "WAITING_FOR_CONFIRMATION") return 0.75;
    if (s === "DEVELOPING") return 0.65;
    if (s === "INSUFFICIENT" || s === "INVALIDATED" || s === "EXPIRED") return 0.15;
    return 0.4;
  };
  const bullW = statusWeight(bull.status) * (1 + bull.contributingCandidateIds.length * 0.08);
  const bearW = statusWeight(bear.status) * (1 + bear.contributingCandidateIds.length * 0.08);
  if (bullW > 0.2) {
    out.push({
      engineId: "scenario-bullish",
      family: "SCENARIO",
      side: "BUY",
      rawWeight: 18 * bullW,
      qualityFactor: pkg.completenessTrusted ? 1 : 0.7,
      freshnessFactor: 1,
      confirmationFactor: bull.evidenceCompleteness.trustedConfirmed ? 1 : 0.7,
      formingOnly: bull.evidenceCompleteness.formingOnlyConfirmationBlocked,
      note: `scenario:${bull.status}:cands=${bull.contributingCandidateIds.length}`,
    });
  }
  if (bearW > 0.2) {
    out.push({
      engineId: "scenario-bearish",
      family: "SCENARIO",
      side: "SELL",
      rawWeight: 18 * bearW,
      qualityFactor: pkg.completenessTrusted ? 1 : 0.7,
      freshnessFactor: 1,
      confirmationFactor: bear.evidenceCompleteness.trustedConfirmed ? 1 : 0.7,
      formingOnly: bear.evidenceCompleteness.formingOnlyConfirmationBlocked,
      note: `scenario:${bear.status}:cands=${bear.contributingCandidateIds.length}`,
    });
  }
  if (pkg.strongerSide === "BULLISH") {
    out.push({
      engineId: "scenario-strongerSide",
      family: "SCENARIO",
      side: "BUY",
      rawWeight: 12,
      qualityFactor: 1,
      freshnessFactor: 1,
      confirmationFactor: 0.9,
      formingOnly: false,
      note: `strongerSide=BULLISH:${pkg.outcome}`,
    });
  } else if (pkg.strongerSide === "BEARISH") {
    out.push({
      engineId: "scenario-strongerSide",
      family: "SCENARIO",
      side: "SELL",
      rawWeight: 12,
      qualityFactor: 1,
      freshnessFactor: 1,
      confirmationFactor: 0.9,
      formingOnly: false,
      note: `strongerSide=BEARISH:${pkg.outcome}`,
    });
  }
  return out;
}

function pipelineAtoms(
  pipeline: MifProductionIntegrationResult | null,
  tipStates: Readonly<Record<string, string>>,
): HfmDirectionalEvidenceAtom[] {
  if (!pipeline) return [];
  const out: HfmDirectionalEvidenceAtom[] = [];
  const mtf = String(pipeline.mtfRelation ?? "").toUpperCase();
  if (mtf === "ALIGNED_BULLISH" || mtf === "BULLISH_ALIGNMENT" || mtf.includes("BULL")) {
    out.push({
      engineId: "mtf-relation",
      family: "MTF_ALIGNMENT",
      side: "BUY",
      rawWeight: 14,
      qualityFactor: 1,
      freshnessFactor: 1,
      confirmationFactor: mtf.includes("PARTIAL") ? 0.7 : 1,
      formingOnly: Object.values(tipStates).some((s) => String(s).toUpperCase() === "FORMING"),
      note: `mtfRelation=${pipeline.mtfRelation}`,
    });
  } else if (mtf === "ALIGNED_BEARISH" || mtf === "BEARISH_ALIGNMENT" || (mtf.includes("BEAR") && !mtf.includes("BULL"))) {
    out.push({
      engineId: "mtf-relation",
      family: "MTF_ALIGNMENT",
      side: "SELL",
      rawWeight: 14,
      qualityFactor: 1,
      freshnessFactor: 1,
      confirmationFactor: mtf.includes("PARTIAL") ? 0.7 : 1,
      formingOnly: Object.values(tipStates).some((s) => String(s).toUpperCase() === "FORMING"),
      note: `mtfRelation=${pipeline.mtfRelation}`,
    });
  }

  for (const snap of pipeline.timeframeSnapshots ?? []) {
    const dir = directionFromEvidence(snap.regimeDirection);
    if (dir === "NONE") continue;
    const tip = tipFactor(snap.tipCandleState ?? tipStates[snap.timeframe]);
    const tf = String(snap.timeframe).toUpperCase();
    const tfBoost = tf === "H4" || tf === "H1" ? 1.2 : tf === "M5" ? 0.85 : 1;
    out.push({
      engineId: `regime-${snap.timeframe}`,
      family: "REGIME",
      side: dir,
      rawWeight: 7 * tfBoost,
      qualityFactor: tip.quality,
      freshnessFactor: tip.freshness,
      confirmationFactor: snap.regimeStatus === "VALID" || snap.regimeStatus === "OK" ? 1 : 0.6,
      formingOnly: tip.formingOnly,
      note: `regime:${snap.regimeDirection}@${snap.timeframe}`,
    });
  }

  // Candidate direction counts (capped via OPPORTUNITY family)
  const detection = pipeline.detection;
  if (detection?.candidates?.length) {
    let buy = 0;
    let sell = 0;
    for (const c of detection.candidates) {
      if (c.status === "REJECTED" || c.status === "INVALID") continue;
      if (c.direction === "BUY") buy += 1;
      if (c.direction === "SELL") sell += 1;
    }
    if (buy > 0) {
      out.push({
        engineId: "od-candidates-buy",
        family: "OPPORTUNITY",
        side: "BUY",
        rawWeight: Math.min(16, 5 + buy * 3),
        qualityFactor: 0.9,
        freshnessFactor: 1,
        confirmationFactor: 0.8,
        formingOnly: false,
        note: `od_buy_candidates=${buy}`,
      });
    }
    if (sell > 0) {
      out.push({
        engineId: "od-candidates-sell",
        family: "OPPORTUNITY",
        side: "SELL",
        rawWeight: Math.min(16, 5 + sell * 3),
        qualityFactor: 0.9,
        freshnessFactor: 1,
        confirmationFactor: 0.8,
        formingOnly: false,
        note: `od_sell_candidates=${sell}`,
      });
    }
  }
  return out;
}

/**
 * Cap per-family contribution and correlate-dedupe by engine family.
 * Same family contributions on one side are summed then capped — not counted N times at full weight.
 */
function applyFamilyCaps(
  atoms: readonly HfmDirectionalEvidenceAtom[],
): {
  buyScore: number;
  sellScore: number;
  familyCapsApplied: Record<string, number>;
  supporting: string[];
  contradicting: string[];
  keyEvidence: string[];
} {
  const buyByFamily = new Map<HfmEvidenceFamily, number>();
  const sellByFamily = new Map<HfmEvidenceFamily, number>();
  const buyEngines: string[] = [];
  const sellEngines: string[] = [];
  const keyEvidence: string[] = [];

  for (const a of atoms) {
    const w = atomWeight(a);
    if (w <= 0 || a.side === "NONE") continue;
    const map = a.side === "BUY" ? buyByFamily : sellByFamily;
    map.set(a.family, (map.get(a.family) ?? 0) + w);
    if (a.side === "BUY") buyEngines.push(a.engineId);
    else sellEngines.push(a.engineId);
    if (keyEvidence.length < 12) keyEvidence.push(a.note);
  }

  const familyCapsApplied: Record<string, number> = {};
  let buyScore = 0;
  let sellScore = 0;
  for (const family of Object.keys(FAMILY_CAP) as HfmEvidenceFamily[]) {
    const cap = FAMILY_CAP[family];
    const b = buyByFamily.get(family) ?? 0;
    const s = sellByFamily.get(family) ?? 0;
    const bCapped = Math.min(b, cap);
    const sCapped = Math.min(s, cap);
    if (b > cap || s > cap) {
      familyCapsApplied[family] = cap;
    }
    buyScore += bCapped;
    sellScore += sCapped;
  }

  const direction: HfmMarketDirection = buyScore >= sellScore ? "BUY" : "SELL";
  const supporting = [...new Set(direction === "BUY" ? buyEngines : sellEngines)].slice(0, 24);
  const contradicting = [...new Set(direction === "BUY" ? sellEngines : buyEngines)].slice(0, 24);

  return {
    buyScore: round1(buyScore),
    sellScore: round1(sellScore),
    familyCapsApplied,
    supporting,
    contradicting,
    keyEvidence,
  };
}

function computeConviction(input: {
  buyScore: number;
  sellScore: number;
  evidenceCompleteness: number;
  dataQuality: number;
  conflictKind: HfmConflictKind;
  formingOnlyShare: number;
  supporting: string[];
  contradicting: string[];
  keyEvidence: string[];
  limitations: string[];
  tieBreakApplied: boolean;
  tieBreakReason: string | null;
}): HfmDirectionalConvictionResult {
  const direction: HfmMarketDirection =
    input.buyScore > input.sellScore
      ? "BUY"
      : input.sellScore > input.buyScore
      ? "SELL"
      : "BUY"; // placeholder; caller applies tie-break before this when equal

  const winner = direction === "BUY" ? input.buyScore : input.sellScore;
  const loser = direction === "BUY" ? input.sellScore : input.buyScore;
  const total = winner + loser;
  const dominance = total > 0 ? winner / total : 0.5;
  const margin = winner - loser;

  let score = 50 * dominance + clamp(margin * 1.2, 0, 25);
  score *= 0.55 + 0.45 * input.evidenceCompleteness;
  score *= 0.6 + 0.4 * input.dataQuality;

  if (input.conflictKind === "GENUINE_CONFLICT") score *= 0.72;
  else if (input.conflictKind === "DIFFERENT_TIMEFRAME") score *= 0.85;
  else if (input.conflictKind === "DIFFERENT_METHODOLOGY") score *= 0.9;
  else if (input.conflictKind === "INSUFFICIENT_DATA") score *= 0.55;
  else if (input.conflictKind === "STALE_DATA") score *= 0.5;
  else if (input.conflictKind === "CALCULATION_ERROR") score *= 0.4;

  score *= 1 - 0.35 * clamp(input.formingOnlyShare, 0, 1);
  if (input.tieBreakApplied) score = Math.min(score, 28);

  const directionalConvictionScore = clamp(Math.round(score), 0, 100);
  const conflictSeverity = clamp(
    Math.round(
      (1 - Math.abs(input.buyScore - input.sellScore) / Math.max(input.buyScore + input.sellScore, 1))
        * 100
        * (input.conflictKind === "AGREEMENT" ? 0.35 : 1),
    ),
    0,
    100,
  );

  return {
    direction,
    directionalConvictionScore,
    convictionLabel: convictionLabel(directionalConvictionScore),
    bullishEvidenceScore: round1(input.buyScore),
    bearishEvidenceScore: round1(input.sellScore),
    evidenceCompleteness: round1(input.evidenceCompleteness * 100) / 100,
    dataQuality: round1(input.dataQuality * 100) / 100,
    conflictSeverity,
    conflictKind: input.conflictKind,
    supportingEngineIds: input.supporting,
    contradictingEngineIds: input.contradicting,
    keyEvidence: input.keyEvidence,
    knownLimitations: input.limitations,
    calculationVersion: HFM_DIRECTIONAL_FUSION_CALCULATION_VERSION,
    tieBreakApplied: input.tieBreakApplied,
    tieBreakReason: input.tieBreakReason,
    scoreSemantics: "ANALYTICAL_DIRECTIONAL_CONVICTION_NOT_WIN_PROBABILITY",
    executionAuthorizationImplied: false,
  };
}

export interface FuseHfmDirectionalBiasInput {
  symbol: string;
  timeframe?: string;
  scenarioPackage: MifScenarioPackage | null;
  evidencePackage: MifMarketEvidencePackage | null;
  pipeline?: MifProductionIntegrationResult | null;
  tipStates?: Readonly<Record<string, string>>;
  generatedAt?: string;
}

/**
 * Fuse all available analytical evidence into one BUY|SELL directional assessment.
 */
export function fuseHfmDirectionalBias(
  input: FuseHfmDirectionalBiasInput,
): HfmDirectionalFusionPackage {
  const tipStates = input.tipStates ?? {};
  const atoms: HfmDirectionalEvidenceAtom[] = [];
  const limitations: string[] = [];

  atoms.push(...scenarioAtoms(input.scenarioPackage));
  atoms.push(...pipelineAtoms(input.pipeline ?? null, tipStates));

  const items = input.evidencePackage?.items ?? [];
  // Deduplicate by sourceAssessmentId within family to avoid double-counting same swing/fact
  const seenAssessment = new Set<string>();
  for (const item of items) {
    const atom = mapEvidenceAtom(item);
    if (!atom) continue;
    const assessKey = `${atom.family}:${item.provenance?.sourceAssessmentId || item.evidenceId}`;
    if (seenAssessment.has(assessKey)) continue;
    seenAssessment.add(assessKey);
    atoms.push(atom);
  }

  if (!input.scenarioPackage) limitations.push("SCENARIO_PACKAGE_ABSENT");
  if (!input.evidencePackage) limitations.push("EVIDENCE_PACKAGE_ABSENT");
  if (!items.length) limitations.push("NO_EVIDENCE_ITEMS");
  if (!atoms.length) limitations.push("NO_DIRECTIONAL_ATOMS");

  const capped = applyFamilyCaps(atoms);
  let buyScore = capped.buyScore;
  let sellScore = capped.sellScore;
  let tieBreakApplied = false;
  let tieBreakReason: string | null = null;
  let direction: HfmMarketDirection;

  if (buyScore > sellScore) {
    direction = "BUY";
  } else if (sellScore > buyScore) {
    direction = "SELL";
  } else {
    // Deterministic tie-break: HTF structure/regime → closed structural → documented fallback
    tieBreakApplied = true;
    const htfBuy = atoms
      .filter((a) => a.side === "BUY" && (a.family === "STRUCTURE_TREND" || a.family === "REGIME") && !a.formingOnly)
      .reduce((s, a) => s + atomWeight(a), 0);
    const htfSell = atoms
      .filter((a) => a.side === "SELL" && (a.family === "STRUCTURE_TREND" || a.family === "REGIME") && !a.formingOnly)
      .reduce((s, a) => s + atomWeight(a), 0);
    if (htfBuy > htfSell) {
      direction = "BUY";
      tieBreakReason = "HTF_STRUCTURE_REGIME_BUY";
      buyScore = round1(buyScore + 0.01);
    } else if (htfSell > htfBuy) {
      direction = "SELL";
      tieBreakReason = "HTF_STRUCTURE_REGIME_SELL";
      sellScore = round1(sellScore + 0.01);
    } else {
      const closedBuy = atoms
        .filter((a) => a.side === "BUY" && !a.formingOnly)
        .reduce((s, a) => s + atomWeight(a), 0);
      const closedSell = atoms
        .filter((a) => a.side === "SELL" && !a.formingOnly)
        .reduce((s, a) => s + atomWeight(a), 0);
      if (closedBuy >= closedSell) {
        direction = "BUY";
        tieBreakReason = closedBuy > 0 ? "CLOSED_CANDLE_STRUCTURAL_BUY" : "DETERMINISTIC_FALLBACK_BUY_MINIMAL";
        buyScore = round1(buyScore + 0.01);
      } else {
        direction = "SELL";
        tieBreakReason = "CLOSED_CANDLE_STRUCTURAL_SELL";
        sellScore = round1(sellScore + 0.01);
      }
      if (tieBreakReason === "DETERMINISTIC_FALLBACK_BUY_MINIMAL") {
        limitations.push("MINIMAL_EVIDENCE_FALLBACK");
        limitations.push("DO_NOT_TREAT_AS_STRONG_SIGNAL");
      }
    }
  }

  const formingCount = atoms.filter((a) => a.formingOnly).length;
  const formingOnlyShare = atoms.length ? formingCount / atoms.length : 1;
  const expectedFamilies = 7;
  const presentFamilies = new Set(atoms.map((a) => a.family)).size;
  const evidenceCompleteness = clamp(presentFamilies / expectedFamilies, 0.15, 1);

  const tipVals = Object.values(tipStates);
  const staleCount = tipVals.filter((s) => /STALE|MISSING/i.test(s)).length;
  const dataQuality = clamp(
    1
      - staleCount * 0.15
      - (input.evidencePackage?.warnings?.length ? 0.05 : 0)
      - (input.scenarioPackage && !input.scenarioPackage.completenessTrusted ? 0.1 : 0),
    0.2,
    1,
  );

  const mtfConflict = /CONFLICT|POTENTIAL_REVERSAL|MIXED/i.test(
    String(input.pipeline?.mtfRelation ?? "")
      + (input.scenarioPackage?.timeframeContext.conflictNotes.join(" ") ?? ""),
  );

  const conflictKind = classifyConflict({
    bull: buyScore,
    bear: sellScore,
    hasMtfConflict: mtfConflict,
    incomplete: evidenceCompleteness < 0.45 || limitations.includes("NO_DIRECTIONAL_ATOMS"),
    stale: staleCount > 0 || limitations.includes("STALE_DATA"),
    calcError: false,
  });

  if (formingOnlyShare > 0.6) limitations.push("FORMING_HEAVY_EVIDENCE");
  if (mtfConflict) limitations.push("MTF_DIRECTIONAL_TENSION");
  if (conflictKind === "GENUINE_CONFLICT") limitations.push("GENUINE_ENGINE_CONFLICT");
  limitations.push("NOT_WIN_PROBABILITY");
  limitations.push("NOT_EXECUTION_AUTHORIZATION");

  // Recompute supporting relative to chosen direction after tie-break
  const supporting =
    direction === "BUY"
      ? capped.supporting
      : capped.contradicting.length
      ? capped.contradicting
      : capped.supporting;
  const contradicting =
    direction === "BUY"
      ? capped.contradicting
      : capped.supporting.length
      ? capped.supporting
      : capped.contradicting;

  // Fix supporting/contradicting properly from scores
  const buyEngines = [...new Set(atoms.filter((a) => a.side === "BUY").map((a) => a.engineId))];
  const sellEngines = [...new Set(atoms.filter((a) => a.side === "SELL").map((a) => a.engineId))];

  const conviction = computeConviction({
    buyScore,
    sellScore,
    evidenceCompleteness,
    dataQuality,
    conflictKind,
    formingOnlyShare,
    supporting: direction === "BUY" ? buyEngines.slice(0, 24) : sellEngines.slice(0, 24),
    contradicting: direction === "BUY" ? sellEngines.slice(0, 24) : buyEngines.slice(0, 24),
    keyEvidence: capped.keyEvidence,
    limitations: [...new Set(limitations)],
    tieBreakApplied,
    tieBreakReason,
  });

  // Ensure direction matches tie-break choice
  conviction.direction = direction;
  if (tieBreakApplied && conviction.directionalConvictionScore > 28) {
    conviction.directionalConvictionScore = 28;
    conviction.convictionLabel = convictionLabel(28);
  }

  void supporting;
  void contradicting;

  return {
    contractId: HFM_DIRECTIONAL_FUSION_CONTRACT_ID,
    contractVersion: HFM_DIRECTIONAL_FUSION_CONTRACT_VERSION,
    engineId: HFM_DIRECTIONAL_FUSION_ENGINE_ID,
    engineVersion: HFM_DIRECTIONAL_FUSION_ENGINE_VERSION,
    symbol: input.symbol,
    timeframe: input.timeframe ?? "MULTI",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    conviction,
    atoms,
    familyCapsApplied: capped.familyCapsApplied,
  };
}

/** Map scenario strongerSide / fusion to BUY|SELL. */
export function marketDirectionFromFusion(
  pkg: HfmDirectionalFusionPackage | null | undefined,
): HfmMarketDirection {
  return pkg?.conviction.direction === "SELL" ? "SELL" : "BUY";
}
