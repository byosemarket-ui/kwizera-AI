import { ImageIntelligenceAccessRequest, ImageIntelligenceAccessResult } from "./types.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceHistoryStore } from "./image-intelligence-history-store.js";
import { ImageIntelligenceRegistry } from "./image-intelligence-registry.js";
import { ImageIntelligenceStorageManager } from "./image-intelligence-storage.js";
export declare class ImageIntelligenceAccessCoordinator {
    private readonly logger;
    private readonly history;
    private readonly registry;
    private readonly storage;
    private totalRequests;
    private readTimes;
    private writeTimes;
    constructor(logger: ImageIntelligenceFoundationLogger, history: ImageIntelligenceHistoryStore, registry: ImageIntelligenceRegistry, storage: ImageIntelligenceStorageManager);
    requestAccess(request: ImageIntelligenceAccessRequest): Promise<ImageIntelligenceAccessResult>;
    private recordAccess;
    getAverageReadMs(): number;
    getAverageWriteMs(): number;
    getTotalRequests(): number;
    private hasPermission;
}
//# sourceMappingURL=image-intelligence-access-coordinator.d.ts.map