/** Phase 3 Step 3 — Online Knowledge Research, Market & Customer Intelligence */

import type { ProductIntelligencePackage } from "../deep-intelligence/types";
import type { ProductionInputPackage } from "../product-validation/types";
import type { ProductProfile } from "../product-profile/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import type { KnowledgeKind, SourceQuality, Freshness } from "../../../ai/knowledge-research-engine/product-market-research";

export type ResearchMode = "online" | "offline" | "hybrid";
export type SourceAction = "keep" | "ignore" | "important" | "pending";
export type ResearchStage =
  | "understand-product"
  | "generate-queries"
  | "search-sources"
  | "extract-knowledge"
  | "customer-intelligence"
  | "market-intelligence"
  | "marketing-insights"
  | "saved";

export interface ResearchSource {
  id: string;
  url: string;
  title: string;
  sourceType: string;
  domain: string;
  publishedAt: string | null;
  retrievedAt: string;
  quality: SourceQuality;
  query: string;
  extracted: string;
  relevance: number;
  confidence: number;
  action: SourceAction;
}

export interface KnowledgeItem {
  id: string;
  topic: string;
  claim: string;
  kind: KnowledgeKind;
  sourceId: string;
  sourceQuality: SourceQuality;
  confidence: number;
  createdAt: string;
  lastVerified: string | null;
  freshness: Freshness;
  objective: string;
  productRelevance: boolean;
  marketRelevance: boolean;
  customerRelevance: boolean;
  tags: string[];
}

export interface InsightRow {
  id: string;
  label: string;
  detail: string;
  kind: KnowledgeKind;
  confidence: number;
  evidenceLevel: "high" | "medium" | "low" | "insufficient";
  sourceOrReason: string;
  reviewed: boolean;
}

export interface MarketingAngle {
  id: string;
  name: string;
  customerProblem: string;
  productBenefit: string;
  supportingEvidence: string;
  audience: string;
  suggestedMessage: string;
  confidence: number;
  sourceIds: string[];
  verificationFlag: string | null;
}

export interface ResearchPackage {
  version: 1;
  researchId: string;
  versionLabel: string;
  versionNumber: number;
  engineId: string;
  projectId: string;
  productId: string;
  projectName: string;
  productName: string;
  internetAvailable: boolean;
  researchMode: ResearchMode;
  workingLanguage: string;
  queries: Array<{ id: string; text: string; objective: string }>;
  sources: ResearchSource[];
  knowledge: KnowledgeItem[];
  productKnowledge: KnowledgeItem[];
  customerInsights: InsightRow[];
  marketInsights: InsightRow[];
  competitiveInsights: InsightRow[];
  painPoints: InsightRow[];
  desires: InsightRow[];
  motivations: InsightRow[];
  objections: InsightRow[];
  audienceRefinement: string;
  marketingAngles: MarketingAngle[];
  platformNotes: InsightRow[];
  localKnowledgeAge: string | null;
  insufficientMarketData: boolean;
  noLocalKnowledge: boolean;
  history: Array<{ versionLabel: string; researchId: string; createdAt: string }>;
  status: "idle" | "running" | "complete" | "partial";
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProgress {
  total: number;
  completed: number;
  percent: number;
  currentLabel: string;
  currentStage: ResearchStage | null;
  running: boolean;
}

export interface MarketResearchSnapshot {
  version: 1;
  package: ResearchPackage | null;
  progress: ResearchProgress;
  internetAvailable: boolean | null;
  researchMode: ResearchMode | null;
  recommendation: string;
  handoffReady: boolean;
  updatedAt: string;
}

export interface Step4CreativeBriefHandoffPayload {
  version: 1;
  step: "step-4-master-intelligence-report";
  projectId: string;
  projectName: string;
  research: ResearchPackage;
  masterIntelligence: ProductIntelligencePackage | null;
  productionPackage: ProductionInputPackage | null;
  productProfile: ProductProfile | null;
  marketingBrief: MarketingProductionBrief | null;
  preparedAt: string;
}

export const RESEARCH_STORE_KEY = "kwizera.market-research.v1";
export const RESEARCH_HANDOFF_KEY = "kwizera.market-research.handoff.v1";
export const RESEARCH_MEMORY_KEY = "kwizera.market-research.memory.v1";

export const RESEARCH_STAGES: ResearchStage[] = [
  "understand-product",
  "generate-queries",
  "search-sources",
  "extract-knowledge",
  "customer-intelligence",
  "market-intelligence",
  "marketing-insights",
  "saved",
];

export const RESEARCH_STAGE_LABELS: Record<ResearchStage, string> = {
  "understand-product": "Understanding product",
  "generate-queries": "Generating research questions",
  "search-sources": "Searching sources",
  "extract-knowledge": "Extracting knowledge",
  "customer-intelligence": "Customer intelligence",
  "market-intelligence": "Market intelligence",
  "marketing-insights": "Marketing insights",
  saved: "Result saved",
};
