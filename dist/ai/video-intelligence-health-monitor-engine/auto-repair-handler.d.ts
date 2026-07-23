import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { VideoIntelligenceAutoRepairResult, VideoIntelligenceHealthWarning } from "./types.js";
export declare class VideoIntelligenceAutoRepairHandler {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, logger: VideoIntelligenceHealthMonitorLogger);
    attemptRepairs(warnings: VideoIntelligenceHealthWarning[]): Promise<VideoIntelligenceAutoRepairResult>;
}
//# sourceMappingURL=auto-repair-handler.d.ts.map