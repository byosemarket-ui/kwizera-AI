import { VideoGenerationHealthReport } from "./types.js";
import { GenerationAssetRegistry } from "./generation-asset-registry.js";
import { GenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { VideoGenerationAccessCoordinator } from "./video-generation-access-coordinator.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationRegistry } from "./video-generation-registry.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";
export declare class VideoGenerationHealthMonitor {
    private readonly logger;
    constructor(logger: VideoGenerationFoundationLogger);
    runHealthCheck(storage: VideoGenerationStorageManager, registry: VideoGenerationRegistry, access: VideoGenerationAccessCoordinator, assetRegistry: GenerationAssetRegistry, blueprintManager: GenerationBlueprintManager, workflow: NonDestructiveGenerationWorkflow, integrationReady: boolean): Promise<VideoGenerationHealthReport>;
    private scoreToLevel;
    verifyLogDirectory(logDir: string): boolean;
    verifyStorageWritable(generationRoot: string): boolean;
}
//# sourceMappingURL=video-generation-health-monitor.d.ts.map