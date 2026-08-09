/**
 * Professional Knowledge Expansion Certification — Step 10 types.
 * Certifies integrated knowledge capability only when all required domains pass.
 */

export const PROFESSIONAL_KNOWLEDGE_EXPANSION_VERSION = "1.0.0";

export type ProfessionalCertificationCheckStatus = "passed" | "failed" | "blocked" | "skipped";

export interface ProfessionalKnowledgeCertificationCheck {
  id: string;
  label: string;
  status: ProfessionalCertificationCheckStatus;
  detail: string;
  evidenceKnowledgeIds: string[];
  issues: string[];
}

export interface ProfessionalKnowledgeDomainCertification {
  domainId: string;
  name: string;
  expectedPackSlug: string | null;
  contentReady: boolean;
  packPresent: boolean;
  packItemCount: number;
  metadataValid: boolean;
  healthStatus: "healthy" | "unhealthy" | "not-applicable";
  status: ProfessionalCertificationCheckStatus;
  issues: string[];
}

export interface ProfessionalKnowledgeCapabilityVerification {
  search: ProfessionalKnowledgeCertificationCheck;
  explain: ProfessionalKnowledgeCertificationCheck;
  compare: ProfessionalKnowledgeCertificationCheck;
  bestPractices: ProfessionalKnowledgeCertificationCheck;
  workflow: ProfessionalKnowledgeCertificationCheck;
  camera: ProfessionalKnowledgeCertificationCheck;
  lighting: ProfessionalKnowledgeCertificationCheck;
  storytelling: ProfessionalKnowledgeCertificationCheck;
  editing: ProfessionalKnowledgeCertificationCheck;
  rendering: ProfessionalKnowledgeCertificationCheck;
  marketing: ProfessionalKnowledgeCertificationCheck;
  socialMedia: ProfessionalKnowledgeCertificationCheck;
  industryQuality: ProfessionalKnowledgeCertificationCheck;
  reasoning: ProfessionalKnowledgeCertificationCheck;
  planningIntegration: ProfessionalKnowledgeCertificationCheck;
  decisionIntegration: ProfessionalKnowledgeCertificationCheck;
  workflowIntegration: ProfessionalKnowledgeCertificationCheck;
}

export interface ProfessionalKnowledgeFoundationVerification {
  domains: ProfessionalKnowledgeCertificationCheck;
  packs: ProfessionalKnowledgeCertificationCheck;
  relationships: ProfessionalKnowledgeCertificationCheck;
  metadata: ProfessionalKnowledgeCertificationCheck;
  searchIndex: ProfessionalKnowledgeCertificationCheck;
  semanticSearch: ProfessionalKnowledgeCertificationCheck;
  knowledgeGraph: ProfessionalKnowledgeCertificationCheck;
  versionHistory: ProfessionalKnowledgeCertificationCheck;
  scores: ProfessionalKnowledgeCertificationCheck;
  synchronization: ProfessionalKnowledgeCertificationCheck;
}

export interface ProfessionalKnowledgeCertificationResult {
  version: typeof PROFESSIONAL_KNOWLEDGE_EXPANSION_VERSION;
  verifiedAt: string;
  certified: boolean;
  totalKnowledgeDomains: number;
  totalKnowledgePacks: number;
  totalKnowledgeRelationships: number;
  professionalCoverage: ProfessionalKnowledgeDomainCertification[];
  capabilities: ProfessionalKnowledgeCapabilityVerification;
  foundation: ProfessionalKnowledgeFoundationVerification;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingGaps: string[];
  maturityPercentage: number;
  maturitySummary: string;
  certificatePath: string | null;
  verificationPath: string;
}

export interface ProfessionalKnowledgeCertificationRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface AiMeProfessionalKnowledgeCertificationAwareness {
  canVerifyProfessionalKnowledge: boolean;
  canExplainCertificationStatus: boolean;
  canReportKnowledgeGaps: boolean;
  certified: boolean;
  maturityPercentage: number;
  remainingGapCount: number;
  summary: string;
}

export class ProfessionalKnowledgeCertificationError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalKnowledgeCertificationError";
  }
}
