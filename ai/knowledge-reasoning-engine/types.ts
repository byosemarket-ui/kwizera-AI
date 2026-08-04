export interface ProfessionalKnowledgeRecommendation {
  knowledgeId: string;
  guidance: string;
  reason: string;
  confidenceScore: number;
}

export interface ProfessionalKnowledgeReasoningResult {
  topic: string;
  available: boolean;
  confidenceScore: number;
  selected: ProfessionalKnowledgeRecommendation | null;
  alternatives: ProfessionalKnowledgeRecommendation[];
  decisionRules: string[];
  risks: string[];
  tradeOffs: string[];
  relatedKnowledgeIds: string[];
  explanation: string;
}

export interface KnowledgeImpactReport {
  knowledgeId: string;
  operation: "create" | "update";
  affectedWorkflows: string[];
  affectedDecisions: string[];
  affectedRecommendations: Array<"rendering" | "camera" | "marketing" | "image" | "video">;
  relatedKnowledgeIds: string[];
  createdAt: string;
}