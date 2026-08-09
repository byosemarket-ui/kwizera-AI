/** AI Learning Step 3 — Knowledge Evolution & Continuous Update types. */

export const KNOWLEDGE_EVOLUTION_VERSION = "1.0";

export type EvolutionDomainId =
  | "video-production"
  | "product-photography"
  | "camera"
  | "camera-movement"
  | "lighting"
  | "composition"
  | "storytelling"
  | "marketing"
  | "branding"
  | "customer-psychology"
  | "sales-psychology"
  | "video-editing"
  | "motion-graphics"
  | "animation"
  | "rendering"
  | "social-media"
  | "ai-video-production";

export type KnowledgeChangeKind =
  | "new-technique"
  | "updated-best-practice"
  | "updated-standard"
  | "updated-documentation"
  | "updated-api"
  | "updated-workflow"
  | "new-marketing-trend"
  | "new-production-technology"
  | "general-update";

export type KnowledgeComparisonClass = "new" | "updated" | "obsolete" | "deprecated" | "unchanged";

export interface EvolutionCandidateInput {
  id?: string;
  title: string;
  content: string;
  domainId?: EvolutionDomainId | string;
  changeKindHint?: KnowledgeChangeKind;
  verified?: boolean;
  sourceId?: string;
  sourceName?: string;
  replacesTitle?: string;
  deprecatesTitle?: string;
  metadata?: Record<string, string>;
}

export interface MonitoredKnowledgeSnapshot {
  id: string;
  title: string;
  content: string;
  domainId: EvolutionDomainId;
  version: number;
  fingerprint: string;
  status: "active" | "obsolete" | "deprecated";
  createdAt: string;
  updatedAt: string;
  changeHistory: string[];
}

export interface DetectedKnowledgeUpdate {
  detectionId: string;
  domainId: EvolutionDomainId;
  changeKind: KnowledgeChangeKind;
  title: string;
  summary: string;
  detectedAt: string;
  candidateId?: string;
}

export interface KnowledgeComparisonResult {
  comparisonId: string;
  classification: KnowledgeComparisonClass;
  existingId?: string;
  existingTitle?: string;
  existingVersion?: number;
  candidateTitle: string;
  domainId: EvolutionDomainId;
  changeKind: KnowledgeChangeKind;
  diffSummary: string;
  recommendLatest: boolean;
  reason: string;
}

export interface KnowledgeImpactAnalysis {
  itemId: string;
  title: string;
  affectsAiMe: boolean;
  affectsPlanning: boolean;
  affectsReasoning: boolean;
  affectsWorkflows: boolean;
  affectsRecommendations: boolean;
  affectsStoryboards: boolean;
  affectsVideoProduction: boolean;
  affectsRendering: boolean;
  summary: string;
  score: number;
}

export interface EvolutionVersionRecord {
  itemId: string;
  version: number;
  previousVersion: number | null;
  snapshotPath: string;
  at: string;
  action: "created" | "updated" | "deprecated" | "marked-obsolete";
  detail: string;
}

export interface KnowledgeEvolutionResult {
  runId: string;
  version: typeof KNOWLEDGE_EVOLUTION_VERSION;
  processedAt: string;
  monitoredDomains: EvolutionDomainId[];
  updatesDetected: DetectedKnowledgeUpdate[];
  comparisons: KnowledgeComparisonResult[];
  newKnowledgeAdded: Array<{ id: string; title: string; domainId: EvolutionDomainId; version: number }>;
  updatedPacks: Array<{ domainId: EvolutionDomainId; itemId: string; version: number }>;
  deprecatedKnowledge: Array<{ id: string; title: string; reason: string }>;
  obsoleteKnowledge: Array<{ id: string; title: string; reason: string }>;
  versionHistory: EvolutionVersionRecord[];
  graphUpdated: boolean;
  searchIndexUpdated: boolean;
  impacts: KnowledgeImpactAnalysis[];
  issuesFound: string[];
  issuesRepaired: string[];
  previousVersionsPreserved: true;
  feedbackIntelligenceDeferred: false;
  summary: string;
}

export interface AiMeKnowledgeEvolutionAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainWhatChanged: boolean;
  canExplainWhyUpdated: boolean;
  canCompareOldAndNew: boolean;
  canRecommendLatestVersion: boolean;
  feedbackIntelligenceDeferred: false;
  summary: string;
}

export interface KnowledgeEvolutionExplainResult {
  itemId: string;
  whatChanged: string;
  whyUpdated: string;
  comparison: string;
  recommendLatest: boolean;
  impactSummary: string;
  versions: EvolutionVersionRecord[];
}

export interface KnowledgeEvolutionHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface KnowledgeEvolutionReportData {
  generatedAt: string;
  existingEvolutionCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  knowledgeUpdatesDetected: Array<{ title: string; changeKind: string; domainId: string }>;
  newKnowledgeAdded: Array<{ title: string; domainId: string; version: number }>;
  updatedKnowledgePacks: Array<{ domainId: string; itemId: string; version: number }>;
  deprecatedKnowledgeIdentified: Array<{ title: string; reason: string }>;
  versionHistoryStatus: string;
  knowledgeGraphStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep4: string[];
}

export interface KnowledgeEvolutionStore {
  snapshots: MonitoredKnowledgeSnapshot[];
  detections: DetectedKnowledgeUpdate[];
  versions: EvolutionVersionRecord[];
  graphEdges: Array<{ fromId: string; toId: string; relation: string; at: string }>;
  searchIndex: Array<{ itemId: string; terms: string[]; at: string }>;
  runs: KnowledgeEvolutionResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
