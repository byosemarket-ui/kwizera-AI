import { ImageGenerationHealthReport } from "./types.js";
import { GenerationAssetRegistry } from "./generation-asset-registry.js";
import { ImageGenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { NonDestructiveGenerationWorkflow } from "./non-destructive-generation-workflow.js";
import { ImageGenerationAccessCoordinator } from "./image-generation-access-coordinator.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationRegistry } from "./image-generation-registry.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
export declare class ImageGenerationHealthMonitor {
    private readonly logger;
    constructor(logger: ImageGenerationFoundationLogger);
    runHealthCheck(storage: ImageGenerationStorageManager, registry: ImageGenerationRegistry, access: ImageGenerationAccessCoordinator, assetRegistry: GenerationAssetRegistry, blueprintManager: ImageGenerationBlueprintManager, workflow: NonDestructiveGenerationWorkflow, integrationReady: boolean): Promise<ImageGenerationHealthReport>;
    private scoreToLevel;
    verifyLogDirectory(logDir: string): boolean;
    verifyStorageWritable(generationRoot: string): boolean;
}
//# sourceMappingURL=image-generation-health-monitor.d.ts.map