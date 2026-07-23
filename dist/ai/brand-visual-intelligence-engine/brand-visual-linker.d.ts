import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { BrandVisualIntelligenceRecord, BrandVisualIntelligenceRelationships } from "./types.js";
export declare class BrandVisualLinker {
    detectRelationships(record: BrandVisualIntelligenceRecord, allRecords: BrandVisualIntelligenceRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, detection: ObjectDetectionRecord, projects?: string[], knowledgeIds?: string[]): BrandVisualIntelligenceRelationships;
}
//# sourceMappingURL=brand-visual-linker.d.ts.map