import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { LightingColorIntelligenceRecord, LightingColorIntelligenceRelationships } from "./types.js";
export declare class LightingColorLinker {
    detectRelationships(record: LightingColorIntelligenceRecord, allRecords: LightingColorIntelligenceRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, composition: CompositionIntelligenceRecord | null, background: BackgroundIntelligenceRecord | null, projects?: string[], knowledgeIds?: string[]): LightingColorIntelligenceRelationships;
}
//# sourceMappingURL=lighting-color-linker.d.ts.map