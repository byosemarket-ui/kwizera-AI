/**
 * KWIZERA AI STUDIO — Product Intelligence Foundation types (Step 5A)
 */

export enum ProductIntelligenceLifecycleState {
  Initializing = "initializing",
  Loading = "loading",
  Ready = "ready",
  Analyzing = "analyzing",
  Planning = "planning",
  Validating = "validating",
  Optimizing = "optimizing",
  Recovering = "recovering",
  Closing = "closing",
  Closed = "closed",
}

export enum ProductIntelligenceCategory {
  ProductAnalysis = "product-analysis",
  ProductUnderstanding = "product-understanding",
  AudienceIntelligence = "audience-intelligence",
  MarketingStrategy = "marketing-strategy-intelligence",
  CreativeDirection = "creative-direction",
  StoryboardIntelligence = "storyboard-intelligence",
  ScriptPlanning = "script-planning",
  VisualPlanning = "visual-planning",
  AudioPlanning = "audio-planning",
  ProductionPlanning = "production-planning",
  QualityPrediction = "quality-prediction",
  Optimization = "product-intelligence-optimization",
  HealthMonitoring = "product-intelligence-health-monitor",
}

export enum ProductIntelligenceModuleStatus {
  Prepared = "prepared",
  Registered = "registered",
  Active = "active",
  Disabled = "disabled",
  Validating = "validating",
  Recovering = "recovering",
  Failed = "failed",
}

export enum ProductIntelligenceHealthLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum ProductIntelligenceSource {
  MemoryEngine = "memory-engine",
  KnowledgeEngine = "knowledge-engine",
  ProductKnowledge = "product-knowledge",
  BrandKnowledge = "brand-knowledge",
  MarketingKnowledge = "marketing-knowledge",
  UserInput = "user-input",
  System = "system",
  Manual = "manual",
}

export enum ProductIntelligenceVerificationStatus {
  Unverified = "unverified",
  Pending = "pending",
  Verified = "verified",
  Rejected = "rejected",
  Archived = "archived",
}

export enum ProductIntelligenceAccessPermission {
  Read = "read",
  Write = "write",
  Update = "update",
  Delete = "delete",
  Validate = "validate",
  Admin = "admin",
}

export enum ProductIntelligenceAccessOperation {
  Read = "read",
  Write = "write",
  Update = "update",
  Delete = "delete",
  Validate = "validate",
  Query = "query",
}

export interface ProductIntelligenceVersionEntry {
  version: number;
  timestamp: string;
  changeSummary: string;
  source: ProductIntelligenceSource;
}

export interface ProductIntelligenceQualityMetadata {
  qualityScore: number;
  confidenceScore: number;
  verificationStatus: ProductIntelligenceVerificationStatus;
  source: ProductIntelligenceSource;
  sourceRef?: string;
  versionHistory: ProductIntelligenceVersionEntry[];
  relationshipLinks: string[];
  healthStatus: ProductIntelligenceHealthLevel;
  lastValidated?: string;
}

export interface ProductIntelligenceModuleRegistration {
  moduleId: string;
  moduleName: string;
  version: string;
  status: ProductIntelligenceModuleStatus;
  dependencies: string[];
  qualityScore: number;
  confidenceScore: number;
  healthStatus: ProductIntelligenceHealthLevel;
  createdAt: string;
  lastUpdated: string;
  accessPermissions: ProductIntelligenceAccessPermission[];
  category: ProductIntelligenceCategory;
  storageLocation: string;
  implemented: boolean;
}

export interface ProductIntelligenceRegistrySnapshot {
  foundationVersion: string;
  storageRoot: string;
  lastUpdated: string;
  modules: ProductIntelligenceModuleRegistration[];
}

export interface ProductIntelligenceIntegrityResult {
  verified: boolean;
  checkedPaths: number;
  issues: string[];
  checksumVerified: boolean;
  timestamp: string;
}

export interface ProductIntelligenceAccessRequest {
  requesterId: string;
  category: ProductIntelligenceCategory;
  operation: ProductIntelligenceAccessOperation;
  resourceId?: string;
}

export interface ProductIntelligenceAccessResult {
  granted: boolean;
  operation: ProductIntelligenceAccessOperation;
  category: ProductIntelligenceCategory;
  storagePath: string;
  durationMs: number;
  message: string;
}

export interface ProductIntelligenceValidationResult {
  valid: boolean;
  qualityScore: number;
  confidenceScore: number;
  verificationStatus: ProductIntelligenceVerificationStatus;
  issues: string[];
  recommendations: string[];
  durationMs: number;
}

export interface ProductIntelligenceHealthReport {
  level: ProductIntelligenceHealthLevel;
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

export interface ProductIntelligenceIntegrationStatus {
  aiCore: boolean;
  memoryEngine: boolean;
  knowledgeEngine: boolean;
  reasoningEngine: boolean;
  planningEngine: boolean;
  decisionEngine: boolean;
  workflowEngine: boolean;
  stateManager: boolean;
  recoveryEngine: boolean;
  healthMonitor: boolean;
  readyCount: number;
  totalCount: number;
}

export interface ProductIntelligenceFoundationStatusReport {
  foundationStatus: string;
  lifecycleState: ProductIntelligenceLifecycleState;
  registryStatus: string;
  storageStatus: string;
  persistenceStatus: string;
  integrityStatus: string;
  healthLevel: ProductIntelligenceHealthLevel;
  integrationStatus: ProductIntelligenceIntegrationStatus;
  registeredModules: number;
  preparedModules: number;
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

export class ProductIntelligenceFoundationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ProductIntelligenceFoundationError";
  }
}
