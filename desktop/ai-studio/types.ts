export type MessageKind = "assistant" | "user" | "report" | "progress";
export type TaskState = "active" | "waiting" | "complete" | "failed" | "background";

export interface StudioMessage {
  id: string;
  kind: MessageKind;
  body: string;
  createdAt: string;
  title?: string;
}

export interface AiStudioSession {
  id: string;
  conversationId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StudioMessage[];
}

export interface AiStudioStatus {
  aiCore: boolean;
  workflowEngine: boolean;
  communicationBus: boolean;
  moduleManager: boolean;
  memoryFoundation: boolean;
  knowledgeFoundation: boolean;
  automationEngine: boolean;
  taskScheduler: boolean;
  activeProject: string;
  activeProjectId: string | null;
}

export interface StudioTask {
  id: string;
  title: string;
  state: TaskState;
  progress: number;
  detail: string;
}

export type PipelineJobStatus = "queued" | "running" | "paused" | "cancelled" | "completed" | "failed";

export interface PipelineJob {
  id: string;
  projectId: string;
  stage: string;
  progress: number;
  status: PipelineJobStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  error?: string;
  notifications: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
  completedStages: string[];
}

export interface PipelineDashboard {
  jobs: PipelineJob[];
  history: PipelineJob[];
  monitor: Record<string, number | string>;
  integrations: Record<string, boolean>;
}