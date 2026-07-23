import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { VideoUnderstandingRecord, VideoUnderstandingRelationships } from "./types.js";
export declare class VideoUnderstandingLinker {
    detectRelationships(record: VideoUnderstandingRecord, allRecords: VideoUnderstandingRecord[], analysis: VideoAnalysisIntelligenceRecord, projects?: string[], knowledgeIds?: string[], storyboards?: string[], scripts?: string[], creativePlans?: string[]): VideoUnderstandingRelationships;
}
//# sourceMappingURL=video-understanding-linker.d.ts.map