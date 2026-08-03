export type ConversationLanguage = "en" | "rw" | "mixed" | "unknown";

export type ConversationIntent =
  | "image-generation"
  | "video-generation"
  | "product-analysis"
  | "editing"
  | "marketing"
  | "translation"
  | "project-management"
  | "system"
  | "general";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  intent?: ConversationIntent;
}

export interface ConversationRecord {
  id: string;
  coreSessionId?: string;
  projectId?: string;
  language: ConversationLanguage;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  pendingPlan?: ConversationPlan;
}

export interface ConversationPlan {
  intent: ConversationIntent;
  requiredEngines: string[];
  complexity: "low" | "medium" | "high";
  readyForWorkflow: boolean;
  missingInformation: string[];
  decision?: {
    decisionId: string;
    status: string;
    approved: boolean;
    canExecute: boolean;
    taskCount: number;
    estimatedProcessingMs?: number;
    alternatives: number;
    risks: string[];
  };
}

export interface ConversationResponse {
  conversation: ConversationRecord;
  language: ConversationLanguage;
  plan: ConversationPlan;
  response: string;
  context: { memoryMatches: number; knowledgeMatches: number; projectKnown: boolean };
  execution?: { dispatched: boolean; jobId?: string; error?: string };
}

export interface ConversationInput {
  conversationId?: string;
  message: string;
  projectId?: string;
}