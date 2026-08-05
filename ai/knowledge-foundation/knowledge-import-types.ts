/**
 * Knowledge Pack Import types (Knowledge Seeding Step 7).
 * Imports certified packs into the permanent Knowledge Foundation and activates the ecosystem.
 */

import type { KnowledgePackSlug } from "../knowledge-processing-engine/knowledge-extraction-types.js";

export type KnowledgeImportStatus = "imported" | "activated" | "duplicate" | "skipped" | "failed";

export interface KnowledgeImportResult {
  importId: string;
  packSlug: KnowledgePackSlug;
  packId: string;
  knowledgeId: string | null;
  status: KnowledgeImportStatus;
  issues: string[];
  activatedEngines: string[];
  importedAt: string;
}

export interface KnowledgeActivationStatus {
  foundationReady: boolean;
  indexUpdated: boolean;
  graphUpdated: boolean;
  searchReady: boolean;
  reasoningReady: boolean;
  decisionReady: boolean;
  workflowReady: boolean;
  planningReady: boolean;
  memorySynced: boolean;
  domainsContentReady: string[];
  importedCount: number;
  activatedCount: number;
}

export interface KnowledgeEngineIntegrationStatus {
  aiMe: boolean;
  planning: boolean;
  decision: boolean;
  workflow: boolean;
  productIntelligence: boolean;
  marketingIntelligence: boolean;
  imageGeneration: boolean;
  videoGeneration: boolean;
  rendering: boolean;
  storyboard: boolean;
  camera: boolean;
  lighting: boolean;
  animation: boolean;
  motion: boolean;
  summary: string;
}

export interface AiMeKnowledgeImportAwareness {
  importedPacks: number;
  activatedPacks: number;
  knowledgeIds: string[];
  canFind: boolean;
  canExplain: boolean;
  canApply: boolean;
  canRecommend: boolean;
  canUseInPlanning: boolean;
  canUseInImageGeneration: boolean;
  canUseInVideoGeneration: boolean;
  activation: KnowledgeActivationStatus;
  engines: KnowledgeEngineIntegrationStatus;
  summary: string;
}

export interface KnowledgeImportHealthReport {
  healthy: boolean;
  missingCertifiedPacks: string[];
  brokenRelationships: string[];
  invalidMetadata: string[];
  brokenIndexes: string[];
  synchronizationFailures: string[];
  repairs: string[];
}

export interface KnowledgeImportRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface KnowledgeImportReportData {
  generatedAt: string;
  existingImportSystem: string[];
  componentsUpgraded: string[];
  componentsCreated: string[];
  packsImported: Array<{ packSlug: string; knowledgeId: string | null; status: string }>;
  foundationStatus: string;
  graphStatus: string;
  aiMeIntegrationStatus: string;
  planningIntegrationStatus: string;
  decisionIntegrationStatus: string;
  workflowIntegrationStatus: string;
  imageGenerationIntegrationStatus: string;
  videoGenerationIntegrationStatus: string;
  renderingIntegrationStatus: string;
  synchronizationStatus: string;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingWorkBeforeStep8: string[];
}

export class KnowledgeImportError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "KnowledgeImportError";
  }
}
