import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
export declare class VideoGenerationStorageManager {
    private readonly logger;
    private generationRoot;
    private registryDir;
    constructor(logger: VideoGenerationFoundationLogger);
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
//# sourceMappingURL=video-generation-storage.d.ts.map