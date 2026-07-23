import { ImageRenderRecord, ImageRenderScores, LayerValidationEntry, MaskValidationEntry, OutputProfileEntry, RenderAssetValidationEntry, RenderSettingsPlan, RenderValidationEntry, ResourcePlanningPlan } from "./types.js";
import type { ImageRenderContext } from "./image-render-analyzer.js";
export declare class ImageRenderScorer {
    computeScores(renderValidation: RenderValidationEntry[], layerValidation: LayerValidationEntry[], maskValidation: MaskValidationEntry[], assetValidation: RenderAssetValidationEntry[], renderSettings: RenderSettingsPlan, outputProfiles: OutputProfileEntry[], resourcePlanning: ResourcePlanningPlan, context: ImageRenderContext): ImageRenderScores;
    isRenderPlanValid(scores: ImageRenderScores, record: Pick<ImageRenderRecord, "renderValidation" | "layerValidation" | "maskValidation" | "assetValidation" | "renderSettings" | "resourcePlanning">): {
        valid: boolean;
        diagnostics: string[];
    };
    isRenderReady(scores: ImageRenderScores, record: ImageRenderRecord): boolean;
    isProductionReady(context: ImageRenderContext): boolean;
    private computeRenderValidationScore;
    private computeLayerIntegrity;
    private computeMaskIntegrity;
    private computeAssetQuality;
    private computePlatformCompatibility;
    private computePerformanceScore;
}
//# sourceMappingURL=image-render-scorer.d.ts.map