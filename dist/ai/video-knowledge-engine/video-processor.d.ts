import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { VideoAnalyzer } from "./video-analyzer.js";
import { VideoLearner } from "./video-learner.js";
import { VideoKnowledgeLogger } from "./video-logger.js";
import { VideoRelationshipLinker, VideoRecommender } from "./video-recommender.js";
import { VideoScorer } from "./video-scorer.js";
import { VideoRecordStore } from "./video-stores.js";
import { VideoAnalysisInput, VideoAnalysisRecord, VideoAnalysisResult, VideoSearchQuery } from "./types.js";
export declare class VideoProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private readonly learner;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, analyzer: VideoAnalyzer, scorer: VideoScorer, recommender: VideoRecommender, linker: VideoRelationshipLinker, learner: VideoLearner, records: VideoRecordStore, logger: VideoKnowledgeLogger);
    analyze(input: VideoAnalysisInput): Promise<VideoAnalysisResult>;
    search(query: VideoSearchQuery): Promise<VideoAnalysisRecord[]>;
    private filterLocal;
    private ensureGraphNode;
    private buildKnowledgeDescription;
}
//# sourceMappingURL=video-processor.d.ts.map