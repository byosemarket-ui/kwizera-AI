import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { CreativeImageIntelligenceScores } from "./types.js";
export declare class CreativeImageScorer {
    computeScores(composition: CompositionIntelligenceRecord, brandVisual: BrandVisualIntelligenceRecord, understanding: ImageUnderstandingRecord, hasEnhancementPlan: boolean): CreativeImageIntelligenceScores;
    isPlanValid(scores: CreativeImageIntelligenceScores, brandVisual: BrandVisualIntelligenceRecord, composition: CompositionIntelligenceRecord): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=creative-image-scorer.d.ts.map