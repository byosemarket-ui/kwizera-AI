import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
export declare class KnowledgeStorageManager {
    private readonly logger;
    private knowledgeRoot;
    private registryDir;
    constructor(logger: KnowledgeFoundationLogger);
    initialize(storageRoot: string): string;
    getKnowledgeRoot(): string;
    getRegistryPath(): string;
    getCategoryPath(subdirectory: string): string;
    getQualityPath(): string;
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
//# sourceMappingURL=knowledge-storage.d.ts.map