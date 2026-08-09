/** Platform Step 1 — Personal Project Workspace types (single-user, local-only). */

export const PERSONAL_PROJECT_WORKSPACE_VERSION = "1.0";

export type WorkspaceProjectType =
  | "ai"
  | "product"
  | "marketing"
  | "video"
  | "image"
  | "knowledge"
  | "learning";

export type WorkspaceProjectStatus =
  | "draft"
  | "active"
  | "paused"
  | "rendering"
  | "completed"
  | "archived";

export type WorkspaceHistoryKind =
  | "creation"
  | "editing"
  | "render"
  | "export"
  | "learning"
  | "improvement"
  | "autosave"
  | "recovery";

export interface ProductInformation {
  productName?: string;
  category?: string;
  brand?: string;
  notes?: string;
}

export interface WorkspaceProjectRecord {
  projectId: string;
  projectName: string;
  projectType: WorkspaceProjectType;
  description: string;
  productInformation: ProductInformation;
  productAssets: string[];
  knowledgeUsed: string[];
  workflowUsed: string | null;
  creationDate: string;
  lastModified: string;
  currentStatus: WorkspaceProjectStatus;
  version: number;
  tags: string[];
  keywords: string[];
  unfinished: boolean;
  rootPath: string;
}

export interface WorkspaceHistoryEntry {
  id: string;
  projectId: string;
  kind: WorkspaceHistoryKind;
  summary: string;
  timestamp: string;
  version: number;
}

export interface WorkspaceDashboard {
  recentProjects: WorkspaceProjectRecord[];
  activeProjects: WorkspaceProjectRecord[];
  completedProjects: WorkspaceProjectRecord[];
  renderQueue: Array<{ projectId: string; projectName: string; status: string }>;
  storageUsage: {
    projectCount: number;
    historyCount: number;
    estimatedBytes: number;
  };
  aiStatus: string;
  knowledgeStatus: string;
}

export interface WorkspaceSearchQuery {
  projectName?: string;
  productName?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  status?: WorkspaceProjectStatus;
  keywords?: string[];
  text?: string;
}

export interface CreateWorkspaceProjectInput {
  projectName: string;
  projectType: WorkspaceProjectType;
  description?: string;
  productInformation?: ProductInformation;
  tags?: string[];
  keywords?: string[];
  workflowUsed?: string;
  knowledgeUsed?: string[];
}

export interface PersonalProjectWorkspaceResult {
  runId: string;
  version: typeof PERSONAL_PROJECT_WORKSPACE_VERSION;
  processedAt: string;
  projects: WorkspaceProjectRecord[];
  dashboard: WorkspaceDashboard;
  issuesFound: string[];
  issuesRepaired: string[];
  userFilesOverwritten: false;
  historyDeleted: false;
  singleUserOnly: true;
  localStorageOnly: true;
  localAssetLibraryDeferred: false;
  summary: string;
}

export interface AiMePersonalWorkspaceAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  singleUserOnly: true;
  canCreateProjects: boolean;
  canOpenProjects: boolean;
  canResumeProjects: boolean;
  canSearchProjects: boolean;
  canExplainProjectHistory: boolean;
  canContinueUnfinishedWork: boolean;
  localAssetLibraryDeferred: false;
  summary: string;
}

export interface PersonalWorkspaceExplainResult {
  projectId?: string;
  projectSummary: string;
  historyExplanation: string;
  unfinishedWork: string;
  nextAction: string;
}

export interface PersonalWorkspaceHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface PersonalWorkspaceReportData {
  generatedAt: string;
  existingWorkspaceCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  projectManagementStatus: string;
  autoSaveStatus: string;
  searchCapability: string;
  recoveryCapability: string;
  workspaceDashboardStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep2: string[];
}

export interface PersonalProjectWorkspaceStore {
  workspaceId: string;
  singleUserId: "local-user";
  projects: WorkspaceProjectRecord[];
  history: WorkspaceHistoryEntry[];
  workspaceState: {
    lastSavedAt: string | null;
    aiState: Record<string, string>;
    openProjectIds: string[];
  };
  recoveryCheckpoint: {
    at: string | null;
    openProjectIds: string[];
    projectVersions: Record<string, number>;
  };
  runs: PersonalProjectWorkspaceResult[];
  logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}

export const WORKSPACE_FOLDERS = [
  "Projects",
  "Images",
  "Videos",
  "Audio",
  "Assets",
  "Knowledge",
  "Exports",
  "Templates",
  "Cache",
  "Logs",
  "Backups",
  "Settings",
  "History",
] as const;
