/**
 * Parse / validate / lightly ground MTF AI JSON against compact facts.
 */
import { randomUUID } from "node:crypto";
import type { ForexAiDecisionPosture, ForexAiKnowledgeSource } from "../types.js";
import {
  FOREX_MTF_ENGINE_VERSION,
  FOREX_MTF_PROMPT_VERSION,
  FOREX_MTF_SCHEMA_VERSION,
  roleForTimeframe,
} from "./config.js";
import { buildFactualTimeframeAnalysis } from "./fallback.js";
import type {
  ForexMtfAiAnalysis,
  ForexMtfAlignmentResult,
  ForexMtfScenario,
  ForexMtfScenarioType,
  ForexMultiTimeframeMarketState,
} from "./types.js";

const SCENARIO_TYPES = new Set<ForexMtfScenarioType>([
  "BULLISH_CONTINUATION", "BEARISH_CONTINUATION", "PULLBACK", "CONSOLIDATION",
  "CONFLICT", "WAIT", "INSUFFICIENT_DATA",
]);
const DECISIONS = new Set<ForexAiDecisionPosture>(["OBSERVE", "WAIT", "ANALYZE", "INSUFFICIENT_DATA"]);

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
}

function clip(text: string, max = 360): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function parseScenario(raw: unknown): ForexMtfScenario | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const type = asString(item.type).toUpperCase() as ForexMtfScenarioType;
  if (!SCENARIO_TYPES.has(type)) return null;
  return {
    type,
    name: asString(item.name) || type,
    status: "POSSIBLE",
    reasoning: clip(asString(item.reasoning), 320),
    conditions: asStringArray(item.conditions).slice(0, 4),
    confirmation: asStringArray(item.confirmation).slice(0, 4),
    invalidation: asStringArray(item.invalidation).slice(0, 4),
  };
}

/** Practical checks for unsupported multi-timeframe claims. */
export function detectMtfGroundingViolations(
  blob: string,
  mtf: ForexMultiTimeframeMarketState,
): string[] {
  const flags: string[] = [];
  const lower = blob.toLowerCase();

  if (/\b(buy|sell|long|short)\s+(now|order|market|signal)\b/i.test(blob)
    || /\bexecute\s+(a\s+)?(trade|order)\b/i.test(blob)) {
    flags.push("AI attempted trade-execution language.");
  }

  for (const slot of mtf.slots) {
    const tf = slot.timeframe;
    if (!slot.compact.usable) {
      const claim = new RegExp(`${tf}\\s+(confirmation|rsi\\s*(=|is)\\s*\\d)`, "i");
      if (claim.test(blob) || lower.includes(`${tf} confirmation`)) {
        flags.push(`AI claimed ${tf} confirmation/value while ${tf} is unavailable.`);
      }
    } else if (slot.compact.rsi == null) {
      const m = lower.match(new RegExp(`${tf}[^\\n]{0,40}rsi[^\\d]{0,6}(\\d{1,3}(?:\\.\\d+)?)`));
      if (m) flags.push(`AI invented ${tf} RSI while RSI was unavailable.`);
    } else {
      const m = lower.match(new RegExp(`${tf}[^\\n]{0,40}rsi[^\\d]{0,6}(\\d{1,3}(?:\\.\\d+)?)`));
      if (m) {
        const claimed = Number(m[1]);
        if (Number.isFinite(claimed) && Math.abs(claimed - slot.compact.rsi) > 8) {
          flags.push(`AI claimed ${tf} RSI inconsistent with Market State.`);
        }
      }
    }
  }
  return flags;
}

export function parseMtfAiAnalysis(
  data: Record<string, unknown>,
  context: {
    mtf: ForexMultiTimeframeMarketState;
    alignment: ForexMtfAlignmentResult;
    model: string | null;
    knowledgeSources: ForexAiKnowledgeSource[];
  },
): { ok: true; analysis: ForexMtfAiAnalysis } | { ok: false; code: "AI_FORMAT_ERROR" | "AI_ANALYSIS_INVALID"; error: string } {
  const summary = asString(data.summary) || asString(data.reasoning);
  if (!summary) {
    return { ok: false, code: "AI_FORMAT_ERROR", error: "MTF AI response missing summary/reasoning." };
  }

  const blob = [
    summary,
    asString(data.reasoning),
    JSON.stringify(data.timeframe_interpretations ?? []),
    JSON.stringify(data.scenarios ?? []),
  ].join("\n");

  const grounding = detectMtfGroundingViolations(blob, context.mtf);
  if (grounding.length) {
    return { ok: false, code: "AI_ANALYSIS_INVALID", error: grounding[0]! };
  }

  const decisionRaw = asString(data.decision_posture ?? data.decisionPosture).toUpperCase() as ForexAiDecisionPosture;
  const decisionPosture = DECISIONS.has(decisionRaw) ? decisionRaw : "WAIT";

  const interpretations = Array.isArray(data.timeframe_interpretations)
    ? data.timeframe_interpretations
    : Array.isArray(data.timeframeInterpretations)
      ? data.timeframeInterpretations
      : [];

  const factual = buildFactualTimeframeAnalysis(context.mtf);
  const timeframeAnalysis = factual.map((row) => {
    const match = interpretations.find((item) => {
      if (!item || typeof item !== "object") return false;
      return asString((item as Record<string, unknown>).timeframe).toLowerCase() === row.timeframe;
    }) as Record<string, unknown> | undefined;
    return {
      ...row,
      role: roleForTimeframe(row.timeframe),
      interpretation: clip(asString(match?.interpretation) || asString(match?.reasoning), 280),
    };
  });

  const higherRaw = asString(data.higher_bias ?? data.higherBias).toUpperCase();
  const higherDirection = (["BULLISH", "BEARISH", "NEUTRAL", "UNKNOWN"] as const).includes(higherRaw as never)
    ? higherRaw as "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN"
    : context.alignment.higherBias;

  const scenarios = (Array.isArray(data.scenarios) ? data.scenarios : [])
    .map(parseScenario)
    .filter((s): s is ForexMtfScenario => s != null)
    .slice(0, 2);

  return {
    ok: true,
    analysis: {
      schemaVersion: FOREX_MTF_SCHEMA_VERSION,
      analysisId: randomUUID(),
      generatedAt: new Date().toISOString(),
      narrativeStatus: "MODEL",
      market: {
        exchange: "BINANCE",
        symbol: context.mtf.symbol,
        displaySymbol: context.mtf.displaySymbol,
        marketType: "CRYPTO",
      },
      timeframes: context.mtf.timeframes,
      timeframeStates: context.mtf.slots.map((s) => s.compact),
      dataQuality: {
        status: context.mtf.dataQuality,
        perTimeframe: context.mtf.slots.map((s) => ({
          timeframe: s.timeframe,
          status: s.compact.status,
          timestamp: s.compact.timestamp,
        })),
      },
      overallAlignment: context.alignment,
      higherTimeframeBias: {
        direction: higherDirection,
        basis: context.alignment.higherBasis,
      },
      intermediateTimeframeState: context.alignment.intermediateState,
      lowerTimeframeState: context.alignment.lowerState,
      timeframeAnalysis,
      confluence: context.alignment.confluence,
      conflicts: context.alignment.conflicts,
      scenarios,
      confirmationNeeded: asStringArray(data.confirmation_needed ?? data.confirmationNeeded).slice(0, 6),
      invalidationConditions: asStringArray(data.invalidation ?? data.invalidationConditions).slice(0, 6),
      risks: asStringArray(data.risks).slice(0, 6),
      knowledgeSources: context.knowledgeSources,
      limitations: [
        ...asStringArray(data.limitations).slice(0, 4),
        "Multi-timeframe AI is interpretive, not guaranteed prediction.",
        "Does not execute trades.",
      ].slice(0, 8),
      decisionPosture,
      confidence: null,
      model: context.model,
      promptVersion: FOREX_MTF_PROMPT_VERSION,
      engineVersion: FOREX_MTF_ENGINE_VERSION,
    },
  };
}
