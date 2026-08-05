/**
 * Knowledge Seeding certification types (Step 8 — final Knowledge Seeding gate).
 */

export const KNOWLEDGE_SEEDING_VERSION = "1.0.0";

export interface KnowledgePersistenceCheck {
  name: string;
  passed: boolean;
  detail: string;
  diskPath?: string;
}

export interface KnowledgePersistenceVerificationResult {
  verified: boolean;
  checks: KnowledgePersistenceCheck[];
  issues: string[];
  repairs: string[];
  verifiedAt: string;
}

export interface KnowledgeRestartVerificationResult {
  verified: boolean;
  packsBefore: number;
  packsAfter: number;
  importsBefore: number;
  importsAfter: number;
  recordsBefore: number;
  recordsAfter: number;
  relationshipsBefore: number;
  relationshipsAfter: number;
  searchWorksAfterRestart: boolean;
  metadataPreserved: boolean;
  issues: string[];
  verifiedAt: string;
}

export interface KnowledgeSeedingStatistics {
  totalKnowledgeDomains: number;
  totalKnowledgePacks: number;
  totalKnowledgeItems: number;
  totalRelationships: number;
  totalDecisionRules: number;
  totalWorkflows: number;
  totalExamples: number;
  totalSources: number;
  totalDocuments: number;
  totalMetadataEntries: number;
  totalImportedPacks: number;
  totalCertifiedPacks: number;
}

export interface AiMeKnowledgePersistenceAwareness {
  canFind: boolean;
  canExplain: boolean;
  canUse: boolean;
  canCompare: boolean;
  canApplyDecisionRules: boolean;
  canUseInPlanning: boolean;
  canUseInImageGeneration: boolean;
  canUseInVideoGeneration: boolean;
  canUseInRendering: boolean;
  permanentlyRemembers: boolean;
  immediatelyUsable: boolean;
  summary: string;
}

export interface KnowledgeSeedingCertificationResult {
  certified: boolean;
  version: string;
  certifiedAt: string;
  foundationStatus: string;
  persistenceStatus: string;
  restartVerified: boolean;
  aiMeCapable: boolean;
  graphConsistent: boolean;
  searchConsistent: boolean;
  statistics: KnowledgeSeedingStatistics;
  maturity: string;
  permanentlyRemembers: boolean;
  immediatelyUsesImportedKnowledge: boolean;
  knowledgeSeedingComplete: boolean;
  issues: string[];
  repairs: string[];
  certificatePath: string | null;
}

export interface KnowledgeSeedingRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface KnowledgeSeedingReportData {
  generatedAt: string;
  foundationStatus: string;
  persistenceStatus: string;
  restartVerification: KnowledgeRestartVerificationResult | null;
  aiMeCapability: AiMeKnowledgePersistenceAwareness;
  graphStatus: string;
  searchStatus: string;
  statistics: KnowledgeSeedingStatistics;
  issuesFound: string[];
  issuesRepaired: string[];
  maturity: string;
  permanentlyRemembers: boolean;
  immediatelyUsesImportedKnowledge: boolean;
  knowledgeSeedingComplete: boolean;
  certifiedVersion: string | null;
}

export class KnowledgeSeedingError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "KnowledgeSeedingError";
  }
}
