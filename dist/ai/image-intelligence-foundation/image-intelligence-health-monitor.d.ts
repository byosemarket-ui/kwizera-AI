import { ImageIntelligenceHealthReport, ImageIntelligenceModuleRegistration } from "./types.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceAccessCoordinator } from "./image-intelligence-access-coordinator.js";
import { ImageIntelligenceRegistry } from "./image-intelligence-registry.js";
import { ImageIntelligenceStorageManager } from "./image-intelligence-storage.js";
export declare class ImageIntelligenceHealthMonitor {
    private readonly logger;
    private lastReport;
    constructor(logger: ImageIntelligenceFoundationLogger);
    runHealthCheck(storage: ImageIntelligenceStorageManager, registry: ImageIntelligenceRegistry, access: ImageIntelligenceAccessCoordinator, integrationReady: boolean): Promise<ImageIntelligenceHealthReport>;
    getLastReport(): ImageIntelligenceHealthReport | null;
    verifyRegistryHealth(modules: ImageIntelligenceModuleRegistration[]): boolean;
    private scoreToLevel;
    verifyLogDirectory(logDir: string): boolean;
    verifyStorageWritable(intelligenceRoot: string): boolean;
}
//# sourceMappingURL=image-intelligence-health-monitor.d.ts.map