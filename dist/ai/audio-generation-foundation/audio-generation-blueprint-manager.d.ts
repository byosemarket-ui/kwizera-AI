import { AudioGenerationBlueprint } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";
export declare class AudioGenerationBlueprintManager {
    private readonly logger;
    private blueprints;
    private blueprintsPath;
    private catalogPath;
    constructor(logger: AudioGenerationFoundationLogger);
    initialize(storage: AudioGenerationStorageManager): void;
    createBlueprint(input: {
        blueprintId?: string;
        projectId: string;
        name: string;
        multiProject?: boolean;
        multiTrack?: boolean;
        multiLanguage?: boolean;
        multiSpeaker?: boolean;
        multiPlatform?: boolean;
        multiQuality?: boolean;
        batchGeneration?: boolean;
        distributedGeneration?: boolean;
        cloudGenerationPrepared?: boolean;
        realTimePrepared?: boolean;
    }): AudioGenerationBlueprint;
    getBlueprint(blueprintId: string): AudioGenerationBlueprint | undefined;
    getBlueprintsByProject(projectId: string): AudioGenerationBlueprint[];
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
//# sourceMappingURL=audio-generation-blueprint-manager.d.ts.map