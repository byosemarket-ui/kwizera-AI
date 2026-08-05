import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";

export type KnowledgeSourceLocationKind = "local-path" | "url";

export interface KnowledgeSourceLocation {
  kind: KnowledgeSourceLocationKind;
  value: string;
}

export type KnowledgeSourceStatus = "pending" | "approved" | "rejected" | "suspended" | "removed";

/** Professional trust tier — never auto-approves unknown or low-quality sources. */
export enum KnowledgeSourceTrustClass {
  Official = "official",
  HighlyTrusted = "highly-trusted",
  Trusted = "trusted",
  Community = "community",
  UserProvided = "user-provided",
}

export type KnowledgeSourceUpdateFrequency =
  | "continuous"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "as-needed"
  | "unknown";

export type KnowledgeSourceAccessMethod =
  | "https-documentation"
  | "https-api-reference"
  | "open-access-repository"
  | "local-filesystem"
  | "user-upload"
  | "internal-pack";

export type KnowledgeSourceLanguage = "en" | "rw" | "fr" | "multi" | "unknown";

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
  /** Discovery category label (e.g. AI/ML, Video Production). */
  category?: string;
  /** Linked knowledge-domain / discovery topic IDs. */
  domainIds?: string[];
  /** Canonical official website when different from the resource location. */
  officialWebsite?: string;
  /** Human-readable resource type aligned with acquisition source type. */
  resourceType?: KnowledgeAcquisitionSourceType;
  language?: KnowledgeSourceLanguage;
  trustClass?: KnowledgeSourceTrustClass;
  updateFrequency?: KnowledgeSourceUpdateFrequency;
  accessMethod?: KnowledgeSourceAccessMethod;
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
  /** Discovery topics this source primarily covers. */
  discoveryTopics: string[];
  /** Whether this entry upgrades a previously seeded library source. */
  upgradedFromExisting?: boolean;
}

export interface TrustedSourceDiscoveryCoverage {
  topicId: string;
  topicLabel: string;
  domainIds: string[];
  sourceIds: string[];
  sourceCount: number;
  bestSourceId: string | null;
  bestTrustClass: KnowledgeSourceTrustClass | null;
  averageTrustScore: number;
  averageQualityScore: number;
  coverageLevel: "strong" | "adequate" | "weak" | "missing";
}

export interface TrustedSourceDiscoveryRecommendation {
  sourceId: string;
  name: string;
  trustClass: KnowledgeSourceTrustClass;
  trustScore: number;
  qualityScore: number;
  confidenceScore: number;
  whySelected: string;
  domainIds: string[];
  category: string;
}

export interface TrustedSourceMissingReport {
  topicId: string;
  topicLabel: string;
  domainIds: string[];
  reason: string;
  suggestedSourceTypes: KnowledgeAcquisitionSourceType[];
  suggestedTrustClasses: KnowledgeSourceTrustClass[];
}

export interface AiMeTrustedSourceAwareness {
  totalRegistered: number;
  pendingApproval: number;
  approved: number;
  trustClassCounts: Record<KnowledgeSourceTrustClass, number>;
  coveredTopics: string[];
  missingTopics: TrustedSourceMissingReport[];
  topRecommendations: TrustedSourceDiscoveryRecommendation[];
  summary: string;
}

export interface TrustedSourceDiscoveryReportData {
  generatedAt: string;
  existingSourcesFound: Array<{ sourceId: string; name: string; category: string }>;
  sourcesUpgraded: Array<{ sourceId: string; name: string; upgradeSummary: string }>;
  newSourcesRegistered: Array<{ sourceId: string; name: string; category: string; trustClass: KnowledgeSourceTrustClass }>;
  sourceCategories: string[];
  trustScores: Array<{ sourceId: string; trustScore: number; trustClass: KnowledgeSourceTrustClass }>;
  qualityScores: Array<{ sourceId: string; qualityScore: number; confidenceScore: number }>;
  domainCoverage: TrustedSourceDiscoveryCoverage[];
  missingTrustedSources: TrustedSourceMissingReport[];
  totals: {
    catalogSize: number;
    registered: number;
    upgraded: number;
    newlyRegistered: number;
    topicsCovered: number;
    topicsMissing: number;
  };
}
