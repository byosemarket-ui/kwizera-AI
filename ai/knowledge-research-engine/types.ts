import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";

export type ResearchDomainPriority = "high" | "medium" | "low";

export interface ResearchDomain {
  domain: string;
  description: string;
  priority: ResearchDomainPriority;
  sourceTypes: KnowledgeAcquisitionSourceType[];
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
}

export interface RankedSourceCandidate {
  sourceId: string;
  name: string;
  type: KnowledgeAcquisitionSourceType;
  trustScore: number;
  qualityScore: number;
  freshnessScore: number;
  relevanceScore: number;
  completenessScore: number;
  compositeScore: number;
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
