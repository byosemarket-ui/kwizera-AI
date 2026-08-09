/** Platform Step 6 — AI Workspace Manager & Module Orchestration types. */

export const WORKSPACE_MANAGER_VERSION = "1.0";

export type StudioModuleId =
  | "knowledge-foundation"
  | "ai-me"
  | "product-intelligence"
  | "storyboard-engine"
  | "prompt-engine"
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "rendering"
  | "learning-engine"
  | "asset-library"
  | "workspace"
  | "project-manager";

export type StudioModuleLifecycle =
  | "registered"
  | "initializing"
  | "loaded"
  | "unloaded"
  | "restarting"
  | "upgrading"
  | "failed"
  | "healthy";

export type WorkspaceKind =
  | "active"
  | "temporary"
  | "cache"
  | "export"
  | "backup";

export type ConfigDomain =
  | "ai"
  | "rendering"
  | "learning"
  | "workspace"
  | "hardware"
  | "export";

export interface StudioModuleRecord {
  moduleId: StudioModuleId;
  displayName: string;
  version: string;
  lifecycle: StudioModuleLifecycle;
  health: "healthy" | "degraded" | "failed" | "unknown";
  registeredAt: string;
  lastActivityAt: string;
  lastError: string | null;
  restartCount: number;
}

export interface InternalEvent {
  id: string;
  at: string;
  type: string;
  source: StudioModuleId | "workspace-manager";
  target: StudioModuleId | "broadcast";
  payload: Record<string, unknown>;
}

export interface InternalMessage {
  id: string;
  at: string;
  from: StudioModuleId | "workspace-manager";
  to: StudioModuleId;
  topic: string;
  body: string;
  conflict: boolean;
}

export interface SharedContext {
  activeWorkspaceId: string | null;
  activeProjectId: string | null;
  sessionId: string | null;
  memoryKeys: string[];
  knowledgeRefs: string[];
}

export interface WorkspaceRecord {
  workspaceId: string;
  kind: WorkspaceKind;
  label: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  workspaceId: string | null;
  projectId: string | null;
  openProjects: string[];
  activeTasks: string[];
  workspaceState: Record<string, unknown>;
  recoveredFromShutdown: boolean;
}

export interface ConfigChangeRecord {
  id: string;
  at: string;
  domain: ConfigDomain;
  key: string;
  previousValue: unknown;
  nextValue: unknown;
  backupPath: string | null;
}

export interface HealthSnapshot {
  at: string;
  moduleStatus: Record<string, string>;
  workspaceStatus: string;
  projectStatus: string;
  databaseStatus: string;
  knowledgeStatus: string;
  storageStatus: string;
  failures: string[];
}

export interface WorkspaceManagerResult {
  runId: string;
  version: typeof WORKSPACE_MANAGER_VERSION;
  processedAt: string;
  modulesRegistered: number;
  activeWorkspaceId: string | null;
  activeSessionId: string | null;
  outputsOrganized: number;
  health: HealthSnapshot;
  issuesFound: string[];
  issuesRepaired: string[];
  projectStateLost: false;
  configOverwrittenWithoutBackup: false;
  singleUserOnly: true;
  localMachineOnly: true;
  studioMonitoringSecurityDeferred: true;
  summary: string;
}

export interface AiMeWorkspaceManagerAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  singleUserOnly: true;
  canExplainWorkspaceStatus: boolean;
  canExplainModuleStatus: boolean;
  canRestartFailedModulesSafely: boolean;
  canRecommendWorkspaceOptimization: boolean;
  canResumeUnfinishedSessions: boolean;
  studioMonitoringSecurityDeferred: true;
  summary: string;
}

export interface WorkspaceManagerExplainResult {
  workspaceStatus: string;
  moduleStatus: string;
  optimizationRecommendation: string;
  sessionResumeHint: string;
}

export interface WorkspaceManagerHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface WorkspaceManagerReportData {
  generatedAt: string;
  existingWorkspaceManagerCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  moduleManagementStatus: string;
  workspaceManagementStatus: string;
  sessionRecoveryStatus: string;
  outputManagementStatus: string;
  healthMonitoringStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep7: string[];
}

export interface WorkspaceManagerStore {
  modules: StudioModuleRecord[];
  workspaces: WorkspaceRecord[];
  sessions: SessionRecord[];
  events: InternalEvent[];
  messages: InternalMessage[];
  sharedContext: SharedContext;
  config: Record<ConfigDomain, Record<string, unknown>>;
  configHistory: ConfigChangeRecord[];
  runs: WorkspaceManagerResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
  lastSessionId: string | null;
}
