import { GenerationBlueprint } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";
export declare class GenerationBlueprintManager {
    private readonly logger;
    private blueprints;
    private blueprintsPath;
    private catalogPath;
    constructor(logger: VideoGenerationFoundationLogger);
    initialize(storage: VideoGenerationStorageManager): void;
    createBlueprint(input: {
        blueprintId?: string;
        projectId: string;
        name: string;
        multiProject?: boolean;
        multiVideo?: boolean;
        multiScene?: boolean;
        multiTimeline?: boolean;
        multiLanguage?: boolean;
        multiPlatform?: boolean;
        batchGeneration?: boolean;
        distributedGeneration?: boolean;
        cloudGenerationPrepared?: boolean;
    }): GenerationBlueprint;
    getBlueprint(blueprintId: string): GenerationBlueprint | undefined;
    getBlueprintsByProject(projectId: string): GenerationBlueprint[];
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