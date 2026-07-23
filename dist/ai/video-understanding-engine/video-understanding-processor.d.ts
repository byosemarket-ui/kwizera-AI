import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoUnderstandingAnalyzer } from "./video-understanding-analyzer.js";
import { VideoUnderstandingLinker } from "./video-understanding-linker.js";
import { VideoUnderstandingLogger } from "./video-understanding-logger.js";
import { VideoUnderstandingScorer } from "./video-understanding-scorer.js";
import { VideoUnderstandingRecordStore } from "./video-understanding-stores.js";
import { VideoUnderstandingInput, VideoUnderstandingRecord, VideoUnderstandingResult, VideoUnderstandingSearchQuery } from "./types.js";
export declare class VideoUnderstandingProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    private readonly graphBuilder;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: VideoUnderstandingAnalyzer, scorer: VideoUnderstandingScorer, linker: VideoUnderstandingLinker, records: VideoUnderstandingRecordStore, logger: VideoUnderstandingLogger);
    understand(input: VideoUnderstandingInput): Promise<VideoUnderstandingResult>;
    search(query: VideoUnderstandingSearchQuery): VideoUnderstandingRecord[];
}
//# sourceMappingURL=video-understanding-processor.d.ts.map