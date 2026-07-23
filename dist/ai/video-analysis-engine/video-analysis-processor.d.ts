import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoAnalysisAnalyzer } from "./video-analysis-analyzer.js";
import { VideoAnalysisCompletenessDetector } from "./video-analysis-completeness.js";
import { VideoAnalysisLinker } from "./video-analysis-linker.js";
import { VideoAnalysisLogger } from "./video-analysis-logger.js";
import { VideoAnalysisScorer } from "./video-analysis-scorer.js";
import { VideoAnalysisRecordStore } from "./video-analysis-stores.js";
import { VideoAnalysisEngineInput, VideoAnalysisEngineResult, VideoAnalysisIntelligenceRecord, VideoAnalysisSearchQuery } from "./types.js";
export declare class VideoAnalysisProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly completeness;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    private readonly indexer;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: VideoAnalysisAnalyzer, completeness: VideoAnalysisCompletenessDetector, scorer: VideoAnalysisScorer, linker: VideoAnalysisLinker, records: VideoAnalysisRecordStore, logger: VideoAnalysisLogger);
    analyze(input: VideoAnalysisEngineInput): Promise<VideoAnalysisEngineResult>;
    search(query: VideoAnalysisSearchQuery): VideoAnalysisIntelligenceRecord[];
}
//# sourceMappingURL=video-analysis-processor.d.ts.map