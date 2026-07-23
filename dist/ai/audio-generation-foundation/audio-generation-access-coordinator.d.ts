import { AudioGenerationAccessRequest, AudioGenerationAccessResult } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationHistoryStore } from "./audio-generation-history-store.js";
import { AudioGenerationRegistry } from "./audio-generation-registry.js";
export declare class AudioGenerationAccessCoordinator {
    private readonly logger;
    private readonly history;
    private readonly registry;
    private totalRequests;
    private readTimes;
    private writeTimes;
    constructor(logger: AudioGenerationFoundationLogger, history: AudioGenerationHistoryStore, registry: AudioGenerationRegistry);
    requestAccess(request: AudioGenerationAccessRequest): Promise<AudioGenerationAccessResult>;
    getAverageReadMs(): number;
    getAverageWriteMs(): number;
    getTotalRequests(): number;
    private hasPermission;
}
//# sourceMappingURL=audio-generation-access-coordinator.d.ts.map