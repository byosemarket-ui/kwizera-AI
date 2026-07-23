import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { CompositionIntelligenceRecord, CompositionIntelligenceRelationships } from "./types.js";
export declare class CompositionLinker {
    detectRelationships(record: CompositionIntelligenceRecord, allRecords: CompositionIntelligenceRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, detection: ObjectDetectionRecord, background: BackgroundIntelligenceRecord | null, projects?: string[], knowledgeIds?: string[]): CompositionIntelligenceRelationships;
}
//# sourceMappingURL=composition-linker.d.ts.map