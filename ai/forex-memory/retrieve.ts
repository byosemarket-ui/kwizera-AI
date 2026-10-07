/**
 * Compact historical memory retrieval for future AI context.
 * Current Market State always has priority over memory.
 */
import {
  FOREX_MEMORY_RETRIEVE_LIMIT,
  type ForexAnalysisMemoryRecord,
  type ForexMemoryContextPack,
  type ForexMemoryRetrieveQuery,
  type ForexScenarioOutcomeRecord,
} from "./types.js";

function daysAgo(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 9999;
  return Math.max(0, (nowMs - t) / (24 * 60 * 60 * 1000));
}

export function retrieveRelevantMemory(input: {
  analyses: ForexAnalysisMemoryRecord[];
  outcomes: ForexScenarioOutcomeRecord[];
  query: ForexMemoryRetrieveQuery;
  nowMs?: number;
}): ForexMemoryContextPack {
  const nowMs = input.nowMs ?? Date.now();
  const limit = Math.min(FOREX_MEMORY_RETRIEVE_LIMIT, Math.max(1, input.query.limit ?? FOREX_MEMORY_RETRIEVE_LIMIT));
  const outcomeByAnalysis = new Map(input.outcomes.map((o) => [o.analysisId, o]));

  const scored = input.analyses.map((a) => {
    let score = 0;
    if (input.query.symbol && a.symbol === input.query.symbol.toUpperCase()) score += 5;
    if (input.query.scenario && a.scenario === input.query.scenario) score += 4;
    if (input.query.marketRegime && a.marketRegime === input.query.marketRegime) score += 3;
    const age = daysAgo(a.generatedAt, nowMs);
    score += Math.max(0, 3 - age / 30); // recency
    const outcome = outcomeByAnalysis.get(a.id);
    if (outcome && outcome.status !== "PENDING") score += 1;
    return { a, score, outcome };
  })
    .filter((x) => x.score > 0 || !input.query.symbol)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);

  return {
    sampleSize: scored.length,
    examples: scored.map(({ a, score, outcome }) => ({
      analysisId: a.id,
      symbol: a.symbol,
      scenario: a.scenario,
      regime: a.marketRegime,
      outcome: outcome?.status ?? "NONE",
      posture: a.decisionPosture,
      generatedAt: a.generatedAt,
      score: Number(score.toFixed(3)),
    })),
    limitations: [
      "Historical memory is context only.",
      "Current Market State has priority over memory.",
      "Do not inherit directional bias from past outcomes.",
      "Sample may be insufficient for statistical claims.",
    ],
    note: "MEMORY ≠ KNOWLEDGE. Memory is historical observation; Knowledge is methodology.",
  };
}

export function formatMemoryContextForPrompt(pack: ForexMemoryContextPack): string {
  if (pack.examples.length === 0) return "HISTORICAL MEMORY: none";
  const lines = [
    "HISTORICAL MEMORY CONTEXT (context only; current Market State wins):",
    `sample=${pack.sampleSize}`,
    ...pack.examples.map((e, i) =>
      `${i + 1}. ${e.symbol} scenario=${e.scenario ?? "n/a"} regime=${e.regime} outcome=${e.outcome} at=${e.generatedAt}`),
    ...pack.limitations.slice(0, 3),
  ];
  return lines.join("\n");
}
