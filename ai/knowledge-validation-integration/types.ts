/** AI Learning Step 2 — Knowledge Validation, Integration & Knowledge Foundation Update types. */

export const KNOWLEDGE_VALIDATION_INTEGRATION_VERSION = "1.0";

export type IntegrationDomainId =
  | "video-production"
  | "camera"
  | "lighting"
  | "composition"
  | "storytelling"
  | "marketing"
  | "branding"
  | "customer-psychology"
  | "video-editing"
  | "motion-graphics"
  | "rendering"
  | "social-media"
  | "product-photography"
  | "ai-video-production";

export type KnowledgeItemKind =
  | "concept"
  | "definition"
  | "best-practice"
  | "rule"
  | "workflow"
  | "example"
  | "recommendation"
  | "document";

export type KnowledgeDecisionStatus = "accepted" | "rejected" | "duplicate-reused";

export interface KnowledgeValidationScores {
  sourceTrustScore: number;
  authorityScore: number;
  technicalAccuracyScore: number;
  professionalAccuracyScore: number;
  relevanceScore: number;
  freshnessScore: number;
  completenessScore: number;
  consistencyScore: number;
  compositeScore: number;
}

export interface KnowledgeCandidateInput {
  id?: string;
  title: string;
  content: string;
  sourceId?: string;
  sourceName?: string;
  filePath?: string;
  sourceTrustScore?: number;
  authorityScore?: number;
  freshnessScore?: number;
  domainHint?: IntegrationDomainId | string;
  kindHint?: KnowledgeItemKind;
  metadata?: Record<string, string>;
}

export interface ValidatedKnowledgeItem {
  id: string;
  title: string;
  content: string;
  kind: KnowledgeItemKind;
  domainId: IntegrationDomainId;
  scores: KnowledgeValidationScores;
  status: KnowledgeDecisionStatus;
  decisionReason: string;
  sourceId?: string;
  sourceName?: string;
  filePath?: string;
  fingerprint: string;
  reusedExistingId?: string;
  version: number;
  acceptedAt?: string;
  rejectedAt?: string;
  metadata: Record<string, string>;
}

export interface ExtractedKnowledgeBundle {
  itemId: string;
  concepts: string[];
  definitions: string[];
  bestPractices: string[];
  rules: string[];
  workflows: string[];
  examples: string[];
  recommendations: string[];
  metadata: Record<string, string>;
}

export interface KnowledgePackUpdateRecord {
  packId: string;
  domainId: IntegrationDomainId;
  title: string;
  version: number;
  previousVersion: number | null;
  itemIds: string[];
  created: boolean;
  updatedAt: string;
  versionHistoryPath: string;
}

export interface KnowledgeGraphUpdateRecord {
  nodeId: string;
  label: string;
  domainId: IntegrationDomainId;
  relatedNodeIds: string[];
  updatedAt: string;
}

export interface KnowledgeSearchIndexUpdateRecord {
  entryId: string;
  itemId: string;
  domainId: IntegrationDomainId;
  terms: string[];
  updatedAt: string;
}

export interface KnowledgeVersionHistoryEntry {
  itemId: string;
  version: number;
  at: string;
  action: "created" | "updated" | "rejected" | "duplicate-reused";
  snapshotPath: string;
  detail: string;
}

export interface KnowledgeValidationIntegrationResult {
  runId: string;
  version: typeof KNOWLEDGE_VALIDATION_INTEGRATION_VERSION;
  processedAt: string;
  accepted: ValidatedKnowledgeItem[];
  rejected: ValidatedKnowledgeItem[];
  duplicatesReused: ValidatedKnowledgeItem[];
  extractions: ExtractedKnowledgeBundle[];
  packsUpdated: KnowledgePackUpdateRecord[];
  graphUpdated: KnowledgeGraphUpdateRecord[];
  searchIndexUpdated: KnowledgeSearchIndexUpdateRecord[];
  versionHistoryUpdated: KnowledgeVersionHistoryEntry[];
  issuesFound: string[];
  issuesRepaired: string[];
  knowledgeFoundationOverwrite: false;
  evolutionDeferred: true;
  summary: string;
}

export interface AiMeKnowledgeValidationIntegrationAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainAcceptance: boolean;
  canExplainRejection: boolean;
  canShowSourceConfidence: boolean;
  canShowVersionHistory: boolean;
  canSearchImportedKnowledge: boolean;
  knowledgeEvolutionDeferred: true;
  summary: string;
}

export interface KnowledgeValidationIntegrationExplainResult {
  itemId: string;
  status: KnowledgeDecisionStatus;
  explanation: string;
  confidence: number;
  scores?: KnowledgeValidationScores;
  versionHistory: KnowledgeVersionHistoryEntry[];
}

export interface KnowledgeValidationIntegrationHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface KnowledgeValidationIntegrationReportData {
  generatedAt: string;
  existingValidationCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  knowledgeAccepted: Array<{ id: string; title: string; domainId: string; score: number }>;
  knowledgeRejected: Array<{ id: string; title: string; reason: string }>;
  duplicateKnowledgeRemoved: Array<{ id: string; title: string; reusedExistingId?: string }>;
  knowledgePacksUpdated: Array<{ packId: string; domainId: string; version: number }>;
  knowledgeGraphUpdated: boolean;
  searchIndexUpdated: boolean;
  versionHistoryUpdated: boolean;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep3: string[];
}

export interface KnowledgeValidationIntegrationStore {
  items: ValidatedKnowledgeItem[];
  packs: KnowledgePackUpdateRecord[];
  graph: KnowledgeGraphUpdateRecord[];
  searchIndex: KnowledgeSearchIndexUpdateRecord[];
  versionHistory: KnowledgeVersionHistoryEntry[];
  runs: KnowledgeValidationIntegrationResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
