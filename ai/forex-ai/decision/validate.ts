/**
 * Parse / ground AI narrative against deterministic pack + memory sources.
 */
import { randomUUID } from "node:crypto";
import type { ForexAiKnowledgeSource } from "../types.js";
import type { ForexMemorySourceRef } from "../intelligence/context-builder.js";
import { detectMemoryGroundingViolations } from "../intelligence/memory-grounding.js";
import {
  FOREX_DECISION_ENGINE_VERSION,
  FOREX_DECISION_PROMPT_VERSION,
  FOREX_DECISION_SCHEMA_VERSION,
} from "./config.js";
import type { ForexDecisionAnalysis, ForexDecisionDeterministicPack } from "./types.js";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).map((s) => s.trim()).filter(Boolean).slice(0, 8);
}

function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/** Practical grounding: reject invented prices / RSI / entry claims. */
export function detectDecisionGroundingViolations(
  text: string,
  pack: ForexDecisionDeterministicPack,
): string[] {
  const violations: string[] = [];
  const lower = text.toLowerCase();

  if (/\b(buy now|sell now|go long|go short|place (a )?buy|place (a )?sell)\b/i.test(text)) {
    violations.push("Execution language (BUY/SELL order instruction) is not allowed.");
  }

  const rsiClaims = [...text.matchAll(/\b(?:RSI|rsi)\s*(?:=|is|:)?\s*(\d+(?:\.\d+)?)/g)];
  for (const m of rsiClaims) {
    const claimed = Number(m[1]);
    const match = pack.mtf.slots.some((s) => {
      const r = s.compact.rsi;
      return r != null && Math.abs(r - claimed) < 0.6;
    });
    if (!match) violations.push(`Unsupported RSI claim: ${claimed}`);
  }

  if (pack.entryZone.status === "UNAVAILABLE") {
    if (/\bentry\s*(zone|price)?\s*(=|at|:)?\s*\d{3,}/i.test(text)) {
      violations.push("Entry zone numeric claim while entry zone is UNAVAILABLE.");
    }
  } else if (pack.entryZone.lowerBound != null && pack.entryZone.upperBound != null) {
    const entryNums = [...text.matchAll(/\bentry\s*(?:zone)?\s*(?:=|at|:)?\s*(\d+(?:\.\d+)?)/gi)];
    for (const m of entryNums) {
      const n = Number(m[1]);
      if (
        Number.isFinite(n)
        && (n < pack.entryZone.lowerBound * 0.98 || n > pack.entryZone.upperBound * 1.02)
      ) {
        if (pack.entryZone.referencePrice != null && Math.abs(n - pack.entryZone.referencePrice) < 1) continue;
        violations.push(`Entry claim ${n} outside derived zone.`);
      }
    }
  }

  if (pack.stopLossCandidate == null && /\bstop[\s-]?loss\s*(=|at|:)?\s*\d+/i.test(lower)) {
    violations.push("Stop-loss numeric claim while stopLossCandidate is null.");
  }

  return violations;
}

export function parseDecisionAiNarrative(
  raw: unknown,
  context: {
    pack: ForexDecisionDeterministicPack;
    model: string | null;
    knowledgeSources: ForexAiKnowledgeSource[];
    memorySources?: ForexMemorySourceRef[];
    memoryUnavailable?: boolean;
    knowledgeUnavailable?: boolean;
    extraLimitations?: string[];
  },
): { ok: true; analysis: ForexDecisionAnalysis } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Response was not a JSON object" };
  }
  const data = raw as Record<string, unknown>;
  const interpretation = clip(
    asString(data.interpretation ?? data.ai_interpretation ?? data.aiInterpretation)
      || asString(data.summary)
      || "",
    800,
  );
  if (!interpretation) {
    return { ok: false, error: "Missing interpretation field" };
  }

  const blob = JSON.stringify(data);
  const memorySources = context.memorySources ?? [];
  const violations = [
    ...detectDecisionGroundingViolations(blob, context.pack),
    ...detectMemoryGroundingViolations(blob, { pack: context.pack, memorySources }),
  ];
  if (violations.length) {
    return { ok: false, error: `Grounding violations: ${violations.join("; ")}` };
  }

  const risks = asStringArray(data.risks);
  const limitations = asStringArray(data.limitations);
  const confirmNotes = asString(data.confirmation_notes ?? data.confirmationNotes);
  const invalNotes = asString(data.invalidation_notes ?? data.invalidationNotes);

  const analysis = assembleDecisionAnalysis({
    pack: context.pack,
    narrativeStatus: "MODEL",
    aiInterpretation: [
      interpretation,
      confirmNotes ? `Confirmation: ${confirmNotes}` : "",
      invalNotes ? `Invalidation: ${invalNotes}` : "",
    ].filter(Boolean).join("\n"),
    knowledgeSources: context.knowledgeSources,
    memorySources,
    memoryUnavailable: Boolean(context.memoryUnavailable),
    knowledgeUnavailable: Boolean(context.knowledgeUnavailable),
    model: context.model,
    extraRisks: risks,
    extraLimitations: [...limitations, ...(context.extraLimitations ?? [])],
  });

  return { ok: true, analysis };
}

export function assembleDecisionAnalysis(input: {
  pack: ForexDecisionDeterministicPack;
  narrativeStatus: ForexDecisionAnalysis["narrativeStatus"];
  aiInterpretation: string | null;
  knowledgeSources: ForexAiKnowledgeSource[];
  memorySources?: ForexMemorySourceRef[];
  memoryUnavailable?: boolean;
  knowledgeUnavailable?: boolean;
  model: string | null;
  extraRisks?: string[];
  extraLimitations?: string[];
}): ForexDecisionAnalysis {
  const { pack } = input;
  const limitations = [
    ...(input.extraLimitations ?? []),
    "Analytical decision layer only — not trade execution.",
    "No broker orders are placed.",
    "confidence is null (no formal confidence methodology).",
    "MODEL TRAINING: Not active. MEMORY LEARNING / KNOWLEDGE RETRIEVAL: external context only.",
  ];
  if (input.narrativeStatus === "DETERMINISTIC_ONLY") {
    limitations.push("AI narrative unavailable; deterministic engines only.");
  }

  return {
    schemaVersion: FOREX_DECISION_SCHEMA_VERSION,
    analysisId: randomUUID(),
    generatedAt: new Date().toISOString(),
    narrativeStatus: input.narrativeStatus,
    market: {
      exchange: "BINANCE",
      symbol: pack.mtf.symbol,
      displaySymbol: pack.mtf.displaySymbol,
      marketType: "SPOT",
      currentPrice: pack.entryZone.currentPrice,
    },
    timeframes: pack.mtf.timeframes,
    timeframeStates: pack.mtf.slots.map((s) => s.compact),
    dataQuality: {
      status: pack.mtf.dataQuality,
      perTimeframe: pack.mtf.slots.map((s) => ({
        timeframe: s.timeframe,
        status: s.compact.status,
        timestamp: s.compact.timestamp,
      })),
    },
    alignment: pack.alignment,
    scenario: pack.scenario,
    entryZone: pack.entryZone,
    confirmation: pack.confirmation,
    invalidation: pack.invalidation,
    riskContext: pack.riskContext,
    riskReward: pack.riskReward,
    stopLossCandidate: pack.stopLossCandidate,
    takeProfitCandidates: pack.takeProfitCandidates,
    decisionPosture: pack.decisionPosture,
    observedFacts: pack.observedFacts,
    deterministicSummary: pack.deterministicSummary,
    aiInterpretation: input.aiInterpretation,
    knowledgeSources: input.knowledgeSources,
    memorySources: input.memorySources ?? [],
    memoryUnavailable: Boolean(input.memoryUnavailable),
    knowledgeUnavailable: Boolean(input.knowledgeUnavailable),
    limitations: limitations.filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 20),
    confidence: null,
    model: input.model,
    promptVersion: FOREX_DECISION_PROMPT_VERSION,
    engineVersion: FOREX_DECISION_ENGINE_VERSION,
  };
}

export function decisionRiskLines(analysis: ForexDecisionAnalysis, extra: string[] = []): string[] {
  return [...analysis.riskContext.factors, ...extra].slice(0, 12);
}
