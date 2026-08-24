/** Workspace State, Session, Project Memory & Auto Save types */

import type { DesktopPreferences } from "../../desktop-polish/types";
import type { DashboardLayoutV2 } from "../../dashboard/types";
import type {
  LayoutManagerState, NavigationState, ShellLayoutState, WorkspaceId,
} from "../types";

export type SaveMode = "manual" | "auto" | "background" | "incremental" | "emergency";

export type HistoryCategory =
  | "workspace"
  | "layout"
  | "project"
  | "production"
  | "ai"
  | "session"
  | "settings";

export interface WorkspaceUiState {
  activeSidebar: "left" | "right" | "none";
  activeTabs: Record<string, string>;
  scrollPositions: Record<string, number>;
  selectedItems: string[];
  zoomLevel: number;
}

export interface ProjectMemoryRecord {
  projectId: string | null;
  projectName: string | null;
  productInformation: Record<string, unknown>;
  uploadedImages: Array<{ id: string; name: string; sizeBytes?: number }>;
  marketingSettings: Record<string, unknown>;
  storyboardProgress: number;
  productionProgress: number;
  renderingProgress: number;
  exportSettings: Record<string, unknown>;
  aiDecisions: Array<{ id: string; summary: string; at: string }>;
  updatedAt: string;
}

export interface WorkspaceSession {
  id: string;
  startedAt: string;
  lastActiveAt: string;
  closedAt: string | null;
  durationMs: number;
  workspace: WorkspaceId;
  projectId: string | null;
  projectName: string | null;
  layoutId: string | null;
  cleanShutdown: boolean;
}

export interface WorkspaceHistoryEntry {
  id: string;
  category: HistoryCategory;
  summary: string;
  at: string;
  snapshotId?: string;
}

export interface WorkspaceStateSnapshot {
  version: 1;
  id: string;
  savedAt: string;
  saveMode: SaveMode;
  cleanShutdown: boolean;
  checksum: string;
  session: WorkspaceSession;
  shell: ShellLayoutState;
  navigation: NavigationState;
  layoutManager: LayoutManagerState;
  preferences: DesktopPreferences;
  dashboard?: DashboardLayoutV2;
  projectMemory: ProjectMemoryRecord;
  ui: WorkspaceUiState;
}

export interface SessionRegistry {
  version: 1;
  currentSessionId: string | null;
  sessions: WorkspaceSession[];
  lastClosedProject: string | null;
}

export interface WorkspaceHistoryLog {
  version: 1;
  entries: WorkspaceHistoryEntry[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RestoreReport {
  restored: boolean;
  source: "session" | "emergency" | "backup" | "fresh" | "none";
  explanation: string;
  snapshotId: string | null;
  recoveredFromCrash: boolean;
}

export interface AutoSaveStatus {
  enabled: boolean;
  mode: SaveMode;
  lastSavedAt: string | null;
  lastError: string | null;
  dirty: boolean;
  inProgress: boolean;
}

export interface AiMeStateContext {
  sessionId: string | null;
  sessionDurationLabel: string;
  lastSavedAt: string | null;
  autoSaveEnabled: boolean;
  dirty: boolean;
  projectName: string | null;
  restoreExplanation: string;
  historyCount: number;
  recommendation: string;
  explanation: string;
}
