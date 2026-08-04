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
}

export type DownloadStatus =
  | "pending-approval"
  | "approved"
  | "completed"
  | "rejected"
  | "failed"
  | "duplicate";

export type DownloadProcessingStatus = "unprocessed" | "queued-for-acquisition" | "processed";

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
