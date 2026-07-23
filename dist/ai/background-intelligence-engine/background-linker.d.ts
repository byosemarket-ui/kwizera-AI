import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { BackgroundIntelligenceRecord, BackgroundIntelligenceRelationships } from "./types.js";
export declare class BackgroundLinker {
    detectRelationships(record: BackgroundIntelligenceRecord, allRecords: BackgroundIntelligenceRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, detection: ObjectDetectionRecord, projects?: string[], knowledgeIds?: string[]): BackgroundIntelligenceRelationships;
}
//# sourceMappingURL=background-linker.d.ts.map