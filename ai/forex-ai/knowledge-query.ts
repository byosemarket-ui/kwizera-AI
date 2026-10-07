/**
 * Build a concise retrieval query from Market State facts (Phase 20).
 * Knowledge is reference material — never treated as live market data.
 */
import type { ForexKnowledgeRetrievalHit } from "../forex-knowledge/types.js";
import type { ForexMarketState } from "./types.js";

export const FOREX_AI_KNOWLEDGE_TOP_K = 2;
export const FOREX_AI_KNOWLEDGE_CHAR_BUDGET = 900;

export function buildForexKnowledgeQuery(market: ForexMarketState, analysisType?: string): string {
  const parts = [
    analysisType && analysisType !== "MARKET_OVERVIEW" ? analysisType.replace(/_/g, " ").toLowerCase() : "",
    market.trend ? `${market.trend} trend` : "trend",
    market.momentum ? `${market.momentum} momentum` : "momentum",
    market.volatility ? `${market.volatility} volatility` : "volatility",
    market.indicators.rsi != null ? "RSI interpretation" : "",
    market.indicators.macd.macd != null ? "MACD confirmation" : "",
    Object.values(market.indicators.ema).some((v) => v != null) ? "EMA trend confirmation" : "",
    "market structure risk warning",
  ];
  return parts.filter(Boolean).join(" ").slice(0, 220);
}

/** Compact knowledge context for the prompt — ranked, budget-limited. */
export function formatKnowledgeForPrompt(hits: ForexKnowledgeRetrievalHit[]): string {
  if (hits.length === 0) {
    return "No published indexed Forex knowledge matched this query.";
  }
  const blocks: string[] = [];
  let used = 0;
  for (const hit of hits.slice(0, FOREX_AI_KNOWLEDGE_TOP_K)) {
    const snippet = hit.content.replace(/\s+/g, " ").trim().slice(0, 280);
    const block = [
      `[doc:${hit.documentId} v${hit.version} score=${hit.relevanceScore.toFixed(2)}] ${hit.title}`,
      snippet,
    ].join("\n");
    if (used + block.length > FOREX_AI_KNOWLEDGE_CHAR_BUDGET) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n---\n");
}

export function toKnowledgeSources(hits: ForexKnowledgeRetrievalHit[]): Array<{
  documentId: string;
  title: string;
  relevanceScore: number;
  version: number;
}> {
  const seen = new Set<string>();
  const sources: Array<{
    documentId: string;
    title: string;
    relevanceScore: number;
    version: number;
  }> = [];
  for (const hit of hits) {
    if (seen.has(hit.documentId)) continue;
    seen.add(hit.documentId);
    sources.push({
      documentId: hit.documentId,
      title: hit.title,
      relevanceScore: hit.relevanceScore,
      version: hit.version,
    });
  }
  return sources;
}
