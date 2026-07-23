import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
export declare class VideoIntelligenceStorageManager {
    private readonly logger;
    private intelligenceRoot;
    private registryDir;
    constructor(logger: VideoIntelligenceFoundationLogger);
    initialize(storageRoot: string): string;
    getIntelligenceRoot(): string;
    getRegistryPath(): string;
    getModulePath(subdirectory: string): string;
    getQualityPath(): string;
    getAssetsPath(): string;
    getIndexesPath(): string;
    getProjectsPath(): string;
    getWorkflowPath(): string;
    verifyPersistence(): {
        passed: boolean;
        pathsVerified: number;
        detail: string;
    };
}
//# sourceMappingURL=video-intelligence-storage.d.ts.map