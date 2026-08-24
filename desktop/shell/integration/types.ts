/** Workspace Integration, Communication & Event Orchestration — Step 9 */

export type WorkspaceModuleId =
  | "workspace"
  | "ai-me"
  | "product-analysis"
  | "knowledge"
  | "marketing"
  | "storytelling"
  | "creative"
  | "image"
  | "audio"
  | "video"
  | "rendering"
  | "output"
  | "notifications"
  | "integration";

export type WorkspaceEventType =
  | "project.created"
  | "project.loaded"
  | "images.imported"
  | "product.updated"
  | "product-analysis.started"
  | "product-analysis.completed"
  | "marketing.started"
  | "marketing.completed"
  | "storyboard.started"
  | "storyboard.completed"
  | "image-generation.started"
  | "image-generation.completed"
  | "audio-generation.started"
  | "audio-generation.completed"
  | "video-generation.started"
  | "video-generation.completed"
  | "rendering.started"
  | "rendering.completed"
  | "export.started"
  | "export.completed"
  | "module.ready"
  | "module.message"
  | "module.error"
  | "sync.requested"
  | "sync.completed"
  | "state.shared"
  | "state.conflict"
  | "workflow.started"
  | "workflow.step"
  | "workflow.synced"
  | "workflow.failed"
  | "notify.success"
  | "notify.warning"
  | "notify.error"
  | "notify.info"
  | "ai.recommendation"
  | "production.progress"
  | "recovery.status"
  | "error.propagated"
  | "queue.enqueued"
  | "queue.retried"
  | "bus.bridged"
  | "bus.offline";

export type MessagePriority = "critical" | "high" | "normal" | "low" | "background";

export interface WorkspaceEvent {
  id: string;
  type: WorkspaceEventType;
  source: WorkspaceModuleId;
  targets?: WorkspaceModuleId[];
  at: string;
  correlationId: string;
  priority: MessagePriority;
  payload: Record<string, unknown>;
  notify?: {
    tone: "success" | "warning" | "error" | "info";
    title: string;
    detail: string;
    category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions";
  };
}

export interface QueuedMessage {
  id: string;
  event: WorkspaceEvent;
  priority: MessagePriority;
  status: "queued" | "delivering" | "delivered" | "failed" | "delayed" | "retrying";
  attempts: number;
  maxAttempts: number;
  availableAt: number;
  lastError?: string;
}

export interface SharedWorkspaceState {
  productInformation: Record<string, unknown>;
  uploadedImages: Array<{ id: string; name: string }>;
  analysisResults: Record<string, unknown> | null;
  marketingStrategy: Record<string, unknown> | null;
  storyboard: Record<string, unknown> | null;
  productionStatus: string;
  renderStatus: string;
  exportStatus: string;
  progress: number;
  revision: number;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  event: WorkspaceEventType;
  dependsOn: WorkspaceEventType[];
  module: WorkspaceModuleId;
  status: "pending" | "ready" | "running" | "completed" | "blocked" | "failed";
}

export interface IntegrationSnapshot {
  version: 1;
  busOnline: boolean;
  aiBusBridged: boolean;
  queueDepth: number;
  deliveredCount: number;
  failedCount: number;
  lastEvents: WorkspaceEvent[];
  shared: SharedWorkspaceState;
  workflow: WorkflowStep[];
  recommendation: string;
}

export interface AiMeIntegrationContext {
  busOnline: boolean;
  aiBusBridged: boolean;
  queueDepth: number;
  lastEventType: string | null;
  workflowSummary: string;
  recommendation: string;
  explanation: string;
}

export type EventHandler = (event: WorkspaceEvent) => void | Promise<void>;

export const ALL_WORKSPACE_EVENT_TYPES: WorkspaceEventType[] = [
  "project.created", "project.loaded", "images.imported", "product.updated",
  "product-analysis.started", "product-analysis.completed",
  "marketing.started", "marketing.completed",
  "storyboard.started", "storyboard.completed",
  "image-generation.started", "image-generation.completed",
  "audio-generation.started", "audio-generation.completed",
  "video-generation.started", "video-generation.completed",
  "rendering.started", "rendering.completed",
  "export.started", "export.completed",
  "module.ready", "module.message", "module.error",
  "sync.requested", "sync.completed", "state.shared", "state.conflict",
  "workflow.started", "workflow.step", "workflow.synced", "workflow.failed",
  "notify.success", "notify.warning", "notify.error", "notify.info",
  "ai.recommendation", "production.progress", "recovery.status",
  "error.propagated", "queue.enqueued", "queue.retried", "bus.bridged", "bus.offline",
];
