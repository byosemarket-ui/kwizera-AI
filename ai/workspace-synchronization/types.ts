export type WorkspaceSyncScope =
  | "creative-workspace"
  | "config"
  | "database"
  | "projects"
  | "exports"
  | "media"
  | "memory"
  | "knowledge"
  | "intelligence"
  | "state"
  | "learning";

export interface WorkspaceSyncEntry {
  path: string;
  scope: WorkspaceSyncScope;
  checksum: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface WorkspaceSyncQueueItem {
  id: string;
  path: string;
  checksum: string;
  queuedAt: string;
  reason: "local-change" | "conflict-local-wins";
}

export interface WorkspaceSyncConflict {
  id: string;
  path: string;
  localChecksum: string;
  remoteChecksum: string;
  detectedAt: string;
  resolution: "local-wins-pending-upload";
}

export interface WorkspaceCloudConfiguration {
  enabled: boolean;
  connectorId: string | null;
}

export interface WorkspaceBackupResult {
  backupId: string | null;
  archiveCreated: boolean;
  workspaceCopyCreated: boolean;
  diagnostics: string[];
}

export interface WorkspaceSynchronizationStatus {
  initialized: boolean;
  localSourceOfTruth: true;
  cloud: WorkspaceCloudConfiguration & { state: "disabled" | "not-configured" | "provider-adapter-required" };
  trackedFiles: number;
  queuedChanges: number;
  unresolvedConflicts: number;
  lastInventoryAt: string | null;
  lastBackupAt: string | null;
}

export interface WorkspaceSynchronizationDependencies {
  backup?: {
    createManualBackup(projectId?: string): Promise<{ backupId: string; success: boolean }>;
    restore(backupId: string, mode?: "selective", pathPrefixes?: string[]): Promise<{ success: boolean; diagnostics: string[] }>;
  };
  desktop?: {
    backup(rootId: string, relativePath: string, operation: "backup", permissions: string[]): Promise<{ id: string } | null>;
    recoverBackup(backupId: string, permissions: string[]): Promise<void>;
  };
}