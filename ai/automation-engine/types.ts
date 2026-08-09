/** Platform Step 5 — Automation Engine & Studio Maintenance types (single-user, local-only). */

export const AUTOMATION_ENGINE_VERSION = "1.0";

export type MaintenanceSchedule = "hourly" | "daily" | "weekly" | "monthly" | "manual";

export type AutomationTaskName =
  | "project-auto-save"
  | "workspace-auto-save"
  | "incremental-backup"
  | "cache-cleanup"
  | "temporary-file-cleanup"
  | "log-rotation"
  | "index-optimization"
  | "database-optimization"
  | "knowledge-index-refresh"
  | "asset-index-refresh"
  | "project-integrity-check";

export type AutomationTaskStatus = "pending" | "running" | "completed" | "failed" | "rolled-back" | "skipped";

export interface AutomationTaskDefinition {
  name: AutomationTaskName;
  schedule: MaintenanceSchedule;
  description: string;
  touchesUserAssets: false;
  touchesValidatedKnowledge: false;
}

export interface AutomationLogEntry {
  taskId: string;
  taskName: AutomationTaskName;
  executionTime: string;
  durationMs: number;
  result: AutomationTaskStatus;
  errors: string[];
  recoveryActions: string[];
  timestamp: string;
  detail: string;
}

export interface RestorePoint {
  restorePointId: string;
  kind: "project" | "knowledge" | "settings" | "workflow" | "ai-configuration";
  createdAt: string;
  path: string;
  verified: boolean;
  sizeBytes: number;
  label: string;
}

export interface StorageOptimizationSnapshot {
  at: string;
  availableStorageMb: number | null;
  cacheSizeMb: number;
  backupSizeMb: number;
  databaseSizeMb: number;
  recommendation: string | null;
}

export interface AutomationTaskResult {
  taskId: string;
  taskName: AutomationTaskName;
  status: AutomationTaskStatus;
  durationMs: number;
  detail: string;
  errors: string[];
  recoveryActions: string[];
  backupVerifiedBeforeCleanup: boolean;
  userProjectsDeleted: false;
  userAssetsDeleted: false;
  validatedKnowledgeDeleted: false;
}

export interface AutomationEngineResult {
  runId: string;
  version: typeof AUTOMATION_ENGINE_VERSION;
  processedAt: string;
  schedule: MaintenanceSchedule | "mixed";
  tasks: AutomationTaskResult[];
  restorePointsCreated: string[];
  storage: StorageOptimizationSnapshot;
  issuesFound: string[];
  issuesRepaired: string[];
  userProjectsDeleted: false;
  userAssetsDeleted: false;
  validatedKnowledgeDeleted: false;
  singleUserOnly: true;
  localMachineOnly: true;
  workspaceManagerDeferred: false;
  summary: string;
}

export interface AiMeAutomationEngineAwareness {
  available: boolean;
  enabled: boolean;
  offlineFirst: boolean;
  singleUserOnly: true;
  canExplainMaintenanceTasks: boolean;
  canRecommendManualMaintenance: boolean;
  canPredictStorageProblems: boolean;
  canRecommendBackupFrequency: boolean;
  canExplainAutomationDecisions: boolean;
  workspaceManagerDeferred: false;
  summary: string;
}

export interface AutomationEngineExplainResult {
  completedTasksExplanation: string;
  manualMaintenanceRecommendation: string;
  storagePrediction: string;
  backupFrequencyRecommendation: string;
  automationDecisionExplanation: string;
}

export interface AutomationEngineHealthReport {
  healthy: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  repaired: string[];
  criticalIssues: string[];
}

export interface AutomationEngineReportData {
  generatedAt: string;
  existingAutomationCapability: string;
  componentsUpgraded: string[];
  componentsCreated: string[];
  scheduledTasksStatus: string;
  backupAutomationStatus: string;
  cleanupCapability: string;
  databaseMaintenanceStatus: string;
  knowledgeMaintenanceStatus: string;
  aiMeCapability: string;
  issuesFound: string[];
  issuesRepaired: string[];
  testResults: Array<{ name: string; passed: boolean; detail: string }>;
  remainingWorkBeforeStep6: string[];
}

export interface AutomationEngineStore {
  logs: AutomationLogEntry[];
  restorePoints: RestorePoint[];
  lastRunBySchedule: Partial<Record<MaintenanceSchedule, string>>;
  runs: AutomationEngineResult[];
  engineLogs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
}
