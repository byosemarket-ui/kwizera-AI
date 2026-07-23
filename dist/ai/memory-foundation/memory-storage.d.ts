import { MemoryFoundationLogger } from "./memory-logger.js";
export declare class MemoryStorageManager {
    private readonly logger;
    private memoryRoot;
    private registryDir;
    private backupsDir;
    private protectedDir;
    constructor(logger: MemoryFoundationLogger);
    initialize(storageRoot: string): string;
    getMemoryRoot(): string;
    getRegistryPath(): string;
    getCategoryPath(subdirectory: string): string;
    getBackupsDir(): string;
    getProtectedDir(): string;
    verifyPersistence(): {
        passed: boolean;
        pathsVerified: number;
        detail: string;
    };
    writeCategoryData(subdirectory: string, filename: string, data: unknown): number;
    readCategoryData<T>(subdirectory: string, filename: string): {
        data: T | null;
        durationMs: number;
    };
}
//# sourceMappingURL=memory-storage.d.ts.map