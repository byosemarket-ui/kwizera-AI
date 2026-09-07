/**
 * KWIZERA Intelligence Layer — Memory→Knowledge→Learning→Skills→Decision
 * Lightweight, resource-aware. Does not replace Memory/Knowledge foundations.
 * Ollama remains optional reasoning only; validators + engines stay authoritative.
 */

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export type LearningOutcomeKind =
  | "SUCCESSFUL_PATTERN"
  | "FAILED_PATTERN"
  | "NEUTRAL_OBSERVATION"
  | "USER_PREFERENCE"
  | "SYSTEM_CONSTRAINT"
  | "MODEL_LIMITATION";

export type DecisionType =
  | "IMAGE_SEQUENCE"
  | "SCENE_STRUCTURE"
  | "MOTION"
  | "TRANSITION"
  | "CTA_TIMING"
  | "CREATIVE_MODE"
  | "PACING";

export interface LearningEvent {
  eventId: string;
  projectId: string;
  createdAt: string;
  kind: LearningOutcomeKind;
  qualityScore: number | null;
  planSource: "ai" | "deterministic" | null;
  aiModelId: string | null;
  advisorSource: "ollama" | "deterministic-fallback" | null;
  sceneDurationsMs: number[];
  transitions: string[];
  motions: string[];
  scenePurposes: string[];
  fallbackUsed: boolean;
  renderSucceeded: boolean;
  knowledgeVersion: string | null;
  skillsVersion: string | null;
  notes: string[];
  provenance: {
    source: "video-quality-review" | "manual" | "live-audit";
    renderJobId?: string;
    outputAssetId?: string;
  };
}

export interface KnowledgePattern {
  patternId: string;
  category: string;
  statement: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  applicability: string[];
  sourceEventIds: string[];
  sourceProjectCount: number;
  /** Abstract only — never includes customer/project private content */
  scope: "global-abstract" | "project";
  projectId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  promoted: boolean;
  refusalReason?: string;
}

export interface IntelligenceDecision {
  decisionId: string;
  projectId: string;
  decisionType: DecisionType;
  selectedSkillIds: string[];
  selectedAssetIds: string[];
  recommendedStructure: string[];
  motion: string | null;
  transition: "cut" | "fade";
  pacing: string | null;
  ctaStrategy: string | null;
  confidence: number;
  confidenceBand: ConfidenceBand;
  reasoningSource: "ai" | "deterministic";
  model: string | null;
  knowledgePatternIds: string[];
  videoKnowledgeIds: string[];
  clamped: string[];
  limitations: string[];
  createdAt: string;
  contextChars: number;
}

export interface CompactIntelligenceContext {
  projectId: string;
  productName: string;
  category?: string;
  audience?: string;
  durationSeconds?: number;
  cta?: string;
  energy?: string | null;
  bpm?: number | null;
  assetRoles: Array<{ assetId: string; viewRole?: string }>;
  topKnowledge: Array<{ id: string; rule: string; confidence: number }>;
  topSkills: Array<{ id: string; motion?: string | null; transition?: string | null }>;
  learnedPatterns: Array<{ patternId: string; statement: string; confidence: number }>;
  constraints: string[];
  charBudget: number;
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.55) return "MEDIUM";
  return "LOW";
}

export function mapTransitionSafe(raw: string | null | undefined): "cut" | "fade" {
  const t = String(raw ?? "cut").toLowerCase();
  return t.includes("fade") ? "fade" : "cut";
}
