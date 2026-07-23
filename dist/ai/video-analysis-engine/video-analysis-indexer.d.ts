import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoAnalysisIndexes, VideoAnalysisIntelligenceRecord } from "./types.js";
export declare class VideoAnalysisIndexer {
    private readonly foundation;
    constructor(foundation: AiVideoIntelligenceFoundation);
    createIndexes(record: VideoAnalysisIntelligenceRecord, projectId?: string): VideoAnalysisIndexes;
}
//# sourceMappingURL=video-analysis-indexer.d.ts.map