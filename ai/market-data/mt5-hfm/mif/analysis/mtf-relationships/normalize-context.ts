/**
 * Phase 5C Step 3 — per-timeframe context normalization from existing assessments.
 * Does not recompute swings/ATR/patterns — references source evidence only.
 */
import type { MifMtfBand, MifMtfDirection, MifMtfNormalizedContext, MifMtfRelationshipsPolicy, MifMtfTimeframeSources } from "./types.js";

function bandOf(tf: string, policy: MifMtfRelationshipsPolicy): MifMtfBand | "UNSUPPORTED" {
  for (const b of policy.bands) {
    if (b.timeframes.includes(tf)) return b.band;
  }
  return "UNSUPPORTED";
}

function mapRegimeDirection(d: string | null | undefined): MifMtfDirection {
  if (d === "UP") return "UP";
  if (d === "DOWN") return "DOWN";
  if (d === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

function isUsableStatus(status: string | null | undefined, policy: MifMtfRelationshipsPolicy): boolean {
  if (!status) return false;
  return policy.usableSourceStatuses.includes(status);
}

/**
 * Normalize one timeframe's source assessments into an analytical context.
 * UNKNOWN remains UNKNOWN — never silently converted to NEUTRAL.
 */
export function normalizeTimeframeContext(
  sources: MifMtfTimeframeSources,
  policy: MifMtfRelationshipsPolicy,
): MifMtfNormalizedContext {
  const timeframe = String(sources.timeframe || "").trim();
  const band = bandOf(timeframe, policy);
  const limitations: string[] = [];

  const regime = sources.regime ?? null;
  const harmonic = sources.harmonic ?? null;
  const fibonacci = sources.fibonacci ?? null;
  const chartPatterns = sources.chartPatterns ?? null;
  const unified = sources.unified ?? null;

  const hasAny =
    regime != null || harmonic != null || fibonacci != null || chartPatterns != null || unified != null;

  if (!hasAny) {
    return {
      timeframe,
      band,
      available: false,
      direction: "UNKNOWN",
      structure: null,
      volatility: null,
      regimeComposite: null,
      patternDirections: [],
      harmonicOrientations: [],
      fibonacciPresent: false,
      unifiedStatus: null,
      qualityStatus: sources.qualityStatus ?? "MISSING",
      tipCandleState: sources.tipCandleState ?? null,
      tipTimebase: sources.tipTimebase ?? null,
      tipOpenTimeSec: sources.tipOpenTimeSec ?? null,
      sourceRefs: {
        regimeAssessmentId: null,
        regimeInputIdentity: null,
        harmonicAssessmentId: null,
        fibonacciAssessmentId: null,
        chartPatternsAssessmentId: null,
        unifiedAssessmentId: null,
      },
      evidenceKind: "UNAVAILABLE",
      limitations: ["no source assessments for timeframe"],
    };
  }

  let direction: MifMtfDirection = "UNKNOWN";
  let structure: string | null = null;
  let volatility: string | null = null;
  let regimeComposite: string | null = null;
  let evidenceKind: MifMtfNormalizedContext["evidenceKind"] = "OBSERVED";

  if (regime && isUsableStatus(regime.status, policy)) {
    direction = mapRegimeDirection(regime.direction);
    structure = regime.structure;
    volatility = regime.volatility;
    regimeComposite = regime.compositeLabel;
  } else if (regime) {
    limitations.push(`regime status ${regime.status} not usable under policy`);
    direction = mapRegimeDirection(regime.direction);
    structure = regime.structure;
    volatility = regime.volatility;
    regimeComposite = regime.compositeLabel;
    evidenceKind = "DERIVED";
  }

  const patternDirections: string[] = [];
  if (chartPatterns) {
    for (const d of chartPatterns.detections) {
      // Infer direction from pattern type / confirmation where available.
      const confDir = d.confirmation?.direction;
      if (confDir === "BULLISH") patternDirections.push("UP");
      else if (confDir === "BEARISH") patternDirections.push("DOWN");
      else if (
        d.patternType === "DOUBLE_BOTTOM"
        || d.patternType === "INVERSE_HEAD_AND_SHOULDERS"
        || d.patternType === "ASCENDING_TRIANGLE"
      ) {
        patternDirections.push("UP");
      } else if (
        d.patternType === "DOUBLE_TOP"
        || d.patternType === "HEAD_AND_SHOULDERS"
        || d.patternType === "DESCENDING_TRIANGLE"
      ) {
        patternDirections.push("DOWN");
      } else {
        patternDirections.push("UNKNOWN");
      }
    }
  }

  const harmonicOrientations: string[] = [];
  if (harmonic) {
    for (const d of harmonic.detections) {
      harmonicOrientations.push(d.orientation === "BULLISH" ? "UP" : "DOWN");
    }
  }

  // If regime direction unknown, derive soft hint from patterns/harmonics (explicitly DERIVED).
  if (direction === "UNKNOWN") {
    const votes = [...patternDirections, ...harmonicOrientations].filter((x) => x === "UP" || x === "DOWN");
    const up = votes.filter((v) => v === "UP").length;
    const down = votes.filter((v) => v === "DOWN").length;
    if (up > 0 && down === 0) {
      direction = "UP";
      evidenceKind = "DERIVED";
      limitations.push("direction derived from pattern/harmonic orientations (regime unavailable/unusable)");
    } else if (down > 0 && up === 0) {
      direction = "DOWN";
      evidenceKind = "DERIVED";
      limitations.push("direction derived from pattern/harmonic orientations (regime unavailable/unusable)");
    } else if (up > 0 && down > 0) {
      limitations.push("conflicting pattern/harmonic orientations; direction remains UNKNOWN");
    }
  }

  if (sources.tipCandleState === "FORMING") {
    limitations.push("tip candle FORMING — not treated as CLOSED confirmation");
  }
  if (sources.tipCandleState === "STALE") {
    limitations.push("tip candle STALE");
  }
  if (sources.tipCandleState === "MISSING") {
    limitations.push("tip candle MISSING");
  }
  if (sources.tipTimebase === "UNKNOWN") {
    limitations.push("tip timebase UNKNOWN — cross-TF sync limited");
  }

  const qualityStatus =
    sources.qualityStatus
    ?? regime?.qualityRef.status
    ?? harmonic?.qualityRef.status
    ?? fibonacci?.qualityRef?.status
    ?? chartPatterns?.qualityRef?.status
    ?? "MISSING";

  return {
    timeframe,
    band,
    available: true,
    direction,
    structure,
    volatility,
    regimeComposite,
    patternDirections,
    harmonicOrientations,
    fibonacciPresent:
      fibonacci != null
      && ((fibonacci.retracements?.length ?? 0) > 0 || (fibonacci.extensions?.length ?? 0) > 0),
    unifiedStatus: unified?.status ?? null,
    qualityStatus,
    tipCandleState: sources.tipCandleState ?? null,
    tipTimebase: sources.tipTimebase ?? null,
    tipOpenTimeSec: sources.tipOpenTimeSec ?? null,
    sourceRefs: {
      regimeAssessmentId: regime?.assessmentId ?? null,
      regimeInputIdentity: regime?.inputIdentity ?? null,
      harmonicAssessmentId: harmonic?.assessmentId ?? null,
      fibonacciAssessmentId: fibonacci?.assessmentId ?? null,
      chartPatternsAssessmentId: chartPatterns?.assessmentId ?? null,
      unifiedAssessmentId: unified?.assessmentId ?? null,
    },
    evidenceKind,
    limitations,
  };
}

export function summarizeBand(
  band: MifMtfBand,
  contexts: readonly MifMtfNormalizedContext[],
  policy: MifMtfRelationshipsPolicy,
): import("./types.js").MifMtfBandSummary {
  const bandTfs = policy.bands.find((b) => b.band === band)?.timeframes ?? [];
  const present = contexts.filter((c) => c.band === band && c.available);
  const presentTfs = present.map((c) => c.timeframe);
  const missing = bandTfs.filter((tf) => !presentTfs.includes(tf));
  const dirs = present.map((c) => c.direction).filter((d) => d === "UP" || d === "DOWN" || d === "NEUTRAL");
  const notes: string[] = [];

  if (present.length === 0) {
    return {
      band,
      timeframesPresent: [],
      timeframesMissing: [...bandTfs],
      consensusDirection: "UNKNOWN",
      consensusStructure: null,
      agreement: "INSUFFICIENT",
      notes: ["no available contexts in band"],
    };
  }

  const up = dirs.filter((d) => d === "UP").length;
  const down = dirs.filter((d) => d === "DOWN").length;
  const neutral = dirs.filter((d) => d === "NEUTRAL").length;
  let consensusDirection: MifMtfDirection = "UNKNOWN";
  let agreement: "AGREE" | "PARTIAL" | "CONFLICT" | "INSUFFICIENT" = "INSUFFICIENT";

  if (up > 0 && down === 0 && neutral === 0) {
    consensusDirection = "UP";
    agreement = "AGREE";
  } else if (down > 0 && up === 0 && neutral === 0) {
    consensusDirection = "DOWN";
    agreement = "AGREE";
  } else if (neutral > 0 && up === 0 && down === 0) {
    consensusDirection = "NEUTRAL";
    agreement = "AGREE";
  } else if (up > 0 && down > 0) {
    consensusDirection = "UNKNOWN";
    agreement = "CONFLICT";
    notes.push("directional conflict within band");
  } else if ((up > 0 || down > 0) && neutral > 0) {
    consensusDirection = up > down ? "UP" : down > up ? "DOWN" : "NEUTRAL";
    agreement = "PARTIAL";
    notes.push("mixed directional/neutral evidence within band");
  } else {
    agreement = "INSUFFICIENT";
    notes.push("insufficient directional evidence");
  }

  const structures = present.map((c) => c.structure).filter(Boolean) as string[];
  const uniqueStruct = [...new Set(structures)];
  const consensusStructure = uniqueStruct.length === 1 ? uniqueStruct[0]! : uniqueStruct.length > 1 ? null : null;
  if (uniqueStruct.length > 1) notes.push(`structure conflict: ${uniqueStruct.join(",")}`);

  return {
    band,
    timeframesPresent: presentTfs,
    timeframesMissing: missing,
    consensusDirection,
    consensusStructure,
    agreement,
    notes,
  };
}
