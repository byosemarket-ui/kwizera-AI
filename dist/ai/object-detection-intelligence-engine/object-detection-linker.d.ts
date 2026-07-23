import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { ObjectDetectionRecord, ObjectDetectionRelationships } from "./types.js";
export declare class ObjectDetectionLinker {
    detectRelationships(record: ObjectDetectionRecord, allRecords: ObjectDetectionRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, projects?: string[], knowledgeIds?: string[]): ObjectDetectionRelationships;
}
//# sourceMappingURL=object-detection-linker.d.ts.map