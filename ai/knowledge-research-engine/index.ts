export { AiKnowledgeResearchEngine } from "./knowledge-research-engine.js";
export { ResearchPlanner } from "./research-planner.js";
export { ResearchSourceDiscovery, SOURCE_SCORE_FLOORS } from "./research-source-discovery.js";
export { ResearchExplainer } from "./research-explainer.js";
export { KnowledgeDownloadEngine, offlineDownloadTransport } from "./download-engine.js";
export { KnowledgeCollectionService } from "./knowledge-collection-service.js";
export {
  ConnectivityDetector,
  dnsConnectivityProbe,
  offlineConnectivityProbe,
} from "./connectivity-detector.js";
export type { ConnectivityProbe } from "./connectivity-detector.js";
export {
  PROFESSIONAL_ONLINE_RESEARCH_DOMAINS,
  isTopicWithinProfessionalResearchScope,
  listProfessionalResearchDomains,
  matchProfessionalResearchDomains,
} from "./professional-research-domains.js";
export {
  generateResearchQueries,
  dedupeQueries,
  classifySourceQuality,
  freshnessFromIso,
  knowledgeDedupeKey,
  localCategoryKnowledge,
  band as researchConfidenceBand,
} from "./product-market-research.js";
export type {
  ProductResearchContext,
  ResearchQuery,
  SourceQuality,
  KnowledgeKind,
  Freshness,
} from "./product-market-research.js";
export type {
  ProfessionalResearchDomainDefinition,
  ResearchDiscoveryKind,
} from "./professional-research-domains.js";
export { KnowledgeReviewStagingArea } from "./knowledge-review-staging.js";
export { KnowledgeExtractionPreviewEngine } from "./knowledge-extraction-preview.js";
export {
  KnowledgeCollectionWorkspace,
  PREPARED_WORKSPACE_DOMAIN_SLUGS,
  WORKSPACE_DOMAIN_FOLDERS,
  WORKSPACE_TYPE_FOLDERS,
  domainIdToWorkspaceSlug,
} from "./knowledge-collection-workspace.js";
export {
  MAX_DOWNLOAD_SIZE_BYTES,
  checkFileSize,
  checkFileType,
  checkLicense,
  checkSourceTrust,
  evaluateDownloadSafety,
  resolveDownloadFolder,
} from "./download-safety.js";
export type {
  AiMeKnowledgeCollectionAwareness,
  AiMeOnlineResearchAwareness,
  CollectedKnowledgeResource,
  ConnectionStability,
  ConnectivitySnapshot,
  DownloadableResourceType,
  DownloadProcessingStatus,
  DownloadRecord,
  DownloadRequest,
  DownloadSafetyCheck,
  DownloadStatus,
  DownloadTransport,
  DownloadTransportResult,
  KnowledgeCollectionCoverage,
  KnowledgeCollectionMissingReport,
  KnowledgeCollectionRecommendation,
  KnowledgeCollectionRepairResult,
  KnowledgeCollectionReportData,
  KnowledgeExtractionKind,
  KnowledgeExtractionPreview,
  KnowledgeExtractionPreviewItem,
  KnowledgeResearchStatusReport,
  NetworkQuality,
  OnlineResearchReportData,
  OnlineResearchSessionResult,
  RankedSourceCandidate,
  ResearchDomain,
  ResearchDomainPriority,
  ResearchEventLogEntry,
  ResearchPlan,
  ResearchPreview,
  ResearchTask,
  ResearchTaskStatus,
  ReviewStagingRecord,
  ReviewStagingStatus,
} from "./types.js";
