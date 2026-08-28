/** Professional Dashboard — widget system & live workspace types */

export type WidgetKind =
  | "information"
  | "progress"
  | "statistics"
  | "ai"
  | "preview"
  | "notification"
  | "action";

export type DashboardWidgetId =
  | "active-project"
  | "last-activity"
  | "ai-recommendation"
  | "recent-production"
  | "system-health"
  | "current-workspace"
  | "live-status"
  | "production-modules"
  | "reserved-panels"
  | "quick-actions"
  | "statistics"
  | "notifications";

export type ProductionModuleId =
  | "product-upload"
  | "product-analysis"
  | "marketing"
  | "storyboard"
  | "image-generation"
  | "audio-generation"
  | "video-generation"
  | "rendering"
  | "export";

export type ReservedPanelId =
  | "product-input"
  | "ai-analysis"
  | "live-preview"
  | "timeline"
  | "output"
  | "ai-me";

export interface WidgetPlacement {
  id: DashboardWidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
  pinned: boolean;
  locked: boolean;
  hidden: boolean;
  compact: boolean;
  kind: WidgetKind;
}

export interface DashboardLayoutV2 {
  version: 2 | 3;
  columns: number;
  widgets: WidgetPlacement[];
}

export type LiveStatusKey =
  | "active-project"
  | "production"
  | "ai"
  | "rendering"
  | "knowledge"
  | "storage";

export interface LiveStatusCard {
  key: LiveStatusKey;
  label: string;
  value: string;
  detail: string;
  online: boolean;
  progress?: number;
}

export interface LiveProgressState {
  percent: number;
  remainingLabel: string;
  completed: number;
  running: number;
  waiting: number;
  tasks: Array<{ id: string; label: string; status: "completed" | "running" | "waiting"; progress: number }>;
}

export interface DashboardLiveSnapshot {
  updatedAt: string;
  statuses: LiveStatusCard[];
  progress: LiveProgressState;
  activeProject: string | null;
  workspaceLabel: string;
  aiRecommendation: string;
  lastActivity: string;
  recentProduction: string;
  imageCount?: number;
}

export interface DashboardPipelineJob {
  id: string;
  status: string;
  stage?: string;
  progress?: number;
  updatedAt?: string;
}

export interface DashboardPipelineSnapshot {
  jobs: DashboardPipelineJob[];
  history: DashboardPipelineJob[];
  monitor?: Record<string, number | string>;
}

export interface DashboardMemoryHealth {
  ready: boolean;
  memory: string;
  knowledge: string;
  memoryCount: number;
  knowledgeCount: number;
}

export interface DashboardCoreStatus {
  aiCore: boolean;
  workflowEngine: boolean;
  communicationBus: boolean;
  moduleManager: boolean;
  memoryFoundation: boolean;
  knowledgeFoundation: boolean;
  automationEngine?: boolean;
  taskScheduler?: boolean;
  activeProject: string;
  activeProjectId?: string | null;
  runtimeMetrics?: { memoryMb: number; cpuUserMs: number; gpu: string; activeJobs: number };
}

export interface DashboardProject {
  id: string;
  name: string;
  modifiedAt: string;
  productImages: Array<{ sizeBytes: number }>;
}

export interface DashboardWorkspace {
  activeProject: DashboardProject | null;
  projects: DashboardProject[];
}

export interface AiMeDashboardContext {
  layout: { columns: number; visibleWidgets: string[]; pinnedWidgets: string[]; lockedWidgets: string[] };
  live: Pick<DashboardLiveSnapshot, "activeProject" | "workspaceLabel" | "aiRecommendation" | "lastActivity">;
  progress: LiveProgressState;
  explanation: string;
}
