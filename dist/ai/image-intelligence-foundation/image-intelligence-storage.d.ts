import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
export declare class ImageIntelligenceStorageManager {
    private readonly logger;
    private intelligenceRoot;
    private registryDir;
    constructor(logger: ImageIntelligenceFoundationLogger);
    initialize(storageRoot: string): string;
    getIntelligenceRoot(): string;
    getRegistryPath(): string;
    getModulePath(subdirectory: string): string;
    getQualityPath(): string;
    verifyPersistence(): {
        passed: boolean;
        pathsVerified: number;
        detail: string;
    };
}
//# sourceMappingURL=image-intelligence-storage.d.ts.map