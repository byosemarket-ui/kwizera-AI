/** AI Learning Step 6 — Autonomous Learning & Intelligent Knowledge Expansion types. */

export const AUTONOMOUS_LEARNING_VERSION = "1.0";

export type LearningDomainId =
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
  | "rendering"
  | "social-media"
  | "ai-video-production"
  | "product-marketing";

export type LearningPriorityFocus =
  | "production-quality"
  | "rendering-quality"
  | "marketing-quality"
  | "product-presentation"
  | "workflow-efficiency"
  | "ai-reasoning";

export type LearningOrigin =
  | "online-trusted-source"
  | "updated-documentation"
  | "professional-technique"
  | "workflow"
  | "ai-technology"
  | "marketing-strategy"
  | "previous-project"
  | "previous-decision"
  | "previous-recommendation"
  | "previous-feedback"
  | "previous-production-result"
  | "validated-online-knowledge";

export interface AutonomousLearningCandidate {
  id?: string;
  title: string;
  content: string;
  domainId: LearningDomainId | string;
  origin: LearningOrigin;
  sourceLabel: string;
  verified: boolean;
  focus?: LearningPriorityFocus[];
  expandsExistingPackId?: string;
}

export interface DiscoveredKnowledgeItem {
  id: string;
  title: string;
  domainId: LearningDomainId;
  origin: LearningOrigin;
  sourceLabel: string;
  priorityScore: number;
  focus: LearningPriorityFocus[];
  discoveredAt: string;
  accepted: boolean;
  rejectionReason?: string;
}

export interface ImpactAnalysis {
  candidateId: string;
  modulesImproved: string[];
  workflowsImproved: string[];
  recommendationsImproved: string[];
  planningLogicImproved: string[];
  breakingChangeRisk: false;
  safeToImport: boolean;
  rationale: string;
}

export interface KnowledgePackExpansion {
  packId: string;
  domainId: LearningDomainId;
  title: string;
  action: "created" | "expanded";
  version: number;
  previousVersionPreserved: true;
  itemId: string;
}

export interface KnowledgeGraphExpansion {
  nodeId: string;
  domainId: LearningDomainId;
  relatedTo: string[];
  metadataKeys: string[];
}

export interface SearchIndexExpansion {
  entryId: string;
  terms: string[];
  packId: string;
}

export interface VersionHistoryEntry {
  itemId: string;
  packId: string;
  version: number;
  previousVersion: number | null;
  action: "created" | "expanded";
  at: string;
}

export interface SelfLearningSignal {
  kind: LearningOrigin;
  summary: string;
  domainId: LearningDomainId;
  weight: number;
}

export interface AutonomousLearningResult {
  runId: string;
  version: typeof AUTONOMOUS_LEARNING_VERSION;
  processedAt: string;
  onlineAvailable: boolean;
  offlineCompatible: true;
  discovered: DiscoveredKnowledgeItem[];
  rejectedUnrelated: string[];
  rejectedUnverified: string[];
  selfLearningApplied: SelfLearningSignal[];
  composition: AutonomousLearningComposition;
  impactAnalyses: ImpactAnalysis[];
  packsExpanded: KnowledgePackExpansion[];
  graphExpanded: KnowledgeGraphExpansion[];
  relationshipsExpanded: number;
  metadataExpanded: number;
  searchIndexExpanded: SearchIndexExpansion[];
  versionHistory: VersionHistoryEntry[];
  previousKnowledgePreserved: true;
  userPreferencesPreserved: true;
  projectHistoryPreserved: true;
  issuesFound: string[];
  issuesRepaired: string[];
  workflowModelOptimizationDeferred: false;
  summary: string;
}

export interface AutonomousLearningComposition {
  feedbackSignalsUsed: number;
  performanceSignalsUsed: number;
  defaultSignalsUsed: number;
  evolutionBridgeAttempted: number;
  evolutionBridgeAccepted: number;
  depsWired: {
    feedback: boolean;
    performance: boolean;
    evolution: boolean;
  };
}

export interface AiMeAutonomousLearningAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canExplainNewlyLearned: boolean;
  canExplainSource: boolean;
  canExplainValue: boolean;
  canRecommendNewKnowledge: boolean;
  workflowModelOptimizationDeferred: false;
  summary: string;
}

export interface AutonomousLearningExplainResult {
  itemId?: string;
  whatWasLearned: string;
  whereItCameFrom: string;
  whyValuable: string;
  recommendUse: boolean;
  recommendUseReason: string;
}

export interface AutonomousLearningHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface AutonomousLearningReportData {
  generatedAt: string;
  existingLearningCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  newKnowledgeDiscovered: Array<{ id: string; title: string; domainId: string }>;
  knowledgePacksExpanded: Array<{ packId: string; action: string; version: number }>;
  knowledgeGraphExpanded: string;
  versionHistoryStatus: string;
  offlineCompatibility: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep7: string[];
}

export interface AutonomousLearningStore {
  discoveries: DiscoveredKnowledgeItem[];
  packs: KnowledgePackExpansion[];
  graph: KnowledgeGraphExpansion[];
  searchIndex: SearchIndexExpansion[];
  versions: VersionHistoryEntry[];
  selfSignals: SelfLearningSignal[];
  runs: AutonomousLearningResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

export interface AutonomousLearningCycleOptions {
  isOnline?: () => boolean;
  candidates?: AutonomousLearningCandidate[];
  selfSignals?: SelfLearningSignal[];
  maxImports?: number;
}

/** Structural ports — avoid importing sibling engines (keeps offline validate cold-start light). */
export interface AutonomousLearningFeedbackPort {
  getLearningMemory(): Array<{ topics: string[]; lesson: string }>;
  getPreferenceProfile(): { evolutionNotes: string[] };
}

export interface AutonomousLearningPerformancePort {
  getSessions(): Array<{
    bottlenecks: Array<{ kind: string; module: string; detail: string; severity: string }>;
    optimizations: Array<{ recommendation: string }>;
  }>;
}

export interface AutonomousLearningEvolutionPort {
  isStartupComplete(): boolean;
  evolve(candidates: Array<{
    title: string;
    content: string;
    domainId: string;
    verified: boolean;
    changeKindHint?: string;
  }>): Promise<{
    newKnowledgeAdded: unknown[];
    updatedPacks: unknown[];
  }>;
}

export interface AutonomousLearningDependencies {
  feedback?: AutonomousLearningFeedbackPort | null;
  performance?: AutonomousLearningPerformancePort | null;
  evolution?: AutonomousLearningEvolutionPort | null;
}
