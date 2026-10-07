/**
 * Phase 19 — Dedicated Forex AI Knowledge Base domain types.
 * Separate from live Binance Market State and from the general studio Knowledge pipeline UI.
 */

export const FOREX_KNOWLEDGE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ForexKnowledgeStatus = (typeof FOREX_KNOWLEDGE_STATUSES)[number];

export const FOREX_INDEXING_STATUSES = [
  "NOT_INDEXED",
  "INDEXING",
  "INDEXED",
  "FAILED",
  "STALE",
] as const;
export type ForexIndexingStatus = (typeof FOREX_INDEXING_STATUSES)[number];

export const FOREX_KNOWLEDGE_TYPES = [
  "DEFINITION",
  "CONCEPT",
  "RULE",
  "EXPLANATION",
  "PROCEDURE",
  "PATTERN",
  "INDICATOR",
  "STRATEGY_CONCEPT",
  "RISK_RULE",
  "EXAMPLE",
  "WARNING",
  "AI_GUIDELINE",
] as const;
export type ForexKnowledgeType = (typeof FOREX_KNOWLEDGE_TYPES)[number];

export const FOREX_SOURCE_TYPES = [
  "MANUAL",
  "INTERNAL",
  "EXTERNAL_URL",
  "BOOK",
  "COURSE",
  "OTHER",
] as const;
export type ForexSourceType = (typeof FOREX_SOURCE_TYPES)[number];

export interface ForexKnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForexKnowledgeTopic {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForexKnowledgeDocument {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  categoryId: string | null;
  topicId: string | null;
  tags: string[];
  knowledgeType: ForexKnowledgeType;
  status: ForexKnowledgeStatus;
  sourceType: ForexSourceType;
  sourceName: string;
  sourceReference: string;
  sourceUrl: string;
  language: string;
  version: number;
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  indexedAt: string | null;
  indexingStatus: ForexIndexingStatus;
  indexingError: string | null;
  metadata: Record<string, unknown>;
}

export interface ForexKnowledgeChunk {
  id: string;
  documentId: string;
  version: number;
  chunkIndex: number;
  title: string;
  text: string;
  categoryId: string | null;
  topicId: string | null;
  tags: string[];
  knowledgeType: ForexKnowledgeType;
  status: ForexKnowledgeStatus;
  createdAt: string;
}

export interface ForexKnowledgeCreateInput {
  title: string;
  summary?: string;
  content: string;
  categoryId?: string | null;
  topicId?: string | null;
  tags?: string[];
  knowledgeType?: ForexKnowledgeType;
  status?: ForexKnowledgeStatus;
  sourceType?: ForexSourceType;
  sourceName?: string;
  sourceReference?: string;
  sourceUrl?: string;
  language?: string;
  author?: string;
  metadata?: Record<string, unknown>;
}

export interface ForexKnowledgeUpdateInput {
  title?: string;
  summary?: string;
  content?: string;
  categoryId?: string | null;
  topicId?: string | null;
  tags?: string[];
  knowledgeType?: ForexKnowledgeType;
  sourceType?: ForexSourceType;
  sourceName?: string;
  sourceReference?: string;
  sourceUrl?: string;
  language?: string;
  author?: string;
  metadata?: Record<string, unknown>;
}

export interface ForexKnowledgeListQuery {
  q?: string;
  categoryId?: string;
  topicId?: string;
  knowledgeType?: ForexKnowledgeType;
  status?: ForexKnowledgeStatus;
  indexingStatus?: ForexIndexingStatus;
  tag?: string;
  language?: string;
  page?: number;
  pageSize?: number;
  sort?: "updatedAt" | "createdAt" | "title";
  order?: "asc" | "desc";
}

export interface ForexKnowledgeListResult {
  items: ForexKnowledgeDocument[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ForexKnowledgeOverview {
  documents: number;
  drafts: number;
  published: number;
  archived: number;
  indexed: number;
  indexing: number;
  stale: number;
  failed: number;
  notIndexed: number;
  categories: number;
  topics: number;
  chunks: number;
  recentUpdates: Array<{
    id: string;
    title: string;
    status: ForexKnowledgeStatus;
    indexingStatus: ForexIndexingStatus;
    updatedAt: string;
  }>;
}

export interface ForexKnowledgeRetrievalQuery {
  query: string;
  categoryId?: string;
  topicId?: string;
  tags?: string[];
  knowledgeType?: ForexKnowledgeType;
  limit?: number;
}

export interface ForexKnowledgeRetrievalHit {
  documentId: string;
  chunkId: string;
  title: string;
  content: string;
  relevanceScore: number;
  categoryId: string | null;
  topicId: string | null;
  tags: string[];
  knowledgeType: ForexKnowledgeType;
  sourceName: string;
  version: number;
}

export const DEFAULT_FOREX_CATEGORIES: Array<{ name: string; slug: string; description: string }> = [
  { name: "Forex Fundamentals", slug: "forex-fundamentals", description: "Core FX concepts and market mechanics." },
  { name: "Technical Analysis", slug: "technical-analysis", description: "Indicators, trends, and chart reading." },
  { name: "Market Structure", slug: "market-structure", description: "Swings, BOS, CHoCH, and structure states." },
  { name: "Candlestick Patterns", slug: "candlestick-patterns", description: "Single and multi-candle formations." },
  { name: "Chart Patterns", slug: "chart-patterns", description: "Classical chart patterns and ranges." },
  { name: "Indicators", slug: "indicators", description: "RSI, MACD, Bollinger, ATR, and related tools." },
  { name: "Fibonacci", slug: "fibonacci", description: "Retracement, extension, and interpretation notes." },
  { name: "Harmonic Patterns", slug: "harmonic-patterns", description: "Gartley, Bat, Butterfly, Crab, and related." },
  { name: "Elliott Wave", slug: "elliott-wave", description: "Impulse, correction, and wave principles." },
  { name: "Risk Management", slug: "risk-management", description: "Sizing, R:R, exposure, and drawdown." },
  { name: "Trading Psychology", slug: "trading-psychology", description: "Discipline, bias, and behavioral risk." },
  { name: "Fundamental Analysis", slug: "fundamental-analysis", description: "Rates, inflation, policy, and macro drivers." },
  { name: "News & Events", slug: "news-events", description: "Event risk and high-impact releases." },
  { name: "Strategy Concepts", slug: "strategy-concepts", description: "Conceptual strategy frameworks (not signals)." },
  { name: "General Forex", slug: "general-forex", description: "Cross-cutting Forex AI knowledge." },
];
