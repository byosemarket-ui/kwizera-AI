import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
export declare class AudioGenerationStorageManager {
    private readonly logger;
    private generationRoot;
    private registryDir;
    constructor(logger: AudioGenerationFoundationLogger);
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
//# sourceMappingURL=audio-generation-storage.d.ts.map