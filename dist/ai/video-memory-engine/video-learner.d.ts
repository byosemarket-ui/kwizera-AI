import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { VideoMemoryLogger } from "./video-logger.js";
import { VideoLearningResult, VideoRecord } from "./types.js";
export declare class VideoLearner {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: VideoMemoryLogger);
    learnFromCompletedVideo(video: VideoRecord, patternsStored: number): Promise<VideoLearningResult>;
    private identifyStrengths;
    private identifyWeaknesses;
    private buildLearningDescription;
}
//# sourceMappingURL=video-learner.d.ts.map