import { AudioGenerationHealthReport } from "./types.js";
import { GenerationAssetRegistry } from "./audio-generation-asset-registry.js";
import { AudioGenerationBlueprintManager } from "./audio-generation-blueprint-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { AudioGenerationAccessCoordinator } from "./audio-generation-access-coordinator.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationRegistry } from "./audio-generation-registry.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";
export declare class AudioGenerationHealthMonitor {
    private readonly logger;
    constructor(logger: AudioGenerationFoundationLogger);
    runHealthCheck(storage: AudioGenerationStorageManager, registry: AudioGenerationRegistry, access: AudioGenerationAccessCoordinator, assetRegistry: GenerationAssetRegistry, blueprintManager: AudioGenerationBlueprintManager, workflow: NonDestructiveGenerationWorkflow, integrationReady: boolean): Promise<AudioGenerationHealthReport>;
    private scoreToLevel;
    verifyLogDirectory(logDir: string): boolean;
    verifyStorageWritable(generationRoot: string): boolean;
}
//# sourceMappingURL=audio-generation-health-monitor.d.ts.map