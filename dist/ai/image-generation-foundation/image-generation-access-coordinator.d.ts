import { ImageGenerationAccessRequest, ImageGenerationAccessResult } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationHistoryStore } from "./image-generation-history-store.js";
import { ImageGenerationRegistry } from "./image-generation-registry.js";
export declare class ImageGenerationAccessCoordinator {
    private readonly logger;
    private readonly history;
    private readonly registry;
    private totalRequests;
    private readTimes;
    private writeTimes;
    constructor(logger: ImageGenerationFoundationLogger, history: ImageGenerationHistoryStore, registry: ImageGenerationRegistry);
    requestAccess(request: ImageGenerationAccessRequest): Promise<ImageGenerationAccessResult>;
    getAverageReadMs(): number;
    getAverageWriteMs(): number;
    getTotalRequests(): number;
    private hasPermission;
}
//# sourceMappingURL=image-generation-access-coordinator.d.ts.map