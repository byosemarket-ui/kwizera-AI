export type DesktopPermission = "filesystem.read" | "filesystem.write" | "filesystem.delete" | "filesystem.watch" | "folder.manage" | "project.access" | "model.access" | "database.access" | "system.resources.read" | "desktop.application.manage" | "desktop.process.execute" | "desktop.roots.manage" | "filesystem.critical-delete";
export type DesktopOperation = "create" | "read" | "update" | "delete" | "copy" | "move" | "rename" | "search" | "watch" | "backup" | "recovery";
export interface DesktopRoot {
    id: string;
    path: string;
    label: string;
    projectRoot: boolean;
    registeredAt: string;
}
export interface FileIntegrity {
    path: string;
    algorithm: "sha256";
    hash: string;
    sizeBytes: number;
    modifiedAt: string;
}
export interface FileSearchResult {
    path: string;
    relativePath: string;
    sizeBytes: number;
    modifiedAt: string;
}
export interface LocalBackup {
    id: string;
    rootId: string;
    relativePath: string;
    backupPath: string;
    operation: DesktopOperation;
    createdAt: string;
    isDirectory: boolean;
}
export interface DesktopEvent {
    at: string;
    event: "file" | "folder" | "desktop" | "system" | "resource" | "security" | "recovery";
    operation: string;
    rootId?: string;
    relativePath?: string;
    detail: string;
}
export interface EnvironmentSnapshot {
    operatingSystem: {
        platform: string;
        release: string;
        architecture: string;
        hostname: string;
    };
    cpu: {
        model: string;
        cores: number;
        usagePercent: number;
    };
    gpu: {
        available: boolean;
        name: string;
        memoryMb?: number;
        driver?: string;
    };
    ram: {
        totalMb: number;
        freeMb: number;
        usedMb: number;
    };
    storage: {
        totalMb: number;
        freeMb: number;
        usedMb: number;
    };
    temperature?: {
        celsius: number;
        source: string;
    };
    installedModels: string[];
    installedDependencies: string[];
    capturedAt: string;
}
export interface LocalApplication {
    id: string;
    command: string;
    fixedArgs: string[];
    rootId: string;
    status: "registered" | "running" | "stopped" | "failed";
    processId?: number;
}
export interface DesktopIntegrationStatus {
    initialized: boolean;
    rootCount: number;
    watcherCount: number;
    backupCount: number;
    integrations: Record<string, boolean>;
}
//# sourceMappingURL=types.d.ts.map