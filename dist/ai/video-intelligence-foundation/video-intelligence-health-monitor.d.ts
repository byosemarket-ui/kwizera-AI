import { VideoIntelligenceHealthReport, VideoIntelligenceModuleRegistration } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceAccessCoordinator } from "./video-intelligence-access-coordinator.js";
import { VideoIntelligenceRegistry } from "./video-intelligence-registry.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
import { VideoAssetRegistry } from "./video-asset-registry.js";
import { FrameIndexManager } from "./frame-index-manager.js";
import { NonDestructiveWorkflow } from "./non-destructive-workflow.js";
export declare class VideoIntelligenceHealthMonitor {
    private readonly logger;
    private lastReport;
    constructor(logger: VideoIntelligenceFoundationLogger);
    runHealthCheck(storage: VideoIntelligenceStorageManager, registry: VideoIntelligenceRegistry, access: VideoIntelligenceAccessCoordinator, assetRegistry: VideoAssetRegistry, frameIndex: FrameIndexManager, workflow: NonDestructiveWorkflow, integrationReady: boolean): Promise<VideoIntelligenceHealthReport>;
    getLastReport(): VideoIntelligenceHealthReport | null;
    verifyRegistryHealth(modules: VideoIntelligenceModuleRegistration[]): boolean;
    private scoreToLevel;
    verifyLogDirectory(logDir: string): boolean;
    verifyStorageWritable(intelligenceRoot: string): boolean;
}
//# sourceMappingURL=video-intelligence-health-monitor.d.ts.map