import fs from "node:fs";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiToolManager } from "../tool-management/tool-manager.js";
import type { DesktopEvent, DesktopIntegrationStatus, DesktopOperation, DesktopPermission, DesktopRoot, EnvironmentSnapshot, FileIntegrity, FileSearchResult, LocalApplication, LocalBackup } from "./types.js";
/** Official local-environment boundary. All file paths are relative to registered roots. */
export declare class AiDesktopIntegrationManager {
    readonly files: FileSystemManager;
    readonly folders: FolderManager;
    readonly environment: LocalEnvironmentManager;
    private root;
    private core;
    private tools;
    private initialized;
    private readonly roots;
    private readonly backups;
    private readonly watchers;
    private readonly applications;
    private readonly processes;
    private readonly events;
    initialize(core: AiCoreManager, tools: AiToolManager, storageRoot: string): Promise<void>;
    isInitialized(): boolean;
    shutdown(): Promise<void>;
    listRoots(): DesktopRoot[];
    listBackups(): LocalBackup[];
    listEvents(): ReadonlyArray<DesktopEvent>;
    registerRoot(id: string, rootPath: string, label: string, projectRoot: boolean, permissions: DesktopPermission[]): Promise<DesktopRoot>;
    unregisterRoot(id: string, permissions: DesktopPermission[]): Promise<void>;
    verifyProject(rootId?: string, relativePath?: string, permissions?: DesktopPermission[]): Promise<{
        valid: boolean;
        files: number;
        aggregateHash: string;
    }>;
    monitorResources(): Promise<EnvironmentSnapshot>;
    createTemporaryFile(name: string, data: string | Uint8Array, permissions: DesktopPermission[]): Promise<string>;
    clearTemporaryFiles(permissions: DesktopPermission[]): Promise<number>;
    clearCache(permissions: DesktopPermission[]): Promise<number>;
    recoverBackup(backupId: string, permissions: DesktopPermission[]): Promise<void>;
    registerApplication(id: string, command: string, fixedArgs: string[], rootId: string, permissions: DesktopPermission[]): Promise<void>;
    startApplication(id: string, args: string[], permissions: DesktopPermission[]): Promise<LocalApplication>;
    stopApplication(id: string, permissions: DesktopPermission[]): Promise<void>;
    getStatus(): DesktopIntegrationStatus;
    resolve(rootId: string, relativePath: string, permissions: DesktopPermission[], operation: DesktopOperation): Promise<{
        root: DesktopRoot;
        path: string;
    }>;
    backup(rootId: string, relativePath: string, operation: DesktopOperation, permissions: DesktopPermission[]): Promise<LocalBackup | null>;
    assertDeletable(rootId: string, relativePath: string, permissions: DesktopPermission[]): void;
    watcher(id: string, watcher?: fs.FSWatcher): fs.FSWatcher | undefined;
    stopWatcher(id: string): boolean;
    log(event: DesktopEvent["event"], operation: string, rootId: string | undefined, relativePath: string | undefined, detail: string): Promise<void>;
    relative(root: string, target: string): string;
    integrityForAbsolute: (filePath: string) => Promise<FileIntegrity & {
        relativePath?: string;
    }>;
    requirePermission(permissions: DesktopPermission[], required: DesktopPermission): void;
    private requireOperationPermission;
    private requireRoot;
    private ensureReady;
    private restore;
    private persist;
}
export declare class FileSystemManager {
    private readonly desktop;
    constructor(desktop: AiDesktopIntegrationManager);
    create(rootId: string, relativePath: string, data: string | Uint8Array, permissions: DesktopPermission[]): Promise<void>;
    read(rootId: string, relativePath: string, permissions: DesktopPermission[]): Promise<Buffer>;
    update(rootId: string, relativePath: string, data: string | Uint8Array, permissions: DesktopPermission[]): Promise<void>;
    delete(rootId: string, relativePath: string, permissions: DesktopPermission[]): Promise<void>;
    copy(rootId: string, source: string, destination: string, permissions: DesktopPermission[]): Promise<void>;
    move(rootId: string, source: string, destination: string, permissions: DesktopPermission[]): Promise<void>;
    rename(rootId: string, source: string, name: string, permissions: DesktopPermission[]): Promise<void>;
    search(rootId: string, relativePath: string, query: string, permissions: DesktopPermission[]): Promise<FileSearchResult[]>;
    verifyIntegrity(rootId: string, relativePath: string, permissions: DesktopPermission[]): Promise<FileIntegrity>;
    watch(rootId: string, relativePath: string, onChange: (event: string, changedPath: string) => void, permissions: DesktopPermission[]): Promise<string>;
    unwatch(id: string): Promise<void>;
}
export declare class FolderManager {
    private readonly desktop;
    constructor(desktop: AiDesktopIntegrationManager);
    create(rootId: string, relativePath: string, permissions: DesktopPermission[]): Promise<void>;
    delete(rootId: string, relativePath: string, permissions: DesktopPermission[]): Promise<void>;
    copy(rootId: string, source: string, destination: string, permissions: DesktopPermission[]): Promise<void>;
    move(rootId: string, source: string, destination: string, permissions: DesktopPermission[]): Promise<void>;
    scan(rootId: string, relativePath: string, permissions: DesktopPermission[]): Promise<FileSearchResult[]>;
    watch(rootId: string, relativePath: string, onChange: (event: string, changedPath: string) => void, permissions: DesktopPermission[]): Promise<string>;
    organize(rootId: string, relativePath: string, permissions: DesktopPermission[]): Promise<void>;
}
export declare class LocalEnvironmentManager {
    private readonly desktop;
    constructor(desktop: AiDesktopIntegrationManager);
    detect(): Promise<EnvironmentSnapshot>;
}
//# sourceMappingURL=desktop-integration-manager.d.ts.map