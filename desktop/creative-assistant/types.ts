/** Phase 6 Step 2 — AI Me Creative Assistant (orchestration layer over existing systems). */

import type { CreativeReviewAiMeContract } from "../creative-review/types";
import type { FeedbackCategory } from "../creative-review/types";

export type AssistantIntent =
  | "EXPLAIN"
  | "REVIEW"
  | "QUESTION"
  | "NAVIGATE"
  | "SUGGEST"
  | "CREATE_FEEDBACK"
  | "REQUEST_CHANGE"
  | "PREPARE_CHANGE"
  | "APPROVE"
  | "REJECT"
  | "VERSION_REQUEST"
  | "PRODUCTION_QUERY"
  | "QC_QUERY"
  | "OUTPUT_QUERY"
  | "HELP"
  | "CLARIFY"
  | "GENERAL";

export type AssistantLanguage = "en" | "rw";

export type ChangeProposalStatus =
  | "PENDING_APPROVAL"
  | "CONFIRMED"
  | "CANCELLED"
  | "APPLIED"
  | "FAILED";

export type AuditAction =
  | "USER_REQUEST"
  | "INTENT_DETECTED"
  | "CHANGE_PROPOSAL_CREATED"
  | "USER_CONFIRMED"
  | "USER_CANCELLED"
  | "COMMAND_EXECUTED"
  | "FEEDBACK_SAVED"
  | "NAVIGATION"
  | "ERROR";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  body: string;
  title?: string;
  intent?: AssistantIntent;
  language: AssistantLanguage;
  createdAt: string;
  suggestionCards?: SuggestionCard[];
  proposalId?: string;
  actions?: AssistantAction[];
}

export interface AssistantAction {
  id: string;
  label: string;
  kind: "proceed" | "cancel" | "prepare" | "navigate" | "retry" | "edit";
  payload?: Record<string, unknown>;
}

export interface SuggestionCard {
  id: string;
  title: string;
  reason: string;
  affectedArea: string;
  expectedBenefit: string;
  preparePayload: {
    category: FeedbackCategory;
    sceneId: string | null;
    comment: string;
  };
}

export interface ChangeRequestObject {
  changeId: string;
  projectId: string;
  productionId: string;
  sourceVersionId: string;
  requestedVersion: string;
  intent: "CREATIVE_CHANGE";
  target: { type: "scene" | "audio" | "text" | "timeline" | "global"; id: string | null };
  requestedChange: string;
  aiInterpretation: string;
  reason: string;
  status: ChangeProposalStatus;
  category: FeedbackCategory;
  sceneId: string | null;
  timestampSec: number | null;
  createdAt: string;
  updatedAt: string;
  resultNote: string | null;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  action: AuditAction;
  detail: string;
  productionId: string | null;
  versionLabel: string | null;
  result: "ok" | "error" | "pending";
}

export interface AssistantContext {
  version: 1;
  refreshedAt: string;
  available: boolean;
  unavailableReason: string | null;
  contract: CreativeReviewAiMeContract | null;
  projectId: string;
  projectName: string;
  productName: string | null;
  productSummary: string | null;
  marketingSummary: string | null;
  creativeSummary: string | null;
  productionId: string;
  runId: string;
  versionLabel: string;
  reviewStatus: string;
  productionStatus: string;
  qcOverall: string | null;
  qcFailures: string[];
  qcWarnings: string[];
  scenes: Array<{ id: string; name: string; number: number; hasVisual: boolean; hasVoice: boolean; hasText: boolean }>;
  selectedSceneId: string | null;
  feedbackCount: number;
  commentCount: number;
  noteCount: number;
  packageId: string | null;
  videoAvailable: boolean;
  videoMeta: string | null;
  progress: number | null;
  currentStage: string | null;
  etaLabel: string | null;
  resourceSummary: string | null;
  availableActions: string[];
}

export interface ConversationRecord {
  conversationId: string;
  projectId: string;
  productionId: string;
  versionLabel: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AssistantUiSnapshot {
  version: 1;
  context: AssistantContext;
  conversation: ConversationRecord | null;
  pendingProposal: ChangeRequestObject | null;
  proposals: ChangeRequestObject[];
  audit: AuditLogEntry[];
  thinking: boolean;
  streamingText: string | null;
  lastError: string | null;
  recommendation: string;
  updatedAt: string;
}

export const ASSISTANT_STORE_KEY = "kwizera.creative-assistant.v1";
export const ASSISTANT_AUDIT_KEY = "kwizera.creative-assistant.audit.v1";
export const ASSISTANT_CHAT_KEY = "kwizera.creative-assistant.chat.v1";

export const QUICK_COMMANDS: Array<{ id: string; label: string; message: string }> = [
  { id: "explain-production", label: "Explain Production", message: "Explain this production." },
  { id: "review-video", label: "Review Video", message: "Review this video." },
  { id: "find-problems", label: "Find Problems", message: "Ni iki kitagenda neza?" },
  { id: "review-scene", label: "Review Current Scene", message: "Review the current scene." },
  { id: "explain-qc", label: "Explain QC", message: "Why did QC fail or pass?" },
  { id: "suggest", label: "Suggest Improvements", message: "Ni iki nakosora?" },
  { id: "show-feedback", label: "Show Feedback", message: "Show my feedback." },
  { id: "explain-version", label: "Explain Version", message: "What is the current version?" },
  { id: "prepare-changes", label: "Prepare Changes", message: "Prepare changes." },
  { id: "smart-summary", label: "Smart Summary", message: "Nkora iki ubu?" },
];
