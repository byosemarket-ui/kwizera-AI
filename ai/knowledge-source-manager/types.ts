import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";

export type KnowledgeSourceLocationKind = "local-path" | "url";

export interface KnowledgeSourceLocation {
  kind: KnowledgeSourceLocationKind;
  value: string;
}

export type KnowledgeSourceStatus = "pending" | "approved" | "rejected" | "suspended" | "removed";

export interface KnowledgeSourceDefinition {
  id: string;
  name: string;
  description: string;
  type: KnowledgeAcquisitionSourceType;
  location: KnowledgeSourceLocation;
  tags?: string[];
  /** Organization or individual that publishes the source (e.g. "PyTorch", "Mozilla"). */
  publisher?: string;
  /** SPDX identifier or free-text license description, when known. */
  license?: string;
  version?: string;
  /** ISO timestamp of the source's last known update, used for freshness scoring. */
  lastUpdated?: string;
}

export interface KnowledgeSourceVerification {
  verified: boolean;
  trustScore: number;
  issues: string[];
  verifiedAt: string;
}

export interface RegisteredKnowledgeSource extends KnowledgeSourceDefinition {
  status: KnowledgeSourceStatus;
  verification: KnowledgeSourceVerification;
  quality: KnowledgeSourceQualityScores | null;
  registeredAt: string;
  updatedAt: string;
  approvedAt?: string;
  lastError?: string;
}

export interface KnowledgeSourceManagerStatusReport {
  totalSources: number;
  approved: number;
  pending: number;
  rejected: number;
  suspended: number;
  removed: number;
  averageTrustScore: number;
  averageQualityScore: number;
}

export interface KnowledgeSourceEventLogEntry {
  at: string;
  event: string;
  sourceId?: string;
  detail: string;
}

export interface KnowledgeSourceQualityScores {
  qualityScore: number;
  trustScore: number;
  reputationScore: number;
  completenessScore: number;
  freshnessScore: number;
  confidenceScore: number;
}

export type KnowledgeSourcePolicyDecision = "allow" | "block" | "review";
export type KnowledgeSourcePolicyList = "allowed" | "blocked" | "preferred" | "internal" | "company" | "user";

export interface KnowledgeSourcePolicyConfig {
  allowed: string[];
  blocked: string[];
  preferred: string[];
  internal: string[];
  company: string[];
  user: string[];
  priorityOrder: string[];
}

export interface KnowledgeSourcePolicyEvaluation {
  sourceId: string;
  decision: KnowledgeSourcePolicyDecision;
  reason: string;
  matchedList?: KnowledgeSourcePolicyList;
}

export enum KnowledgeSourceWarningType {
  Unavailable = "unavailable",
  BrokenLink = "broken-link",
  VersionChanged = "version-changed",
  Deprecated = "deprecated",
  SlowResponse = "slow-response",
  TrustDegraded = "trust-degraded",
}

export interface KnowledgeSourceHealthWarning {
  sourceId: string;
  type: KnowledgeSourceWarningType;
  severity: "warning" | "critical";
  message: string;
  recommendation: string;
}

export interface KnowledgeSourceHealthRecord {
  sourceId: string;
  available: boolean;
  checked: boolean;
  responseTimeMs?: number;
  consecutiveFailures: number;
  lastCheckedAt: string;
  versionSignature?: string;
  issues: string[];
}

export interface KnowledgeSourceHealthReport {
  checkedAt: string;
  records: KnowledgeSourceHealthRecord[];
  warnings: KnowledgeSourceHealthWarning[];
}

export interface KnowledgeSourceAvailabilityProbe {
  available: boolean;
  responseTimeMs?: number;
  versionSignature?: string;
  error?: string;
}

export type KnowledgeSourceAvailabilityProber = (
  source: RegisteredKnowledgeSource
) => Promise<KnowledgeSourceAvailabilityProbe>;

export interface KnowledgeSourceComparison {
  summary: string;
  rankedSourceIds: string[];
  tradeoffs: Array<{ sourceId: string; note: string }>;
}

export interface KnowledgeSourceRecommendation {
  sourceId: string;
  label: string;
  summary: string;
  qualityScore: number;
  improvements: string[];
}

export interface KnowledgeSourceExplanation {
  summary: string;
  whyBest?: string;
  rejectedAlternatives: Array<{ sourceId: string; reason: string }>;
  internalNotes: string[];
}

export interface TrustedKnowledgeSourceEntry {
  definition: KnowledgeSourceDefinition;
  category: string;
}
