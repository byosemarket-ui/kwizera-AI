import { ImageGenerationBlueprint } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
export declare class ImageGenerationBlueprintManager {
    private readonly logger;
    private blueprints;
    private blueprintsPath;
    private catalogPath;
    constructor(logger: ImageGenerationFoundationLogger);
    initialize(storage: ImageGenerationStorageManager): void;
    createBlueprint(input: {
        blueprintId?: string;
        projectId: string;
        name: string;
        multiProject?: boolean;
        multiImage?: boolean;
        multiLanguage?: boolean;
        multiPlatform?: boolean;
        multiResolution?: boolean;
        batchGeneration?: boolean;
        distributedGeneration?: boolean;
        cloudGenerationPrepared?: boolean;
    }): ImageGenerationBlueprint;
    getBlueprint(blueprintId: string): ImageGenerationBlueprint | undefined;
    getBlueprintsByProject(projectId: string): ImageGenerationBlueprint[];
    getCount(): number;
    verifyIntegrity(): {
        valid: boolean;
        issues: string[];
    };
    repairSafeIssues(): void;
    private buildDefaultStages;
    private loadFromDisk;
    private persist;
}
//# sourceMappingURL=generation-blueprint-manager.d.ts.map