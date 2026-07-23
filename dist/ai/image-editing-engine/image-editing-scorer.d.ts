import { IdentityPreservationPlan, ImageAnalysisPlan, ImageEditOperationPlan, ImageEditPlatformOptimization, ImageEditingRecord, ImageEditingScores, ImageEditQualityImprovementPlan, InpaintingPlan, MaskManagementPlan, NonDestructiveEditingPlan, OutpaintingPlan } from "./types.js";
import type { ImageEditingContext } from "./image-editing-analyzer.js";
export declare class ImageEditingScorer {
    computeScores(analysis: ImageAnalysisPlan, operations: ImageEditOperationPlan, inpainting: InpaintingPlan, outpainting: OutpaintingPlan, preservation: IdentityPreservationPlan, maskManagement: MaskManagementPlan, quality: ImageEditQualityImprovementPlan, nonDestructive: NonDestructiveEditingPlan, platformOptimizations: ImageEditPlatformOptimization[], context: ImageEditingContext): ImageEditingScores;
    isEditingPlanValid(scores: ImageEditingScores, record: Pick<ImageEditingRecord, "imageAnalysis" | "editingOperations" | "inpaintingPlan" | "outpaintingPlan" | "maskManagement" | "identityPreservation" | "nonDestructiveEditing">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: ImageEditingScores, record: ImageEditingRecord): boolean;
    isBrandConsistent(context: ImageEditingContext, operations: ImageEditOperationPlan): boolean;
    private computeEditingQuality;
    private computeIdentityPreservation;
    private computeReconstruction;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=image-editing-scorer.d.ts.map