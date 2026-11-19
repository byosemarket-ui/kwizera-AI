/**
 * Phase 5C Step 3 — pattern / Fibonacci / harmonic cross-timeframe relationships.
 * Avoids inventing double-counted confluence as independent probability.
 */
import type { MifMtfNormalizedContext, MifMtfPatternRelationship, MifMtfTimeframeSources } from "./types.js";

export function analyzePatternRelationships(input: {
  contexts: readonly MifMtfNormalizedContext[];
  sources: readonly MifMtfTimeframeSources[];
}): MifMtfPatternRelationship {
  const higherDirs: string[] = [];
  const lowerDirs: string[] = [];
  const harmonicByTf: Record<string, string[]> = {};
  let forming = 0;
  let confirmed = 0;

  for (const c of input.contexts) {
    if (!c.available) continue;
    if (c.band === "HIGHER") higherDirs.push(...c.patternDirections, ...c.harmonicOrientations);
    if (c.band === "LOWER" || c.band === "INTERMEDIATE") {
      lowerDirs.push(...c.patternDirections, ...c.harmonicOrientations);
    }
    if (c.harmonicOrientations.length) harmonicByTf[c.timeframe] = [...c.harmonicOrientations];
  }

  for (const s of input.sources) {
    for (const d of s.chartPatterns?.detections ?? []) {
      if (d.lifecycle === "FORMING") forming++;
      else if (d.lifecycle === "CONFIRMED") confirmed++;
    }
    for (const d of s.harmonic?.detections ?? []) {
      if (d.lifecycle === "FORMING") forming++;
      else if (d.lifecycle === "CONFIRMED") confirmed++;
    }
  }

  const knownHigher = higherDirs.filter((d) => d === "UP" || d === "DOWN");
  const knownLower = lowerDirs.filter((d) => d === "UP" || d === "DOWN");

  if (knownHigher.length === 0 && knownLower.length === 0) {
    return {
      status: "NONE",
      higherPatternDirs: higherDirs,
      lowerPatternDirs: lowerDirs,
      harmonicOrientationsByTf: harmonicByTf,
      formingVsConfirmed: { forming, confirmed },
      explanation: "no pattern/harmonic directional evidence across timeframes",
      alignmentComponentScore: null,
    };
  }

  if (knownHigher.length === 0 || knownLower.length === 0) {
    return {
      status: "INSUFFICIENT",
      higherPatternDirs: higherDirs,
      lowerPatternDirs: lowerDirs,
      harmonicOrientationsByTf: harmonicByTf,
      formingVsConfirmed: { forming, confirmed },
      explanation: "pattern evidence present on only one side of the hierarchy",
      alignmentComponentScore: 0.25,
    };
  }

  const hUp = knownHigher.every((d) => d === "UP");
  const hDown = knownHigher.every((d) => d === "DOWN");
  const lUp = knownLower.every((d) => d === "UP");
  const lDown = knownLower.every((d) => d === "DOWN");

  let status: MifMtfPatternRelationship["status"] = "PARTIAL";
  let explanation = "";
  let score: number | null = 0.5;

  if ((hUp && lUp) || (hDown && lDown)) {
    status = "AGREE";
    explanation = "pattern/harmonic orientations agree across higher and lower bands";
    score = 1;
  } else if ((hUp && lDown) || (hDown && lUp)) {
    status = "CONFLICT";
    explanation =
      "pattern/harmonic orientations conflict across bands — preserved; "
      + "correlated swing evidence is not double-counted as independent confirmation";
    score = 0;
  } else {
    status = "PARTIAL";
    explanation = "mixed pattern/harmonic orientations; partial agreement only";
    score = 0.5;
  }

  // Fibonacci presence boosts component score slightly only when directions already agree —
  // never invents agreement from fib alone.
  const fibCount = input.contexts.filter((c) => c.fibonacciPresent).length;
  if (status === "AGREE" && fibCount >= 2) {
    explanation += `; Fibonacci present on ${fibCount} timeframes (proximity not scored as win probability)`;
  }

  return {
    status,
    higherPatternDirs: higherDirs,
    lowerPatternDirs: lowerDirs,
    harmonicOrientationsByTf: harmonicByTf,
    formingVsConfirmed: { forming, confirmed },
    explanation,
    alignmentComponentScore: score,
  };
}
