import { VideoIntelligenceAccessRequest, VideoIntelligenceAccessResult } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceHistoryStore } from "./video-intelligence-history-store.js";
import { VideoIntelligenceRegistry } from "./video-intelligence-registry.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
export declare class VideoIntelligenceAccessCoordinator {
    private readonly logger;
    private readonly history;
    private readonly registry;
    private readonly storage;
    private totalRequests;
    private readTimes;
    private writeTimes;
    constructor(logger: VideoIntelligenceFoundationLogger, history: VideoIntelligenceHistoryStore, registry: VideoIntelligenceRegistry, storage: VideoIntelligenceStorageManager);
    requestAccess(request: VideoIntelligenceAccessRequest): Promise<VideoIntelligenceAccessResult>;
    private recordAccess;
    getAverageReadMs(): number;
    getAverageWriteMs(): number;
    getTotalRequests(): number;
    private hasPermission;
}
//# sourceMappingURL=video-intelligence-access-coordinator.d.ts.map