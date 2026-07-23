import { ImageToImageGenerationRecord, ImageToImageScores, MaskPlan, PreservationPlan, SourceImageAnalysis, TransformationPlan, TransformationVariation, PlatformTransformationOptimization } from "./types.js";
import type { TransformationContext } from "./image-to-image-generation-analyzer.js";
export declare class ImageToImageGenerationScorer {
    computeScores(sourceAnalysis: SourceImageAnalysis, transformationPlan: TransformationPlan, preservationPlan: PreservationPlan, maskPlan: MaskPlan, platformOptimizations: PlatformTransformationOptimization[], variations: TransformationVariation[], context: TransformationContext): ImageToImageScores;
    isTransformationPlanValid(scores: ImageToImageScores, record: Pick<ImageToImageGenerationRecord, "sourceAnalysis" | "transformationPlan" | "maskPlan" | "preservationPlan">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: ImageToImageScores, record: ImageToImageGenerationRecord): boolean;
    isBrandConsistent(context: TransformationContext, preservationPlan: PreservationPlan): boolean;
    private computeTransformationQuality;
    private computeIdentityPreservation;
    private computeStyleConsistency;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=image-to-image-generation-scorer.d.ts.map