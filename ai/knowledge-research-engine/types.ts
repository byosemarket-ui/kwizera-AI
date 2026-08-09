import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";

export type ResearchDomainPriority = "high" | "medium" | "low";

export interface ResearchDomain {
  domain: string;
  description: string;
  priority: ResearchDomainPriority;
  sourceTypes: KnowledgeAcquisitionSourceType[];
  professionalDomainId?: string;
  workspaceDomainId?: string;
  discoveryKinds?: string[];
}

export type ResearchTaskStatus = "pending" | "in-progress" | "completed" | "skipped";

export interface ResearchTask {
  id: string;
  domain: string;
  description: string;
  sourceTypes: KnowledgeAcquisitionSourceType[];
  priority: ResearchDomainPriority;
  status: ResearchTaskStatus;
}

export interface ResearchPlan {
  id: string;
  topic: string;
  createdAt: string;
  domains: ResearchDomain[];
  tasks: ResearchTask[];
  estimatedSourceCount: number;
  constrainedToProfessionalDomains?: boolean;
}

export interface RankedSourceCandidate {
  sourceId: string;
  name: string;
  type: KnowledgeAcquisitionSourceType;
  trustScore: number;
  qualityScore: number;
  authorityScore: number;
  freshnessScore: number;
  relevanceScore: number;
  completenessScore: number;
  compositeScore: number;
  accepted: boolean;
  rejectionReason?: string;
}

export interface ResearchPreview {
  planId: string;
  topic: string;
  trustedSourceCategories: string[];
  estimatedDownloads: number;
  estimatedKnowledgeCoveragePercent: number;
  estimatedStorageBytes: number;
  candidates: RankedSourceCandidate[];
  generatedAt: string;
}

export type DownloadableResourceType =
  | "pdf"
  | "markdown"
  | "html"
  | "json"
  | "documentation"
  | "image"
  | "example-project"
  | "api-specification";

export interface DownloadRequest {
  topic: string;
  sourceId: string;
  resourceType: DownloadableResourceType;
  url: string;
  fileName: string;
  expectedSizeBytes?: number;
  /** Knowledge Domain Planning domain ID (e.g. video-production-knowledge). */
  domainId?: string;
  title?: string;
  language?: string;
  /** Offline-first local file to copy instead of network fetch. */
  localSourcePath?: string;
}

export type DownloadStatus =
  | "pending-approval"
  | "approved"
  | "completed"
  | "rejected"
  | "failed"
  | "duplicate";

export type DownloadProcessingStatus = "unprocessed" | "queued-for-acquisition" | "understood" | "processed";

export interface DownloadRecord {
  id: string;
  topic: string;
  sourceId: string;
  resourceType: DownloadableResourceType;
  url: string;
  fileName: string;
  filePath: string | null;
  status: DownloadStatus;
  userApproved: boolean;
  processingStatus: DownloadProcessingStatus;
  license?: string;
  version?: string;
  checksumSha256: string | null;
  fileSizeBytes: number | null;
  requestedAt: string;
  completedAt?: string;
  rejectionReason?: string;
  /** Collection metadata (Step 3). */
  domainId?: string;
  title?: string;
  knowledgeDomain?: string;
  sourceName?: string;
  language?: string;
  trustScore?: number;
  qualityScore?: number;
  collectionDate?: string;
  lastUpdated?: string;
  metadataFingerprint?: string;
  localStoragePath?: string | null;
}

/** Alias used by Knowledge Collection APIs — same persisted download/collection record. */
export type CollectedKnowledgeResource = DownloadRecord;

export interface KnowledgeCollectionCoverage {
  domainId: string;
  domainLabel: string;
  resourceCount: number;
  completedCount: number;
  pendingCount: number;
  resourceIds: string[];
  coverageLevel: "strong" | "adequate" | "weak" | "missing";
}

export interface KnowledgeCollectionMissingReport {
  domainId: string;
  domainLabel: string;
  reason: string;
  suggestedResourceTypes: DownloadableResourceType[];
}

export interface KnowledgeCollectionRecommendation {
  domainId: string;
  sourceId: string;
  sourceName: string;
  rationale: string;
  trustScore: number;
  qualityScore: number;
}

export interface AiMeKnowledgeCollectionAwareness {
  totalResources: number;
  completedResources: number;
  pendingApproval: number;
  duplicatesBlocked: number;
  domainsPrepared: string[];
  domainCoverage: KnowledgeCollectionCoverage[];
  missingKnowledge: KnowledgeCollectionMissingReport[];
  recommendations: KnowledgeCollectionRecommendation[];
  workspaceRoot: string;
  summary: string;
}

export interface KnowledgeCollectionRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface KnowledgeCollectionReportData {
  generatedAt: string;
  existingCollectionSystem: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  knowledgeDomainsPrepared: string[];
  resourcesCollected: Array<{ resourceId: string; title: string; domainId: string; status: DownloadStatus }>;
  localWorkspaceStatus: { root: string; domainFolders: string[]; typeFolders: string[]; healthy: boolean };
  metadataStatus: { indexed: number; withFingerprint: number; completeMetadata: number };
  duplicateProtectionStatus: { fileNameBlocks: number; checksumBlocks: number; versionBlocks: number; metadataBlocks: number };
  aiMeIntegration: string;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingWorkBeforeStep4: string[];
}

export interface DownloadSafetyCheck {
  allowed: boolean;
  reasons: string[];
}

export interface DownloadTransportResult {
  content: Uint8Array;
  contentType?: string;
}

export type DownloadTransport = (url: string) => Promise<DownloadTransportResult>;

export interface KnowledgeResearchStatusReport {
  totalPlans: number;
  totalDownloads: number;
  completedDownloads: number;
  pendingApprovalDownloads: number;
  rejectedDownloads: number;
  duplicateDownloadsBlocked: number;
  failedDownloads: number;
  totalStorageBytes: number;
}

export interface ResearchEventLogEntry {
  at: string;
  event: string;
  detail: string;
  planId?: string;
  downloadId?: string;
}

export type NetworkQuality = "excellent" | "good" | "fair" | "poor" | "unavailable";
export type ConnectionStability = "stable" | "unstable" | "offline" | "unknown";

export interface ConnectivitySnapshot {
  checkedAt: string;
  internetAvailable: boolean;
  mode: "online" | "offline";
  networkQuality: NetworkQuality;
  connectionStability: ConnectionStability;
  latencyMs: number | null;
  professionalResearchMode: boolean;
  detail: string;
}

export type ReviewStagingStatus = "pending-review" | "accepted-for-later-integration" | "rejected-from-review";

export interface ReviewStagingRecord {
  downloadId: string;
  topic: string;
  sourceId: string;
  fileName: string;
  stagedPath: string;
  status: ReviewStagingStatus;
  stagedAt: string;
  reviewedAt?: string;
  notes: string;
}

export type KnowledgeExtractionKind =
  | "concept"
  | "rule"
  | "best-practice"
  | "workflow"
  | "definition"
  | "example"
  | "technical-recommendation";

export interface KnowledgeExtractionPreviewItem {
  kind: KnowledgeExtractionKind;
  text: string;
  sourceDownloadId: string;
}

export interface KnowledgeExtractionPreview {
  downloadId: string;
  topic: string;
  extractedAt: string;
  concepts: string[];
  rules: string[];
  bestPractices: string[];
  workflows: string[];
  definitions: string[];
  examples: string[];
  technicalRecommendations: string[];
  rejectedSignals: string[];
  qualityScore: number;
  importedToKnowledgeFoundation: false;
  summary: string;
}

export interface OnlineResearchSessionResult {
  sessionId: string;
  topic: string;
  connectivity: ConnectivitySnapshot;
  plan: ResearchPlan | null;
  preview: ResearchPreview | null;
  acceptedSources: RankedSourceCandidate[];
  rejectedSources: Array<{ name: string; reason: string }>;
  stagedDownloads: ReviewStagingRecord[];
  extractionPreviews: KnowledgeExtractionPreview[];
  recommendedTopics: string[];
  usedLocalKnowledgeFoundationOnly: boolean;
  knowledgeFoundationModified: false;
  issuesFound: string[];
  issuesRepaired: string[];
  summary: string;
}

export interface AiMeOnlineResearchAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  canDetectConnectivity: boolean;
  canSearchTrustedSources: boolean;
  canExplainSelection: boolean;
  canExplainRejection: boolean;
  canRecommendTopics: boolean;
  canStageDownloadsForReview: boolean;
  canExtractWithoutImport: boolean;
  professionalResearchMode: boolean;
  validationIntegrationDeferred: true;
  summary: string;
}

export interface OnlineResearchReportData {
  generatedAt: string;
  existingResearchCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  internetDetectionStatus: string;
  trustedSourcesDiscovered: Array<{ sourceId: string; name: string; compositeScore: number; accepted: boolean }>;
  downloadCapability: string;
  knowledgeExtractionQuality: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep2: string[];
}
