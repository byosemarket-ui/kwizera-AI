import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import { ImageUnderstandingRecord, ImageUnderstandingRelationships } from "./types.js";
export declare class ImageUnderstandingLinker {
    detectRelationships(record: ImageUnderstandingRecord, allRecords: ImageUnderstandingRecord[], analysis: ImageAnalysisIntelligenceRecord, projects?: string[], knowledgeIds?: string[], storyboards?: string[]): ImageUnderstandingRelationships;
}
//# sourceMappingURL=image-understanding-linker.d.ts.map