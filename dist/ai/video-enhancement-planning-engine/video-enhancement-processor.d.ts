import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoEnhancementAnalyzer } from "./video-enhancement-analyzer.js";
import { VideoEnhancementLinker } from "./video-enhancement-linker.js";
import { VideoEnhancementLogger } from "./video-enhancement-logger.js";
import { VideoEnhancementScorer } from "./video-enhancement-scorer.js";
import { VideoEnhancementRecordStore } from "./video-enhancement-stores.js";
import { VideoEnhancementPlatform, EnhancementType, VideoEnhancementPlanningInput, VideoEnhancementPlanRecord, VideoEnhancementPlanningResult, VideoEnhancementSearchQuery } from "./types.js";
export declare class VideoEnhancementProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: VideoEnhancementAnalyzer, scorer: VideoEnhancementScorer, linker: VideoEnhancementLinker, records: VideoEnhancementRecordStore, logger: VideoEnhancementLogger);
    planEnhancement(input: VideoEnhancementPlanningInput): Promise<VideoEnhancementPlanningResult>;
    search(query: VideoEnhancementSearchQuery): VideoEnhancementPlanRecord[];
    private reject;
}
export { VideoEnhancementPlatform, EnhancementType };
//# sourceMappingURL=video-enhancement-processor.d.ts.map