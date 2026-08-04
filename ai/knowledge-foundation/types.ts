/**
 * KWIZERA AI STUDIO — Knowledge Foundation types (Step 4A)
 */

export enum KnowledgeLifecycleState {
  Initializing = "initializing",
  Loading = "loading",
  Ready = "ready",
  Reading = "reading",
  Writing = "writing",
  Updating = "updating",
  Validating = "validating",
  Optimizing = "optimizing",
  Recovering = "recovering",
  Closing = "closing",
  Closed = "closed",
}

export enum KnowledgeCategory {
  Product = "product-knowledge",
  Image = "image-knowledge",
  Video = "video-knowledge",
  Marketing = "marketing-knowledge",
  Brand = "brand-knowledge",
  Language = "language-knowledge",
  Creative = "creative-knowledge",
  Optimization = "knowledge-optimization",
  Validation = "knowledge-validation",
  HealthMonitoring = "knowledge-health-monitor",
  Technical = "technical-knowledge",
  Workflow = "workflow-knowledge",
  Business = "business-knowledge",
  UserPreference = "user-preference-knowledge",
  Industry = "industry-knowledge",
  Custom = "custom-knowledge",
}

export enum KnowledgeModuleStatus {
  Prepared = "prepared",
  Registered = "registered",
  Active = "active",
  Disabled = "disabled",
  Validating = "validating",
  Recovering = "recovering",
  Failed = "failed",
}

export enum KnowledgeHealthLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum KnowledgeSource {
  MemoryEngine = "memory-engine",
  LearningEngine = "learning-engine",
  Project = "project",
  Product = "product",
  Video = "video",
  MarketingCampaign = "marketing-campaign",
  UserPreference = "user-preference",
  ReasoningHistory = "reasoning-history",
  DecisionHistory = "decision-history",
  KnowledgeModule = "knowledge-module",
  Manual = "manual",
  System = "system",
}

export enum KnowledgeVerificationStatus {
  Unverified = "unverified",
  Pending = "pending",
  Verified = "verified",
  Rejected = "rejected",
  Archived = "archived",
}

export enum KnowledgeAccessPermission {
  Read = "read",
  Write = "write",
  Update = "update",
  Delete = "delete",
  Validate = "validate",
  Admin = "admin",
}

export enum KnowledgeAccessOperation {
  Read = "read",
  Write = "write",
  Update = "update",
  Delete = "delete",
  Validate = "validate",
  Query = "query",
}

export interface KnowledgeVersionEntry {
  version: number;
  timestamp: string;
  changeSummary: string;
  source: KnowledgeSource;
}

export interface KnowledgeQualityMetadata {
  qualityScore: number;
  confidenceScore: number;
  verificationStatus: KnowledgeVerificationStatus;
  source: KnowledgeSource;
  sourceRef?: string;
  versionHistory: KnowledgeVersionEntry[];
  relationshipLinks: string[];
  lastValidated?: string;
}

export interface KnowledgeModuleRegistration {
  knowledgeId: string;
  knowledgeName: string;
  version: string;
  status: KnowledgeModuleStatus;
  dependencies: string[];
  source: KnowledgeSource;
  qualityScore: number;
  confidenceScore: number;
  healthStatus: KnowledgeHealthLevel;
  lastUpdate: string;
  accessPermissions: KnowledgeAccessPermission[];
  category: KnowledgeCategory;
  storageLocation: string;
  implemented: boolean;
}

export interface KnowledgeDomainInstallation {
  knowledgeId: string;
  knowledgeName: string;
  subdirectory: string;
  dependencies?: string[];
  source?: KnowledgeSource;
  accessPermissions?: KnowledgeAccessPermission[];
}

export interface KnowledgeRegistrySnapshot {
  foundationVersion: string;
  storageRoot: string;
  lastUpdated: string;
  modules: KnowledgeModuleRegistration[];
}

export interface KnowledgeIntegrityResult {
  verified: boolean;
  checkedPaths: number;
  issues: string[];
  checksumVerified: boolean;
  timestamp: string;
}

export interface KnowledgeAccessRequest {
  requesterId: string;
  category: KnowledgeCategory;
  operation: KnowledgeAccessOperation;
  resourceId?: string;
}

export interface KnowledgeAccessResult {
  granted: boolean;
  operation: KnowledgeAccessOperation;
  category: KnowledgeCategory;
  storagePath: string;
  durationMs: number;
  message: string;
}

export interface KnowledgeValidationResult {
  valid: boolean;
  qualityScore: number;
  confidenceScore: number;
  verificationStatus: KnowledgeVerificationStatus;
  issues: string[];
  recommendations: string[];
  durationMs: number;
}

export interface KnowledgeHealthReport {
  level: KnowledgeHealthLevel;
  score: number;
  availability: boolean;
  registryHealth: boolean;
  storageIntegrity: boolean;
  qualityValidation: boolean;
  integrationReady: boolean;
  readPerformanceMs: number;
  writePerformanceMs: number;
  issues: string[];
  timestamp: string;
}

export interface KnowledgeIntegrationStatus {
  aiCore: boolean;
  memoryEngine: boolean;
  decisionEngine: boolean;
  reasoningEngine: boolean;
  planningEngine: boolean;
  workflowEngine: boolean;
  communicationBus: boolean;
  stateManager: boolean;
  recoveryEngine: boolean;
  healthMonitor: boolean;
  readyCount: number;
  totalCount: number;
}

export interface KnowledgeFoundationStatusReport {
  foundationStatus: string;
  lifecycleState: KnowledgeLifecycleState;
  registryStatus: string;
  storageStatus: string;
  persistenceStatus: string;
  integrityStatus: string;
  healthLevel: KnowledgeHealthLevel;
  integrationStatus: KnowledgeIntegrationStatus;
  registeredModules: number;
  preparedCategories: number;
  performance: {
    startupMs: number;
    averageReadMs: number;
    averageWriteMs: number;
    averageValidationMs: number;
    totalAccessRequests: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class KnowledgeFoundationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "KnowledgeFoundationError";
  }
}
