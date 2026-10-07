/**
 * Phase 24 — Retrieval diagnostics / dry-run context builder (no Ollama call).
 */
import { getForexKnowledgeService } from "../../forex-knowledge/index.js";
import { createBinanceMarketDataService } from "../../market-data/binance/service.js";
import { getForexMemoryService } from "../../forex-memory/index.js";
import { computeMtfAlignment } from "../mtf/alignment.js";
import { buildMultiTimeframeMarketState, resolveMtfTimeframes } from "../mtf/build-state.js";
import { formatDecisionFactsBlock } from "../decision/compact.js";
import { FOREX_DECISION_REQUIRED } from "../decision/config.js";
import { runDeterministicDecisionEngines } from "../decision/decision-engine.js";
import { FOREX_AI_KNOWLEDGE_TOP_K } from "../knowledge-query.js";
import { assembleLabeledPromptBody, buildIntelligenceContext } from "./context-builder.js";
import { FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET } from "./config.js";
import { getForexIntelligenceSettingsService } from "./settings.js";

export async function buildForexRetrievalDiagnostic(input: {
  symbol?: string;
  timeframes?: string[];
  knowledgeQuery?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  currentMarketContext: string;
  mtfSummary: string;
  decisionState: string;
  knowledgeResults: Array<{
    source: "KNOWLEDGE";
    documentId: string;
    title: string;
    relevanceReason: string;
    status: string;
  }>;
  memoryResults: Array<{
    source: "MEMORY";
    memoryId: string;
    symbol: string;
    scenario: string | null;
    outcome: string;
    relevanceReason: string;
    timestamp: string;
    status: "HISTORICAL";
  }>;
  finalCompactContext: string;
  promptChars: number;
  promptBudget: number;
  withinBudget: boolean;
  memoryUnavailable: boolean;
  knowledgeUnavailable: boolean;
  calledOllama: false;
}> {
  const symbol = String(input.symbol ?? "BTCUSDT").trim().toUpperCase();
  const resolved = resolveMtfTimeframes(input.timeframes);
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
      currentMarketContext: "",
      mtfSummary: "",
      decisionState: "",
      knowledgeResults: [],
      memoryResults: [],
      finalCompactContext: "",
      promptChars: 0,
      promptBudget: FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET,
      withinBudget: true,
      memoryUnavailable: false,
      knowledgeUnavailable: false,
      calledOllama: false,
    };
  }

  const settings = await getForexIntelligenceSettingsService().getSettings();
  const binance = createBinanceMarketDataService();
  const mtf = await buildMultiTimeframeMarketState({
    symbol,
    timeframes: resolved.timeframes,
    binance,
    required: FOREX_DECISION_REQUIRED.filter((tf) => resolved.timeframes.includes(tf)),
  });
  const alignment = computeMtfAlignment(
    mtf.slots.map((s) => s.compact),
    mtf.required,
  );
  const pack = runDeterministicDecisionEngines(mtf, alignment);
  const currentFacts = formatDecisionFactsBlock(pack);

  let knowledgeHits: Awaited<ReturnType<ReturnType<typeof getForexKnowledgeService>["retrieveRelevantForexKnowledge"]>> = [];
  let knowledgeUnavailable = false;
  if (settings.knowledgeRagEnabled) {
    try {
      const q = String(input.knowledgeQuery ?? "").trim()
        || `scenario entry confirmation invalidation ${pack.scenario.type}`;
      knowledgeHits = await getForexKnowledgeService().retrieveRelevantForexKnowledge({
        query: q,
        limit: Math.min(2, FOREX_AI_KNOWLEDGE_TOP_K),
      });
    } catch {
      knowledgeHits = [];
      knowledgeUnavailable = true;
    }
  }

  let memoryPack: Awaited<ReturnType<ReturnType<typeof getForexMemoryService>["retrieve"]>> | null = null;
  let memoryUnavailable = false;
  if (settings.memoryRetrievalEnabled && settings.memoryMaxExamples > 0) {
    try {
      memoryPack = await getForexMemoryService().retrieve({
        symbol,
        scenario: pack.scenario.type,
        limit: settings.memoryMaxExamples,
      });
    } catch {
      memoryPack = null;
      memoryUnavailable = true;
    }
  }

  const intel = buildIntelligenceContext({
    currentFactsLine: currentFacts,
    knowledgeHits,
    memoryPack,
    knowledgeError: knowledgeUnavailable,
    memoryError: memoryUnavailable,
  });

  const finalCompactContext = assembleLabeledPromptBody({
    header: `DRY-RUN CONTEXT (no Ollama) prompt=${intel.promptVersion}`,
    currentFacts,
    knowledgeText: intel.knowledgeText,
    memoryText: intel.memoryText,
    budget: settings.promptCharBudget,
  });

  return {
    ok: true,
    currentMarketContext: intel.labeledSections.current,
    mtfSummary: `alignment=${alignment.overall} higherBias=${alignment.higherBias} tfs=${mtf.timeframes.join(",")}`,
    decisionState: [
      `scenario=${pack.scenario.type}`,
      `posture=${pack.decisionPosture}`,
      `entry=${pack.entryZone.status}`,
      pack.deterministicSummary.slice(0, 240),
    ].join(" | "),
    knowledgeResults: intel.knowledgeSources.map((k) => ({
      source: "KNOWLEDGE" as const,
      documentId: k.documentId,
      title: k.title,
      relevanceReason: "methodology / reference match",
      status: "METHODOLOGY",
    })),
    memoryResults: intel.memorySources.map((m) => ({
      source: "MEMORY" as const,
      memoryId: m.memoryId,
      symbol: m.symbol,
      scenario: m.scenario,
      outcome: m.outcome,
      relevanceReason: m.relevance,
      timestamp: m.timestamp,
      status: "HISTORICAL" as const,
    })),
    finalCompactContext,
    promptChars: finalCompactContext.length,
    promptBudget: settings.promptCharBudget,
    withinBudget: finalCompactContext.length <= settings.promptCharBudget,
    memoryUnavailable,
    knowledgeUnavailable,
    calledOllama: false,
  };
}
