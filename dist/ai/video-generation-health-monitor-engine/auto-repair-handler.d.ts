import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationHealthMonitorLogger } from "./health-logger.js";
import { VideoGenerationAutoRepairResult, VideoGenerationHealthWarning } from "./types.js";
export declare class VideoGenerationAutoRepairHandler {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, logger: VideoGenerationHealthMonitorLogger);
    attemptRepairs(warnings: VideoGenerationHealthWarning[]): Promise<VideoGenerationAutoRepairResult>;
}
//# sourceMappingURL=auto-repair-handler.d.ts.map