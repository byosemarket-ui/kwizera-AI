import { CompositionPlan, ColorPlan, ImageVariation, LightingPlan, PlatformImageOptimization, PromptAnalysis, StylePlan, TextToImageGenerationRecord, TextToImageScores } from "./types.js";
import type { GenerationContext } from "./text-to-image-generation-analyzer.js";
export declare class TextToImageGenerationScorer {
    computeScores(promptAnalysis: PromptAnalysis, compositionPlan: CompositionPlan, lightingPlan: LightingPlan, stylePlan: StylePlan, colorPlan: ColorPlan, platformOptimizations: PlatformImageOptimization[], variations: ImageVariation[], context: GenerationContext): TextToImageScores;
    isImagePlanValid(scores: TextToImageScores, record: Pick<TextToImageGenerationRecord, "promptAnalysis" | "compositionPlan" | "lightingPlan">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: TextToImageScores, record: TextToImageGenerationRecord): boolean;
    isBrandConsistent(context: GenerationContext, colorPlan: ColorPlan, stylePlan: StylePlan): boolean;
    private computePromptQuality;
    private computeCompositionScore;
    private computeStyleScore;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=text-to-image-generation-scorer.d.ts.map