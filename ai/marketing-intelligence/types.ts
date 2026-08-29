import type { MarketingDirection, StructuredValueProposition } from "../product-intelligence/types.js";

export interface MarketingIntelligenceProfile {
  id: string;
  projectId: string;
  productId?: string;
  productOverview: string;
  audience: { persona: string; needs: string[]; messaging: string; label?: "user-provided" | "inferred" | "recommended" };
  brand: { identity: string; voice: string; consistency: string };
  campaign: { name: string; objective: string; goal: string };
  sellingPoints: string[];
  valueProposition: string;
  valuePropositionStructured?: StructuredValueProposition;
  directions?: MarketingDirection[];
  strategy: string;
  ctas: string[];
  platform: { name: string; format: string; recommendations: string[] };
  competitors: string[];
  recommendations: string[];
  score: number;
  performancePrediction: string;
  metadata: Record<string, string | number>;
  foundationKnowledgeIds?: string[];
  analysisState?: "not-analyzed" | "analyzing" | "ready" | "partial" | "failed";
  createdAt: string;
  updatedAt: string;
  cached: boolean;
}
export interface MarketingIntelligenceStore { profiles: MarketingIntelligenceProfile[]; history: Array<{ id: string; at: string; projectId: string; event: string; detail: string }>; cache: Record<string, string>; logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>; }