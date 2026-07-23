import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { LightingColorIntelligenceRecord } from "../lighting-color-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { ImageEnhancementPlanningRecord, ImageEnhancementPlanningRelationships } from "./types.js";
export declare class EnhancementPlanningLinker {
    detectRelationships(record: ImageEnhancementPlanningRecord, allRecords: ImageEnhancementPlanningRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, background: BackgroundIntelligenceRecord | null, composition: CompositionIntelligenceRecord | null, lightingColor: LightingColorIntelligenceRecord | null, projects?: string[], knowledgeIds?: string[]): ImageEnhancementPlanningRelationships;
}
//# sourceMappingURL=enhancement-planning-linker.d.ts.map