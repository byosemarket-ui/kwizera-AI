import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { CreativeImageIntelligenceRecord, CreativeImageIntelligenceRelationships } from "./types.js";
export declare class CreativeImageLinker {
    detectRelationships(record: CreativeImageIntelligenceRecord, allRecords: CreativeImageIntelligenceRecord[], analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, composition: CompositionIntelligenceRecord, brandVisual: BrandVisualIntelligenceRecord, enhancementPlan: ImageEnhancementPlanningRecord | null, projects?: string[], knowledgeIds?: string[]): CreativeImageIntelligenceRelationships;
}
//# sourceMappingURL=creative-image-linker.d.ts.map