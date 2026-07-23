import { BackupManifest } from "./types.js";
export declare class BackupVersionStore {
    private registryPath;
    private manifests;
    initialize(backupsRoot: string): void;
    getNextVersion(): number;
    add(manifest: BackupManifest): void;
    getAll(): BackupManifest[];
    getById(backupId: string): BackupManifest | undefined;
    getLatest(): BackupManifest | undefined;
    getRegistryPath(): string;
    private persist;
}
//# sourceMappingURL=backup-version-store.d.ts.map