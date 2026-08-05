/**
 * Knowledge Extraction & Pack Generation types (Knowledge Seeding Step 5).
 * Extracts professional knowledge into packs — does not run Knowledge Validation (Step 6).
 */

import type { StructuredKnowledge } from "./knowledge-processing-engine.js";

export type KnowledgePackSlug =
  | "camera"
  | "camera-movement"
  | "lighting"
  | "composition"
  | "product-photography"
  | "video-production"
  | "storytelling"
  | "scene"
  | "animation"
  | "motion"
  | "rendering"
  | "editing"
  | "marketing"
  | "branding"
  | "customer-psychology"
  | "sales-psychology"
  | "color-theory"
  | "typography"
  | "social-media"
  | "general";

export type KnowledgePackStatus =
  | "draft"
  | "generated"
  | "duplicate"
  | "weak"
  | "superseded"
  | "validated"
  | "certified"
  | "rejected"
  | "imported";

export interface KnowledgeSourceMetadata {
  name: string;
  type: string;
  reference?: string;
  reliability: number;
  resourceId?: string;
  understandingId?: string;
  checksumSha256?: string | null;
}

/** Normalized professional knowledge item required by Step 5. */
export interface KnowledgeItem {
  knowledgeId: string;
  title: string;
  domain: string;
  category: string;
  description: string;
  coreConcepts: string[];
  definitions: string[];
  rules: string[];
  bestPractices: string[];
  professionalTechniques: string[];
  workflow: string[];
  decisionRules: string[];
  commonMistakes: string[];
  troubleshooting: string[];
  recommendations: string[];
  examples: string[];
  professionalStandards: string[];
  relatedTopics: string[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  sourceMetadata: KnowledgeSourceMetadata[];
  version: number;
}

export interface KnowledgeExtractionDraft {
  packSlug: KnowledgePackSlug;
  domain: string;
  title: string;
  category: string;
  description: string;
  coreConcepts: string[];
  definitions: string[];
  rules: string[];
  bestPractices: string[];
  professionalTechniques: string[];
  workflow: string[];
  decisionRules: string[];
  commonMistakes: string[];
  troubleshooting: string[];
  recommendations: string[];
  examples: string[];
  professionalStandards: string[];
  relatedTopics: string[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  sourceMetadata: KnowledgeSourceMetadata[];
  issues: string[];
  improved: boolean;
}

export interface KnowledgePack {
  packId: string;
  packSlug: KnowledgePackSlug;
  domain: string;
  title: string;
  version: number;
  status: KnowledgePackStatus;
  items: KnowledgeItem[];
  structuredKnowledge: StructuredKnowledge;
  resourceIds: string[];
  understandingIds: string[];
  contentFingerprint: string;
  createdAt: string;
  updatedAt: string;
  originalDocumentsPreserved: true;
  foundationKnowledgeId?: string;
  importedAt?: string;
  importKnowledgeId?: string;
  issues: string[];
}

export interface KnowledgeExtractionResult {
  extractionId: string;
  resourceId: string;
  understandingId: string;
  packSlug: KnowledgePackSlug;
  packId: string | null;
  status: "extracted" | "merged" | "duplicate" | "weak" | "failed";
  knowledgeItem: KnowledgeItem | null;
  confidenceScore: number;
  qualityScore: number;
  issues: string[];
  originalPreserved: true;
}

export interface AiMeKnowledgePackAwareness {
  totalPacks: number;
  totalItems: number;
  packsByDomain: Record<string, number>;
  averageConfidence: number;
  averageQuality: number;
  topWorkflows: string[];
  topBestPractices: string[];
  topDecisionRules: string[];
  relationships: string[];
  summary: string;
}

export interface KnowledgeExtractionRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface KnowledgeExtractionReportData {
  generatedAt: string;
  existingExtractionCapability: string[];
  componentsUpgraded: string[];
  componentsCreated: string[];
  knowledgeExtracted: Array<{ resourceId: string; title: string; packSlug: string; status: string }>;
  knowledgePacksGenerated: Array<{ packId: string; packSlug: string; version: number; items: number }>;
  knowledgeQuality: { averageQuality: number; weakPacks: number; duplicatesBlocked: number };
  confidenceScores: { average: number; min: number; max: number };
  aiMeIntegration: string;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingWorkBeforeStep6: string[];
}

export class KnowledgeExtractionError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "KnowledgeExtractionError";
  }
}

export const PREPARED_PACK_SLUGS: KnowledgePackSlug[] = [
  "camera",
  "camera-movement",
  "lighting",
  "composition",
  "product-photography",
  "video-production",
  "storytelling",
  "scene",
  "animation",
  "motion",
  "rendering",
  "editing",
  "marketing",
  "branding",
  "customer-psychology",
  "sales-psychology",
  "color-theory",
  "typography",
  "social-media",
  "general",
];
