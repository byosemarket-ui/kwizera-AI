import { VideoAnalysisRecord, VideoLearningPattern } from "./types.js";
import { VideoPatternStore } from "./video-stores.js";
import { VideoKnowledgeLogger } from "./video-logger.js";
export declare class VideoLearner {
    private readonly patterns;
    private readonly logger;
    constructor(patterns: VideoPatternStore, logger: VideoKnowledgeLogger);
    learnFromAnalysis(record: VideoAnalysisRecord): VideoLearningPattern[];
    private createPattern;
}
//# sourceMappingURL=video-learner.d.ts.map