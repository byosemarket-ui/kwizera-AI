import { VideoGenerationAccessRequest, VideoGenerationAccessResult } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationHistoryStore } from "./video-generation-history-store.js";
import { VideoGenerationRegistry } from "./video-generation-registry.js";
export declare class VideoGenerationAccessCoordinator {
    private readonly logger;
    private readonly history;
    private readonly registry;
    private totalRequests;
    private readTimes;
    private writeTimes;
    constructor(logger: VideoGenerationFoundationLogger, history: VideoGenerationHistoryStore, registry: VideoGenerationRegistry);
    requestAccess(request: VideoGenerationAccessRequest): Promise<VideoGenerationAccessResult>;
    getAverageReadMs(): number;
    getAverageWriteMs(): number;
    getTotalRequests(): number;
    private hasPermission;
}
//# sourceMappingURL=video-generation-access-coordinator.d.ts.map