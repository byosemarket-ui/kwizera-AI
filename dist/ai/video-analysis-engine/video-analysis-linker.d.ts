import { VideoAnalysisIntelligenceRecord, VideoAnalysisRelationships, VideoClassification } from "./types.js";
export declare class VideoAnalysisLinker {
    detectRelationships(record: VideoAnalysisIntelligenceRecord, allRecords: VideoAnalysisIntelligenceRecord[], knowledgeIds?: string[], memoryRefs?: string[]): VideoAnalysisRelationships;
    classifySimilarity(a: VideoClassification, b: VideoClassification): number;
}
//# sourceMappingURL=video-analysis-linker.d.ts.map