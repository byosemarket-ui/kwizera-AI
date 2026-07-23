import { EnhancementImageAnalysis, EnhancementOperationsPlan, EnhancementPlatformOptimization, EnhancementQualityImprovementPlan, ImageEnhancementRecord, ImageEnhancementScores, ImagePreservationPlan, PrintPreparationPlan, RestorationOperationsPlan, SuperResolutionPlan } from "./types.js";
import type { ImageEnhancementContext } from "./image-enhancement-analyzer.js";
export declare class ImageEnhancementScorer {
    computeScores(analysis: EnhancementImageAnalysis, operations: EnhancementOperationsPlan, restoration: RestorationOperationsPlan, preservation: ImagePreservationPlan, quality: EnhancementQualityImprovementPlan, printPreparation: PrintPreparationPlan, superResolution: SuperResolutionPlan, platformOptimizations: EnhancementPlatformOptimization[], context: ImageEnhancementContext): ImageEnhancementScores;
    isEnhancementPlanValid(scores: ImageEnhancementScores, record: Pick<ImageEnhancementRecord, "imageAnalysis" | "enhancementOperations" | "restorationOperations" | "preservation" | "printPreparation" | "superResolutionPlan">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: ImageEnhancementScores, record: ImageEnhancementRecord): boolean;
    isBrandConsistent(context: ImageEnhancementContext, operations: EnhancementOperationsPlan): boolean;
    private computeEnhancementScore;
    private computeRestorationScore;
    private computeSharpnessScore;
    private computeColorAccuracy;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=image-enhancement-scorer.d.ts.map