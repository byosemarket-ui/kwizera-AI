import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
export declare class ImageGenerationStorageManager {
    private readonly logger;
    private generationRoot;
    private registryDir;
    constructor(logger: ImageGenerationFoundationLogger);
    initialize(storageRoot: string): string;
    getGenerationRoot(): string;
    getRegistryPath(): string;
    getModulePath(subdirectory: string): string;
    getQualityPath(): string;
    getAssetsPath(): string;
    getProjectsPath(): string;
    getBlueprintsPath(): string;
    getWorkflowPath(): string;
    verifyPersistence(): {
        passed: boolean;
        pathsVerified: number;
        detail: string;
    };
}
//# sourceMappingURL=image-generation-storage.d.ts.map