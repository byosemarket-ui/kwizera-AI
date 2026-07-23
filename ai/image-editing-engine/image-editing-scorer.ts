import {
  IdentityPreservationPlan,
  ImageAnalysisPlan,
  ImageEditOperationPlan,
  ImageEditPlatformOptimization,
  ImageEditingRecord,
  ImageEditingScores,
  ImageEditQualityImprovementPlan,
  InpaintingPlan,
  MaskManagementPlan,
  NonDestructiveEditingPlan,
  OutpaintingPlan,
} from "./types.js";
import type { ImageEditingContext } from "./image-editing-analyzer.js";

export class ImageEditingScorer {
  computeScores(
    analysis: ImageAnalysisPlan,
    operations: ImageEditOperationPlan,
    inpainting: InpaintingPlan,
    outpainting: OutpaintingPlan,
    preservation: IdentityPreservationPlan,
    maskManagement: MaskManagementPlan,
    quality: ImageEditQualityImprovementPlan,
    nonDestructive: NonDestructiveEditingPlan,
    platformOptimizations: ImageEditPlatformOptimization[],
    context: ImageEditingContext
  ): ImageEditingScores {
    const editingQualityScore = this.computeEditingQuality(operations, quality, analysis);
    const identityPreservationScore = this.computeIdentityPreservation(preservation);
    const reconstructionScore = this.computeReconstruction(inpainting, outpainting, quality);
    const brandConsistencyScore = this.computeBrandConsistency(context, operations);
    const productionReadinessScore = this.computeProductionReadiness(
      maskManagement,
      quality,
      platformOptimizations,
      nonDestructive,
      operations
    );
    const aiConfidenceScore = Math.round(
      (editingQualityScore +
        identityPreservationScore +
        reconstructionScore +
        brandConsistencyScore +
        productionReadinessScore) /
        5
    );

    return {
      editingQualityScore,
      identityPreservationScore,
      reconstructionScore,
      brandConsistencyScore,
      productionReadinessScore,
      aiConfidenceScore,
    };
  }

  isEditingPlanValid(
    scores: ImageEditingScores,
    record: Pick<
      ImageEditingRecord,
      | "imageAnalysis"
      | "editingOperations"
      | "inpaintingPlan"
      | "outpaintingPlan"
      | "maskManagement"
      | "identityPreservation"
      | "nonDestructiveEditing"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.editingQualityScore < 55) {
      diagnostics.push(`Editing quality score ${scores.editingQualityScore} below threshold (55)`);
    }
    if (scores.identityPreservationScore < 55) {
      diagnostics.push(`Identity preservation score ${scores.identityPreservationScore} below threshold (55)`);
    }
    if (scores.reconstructionScore < 55) {
      diagnostics.push(`Reconstruction score ${scores.reconstructionScore} below threshold (55)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    if (!record.imageAnalysis.subject || record.imageAnalysis.subject.length < 5) {
      diagnostics.push("Image analysis incomplete");
    }
    if (record.editingOperations.operations.length < 1) {
      diagnostics.push("No editing operations planned");
    }
    if (!record.inpaintingPlan.reconstructionStrategy || record.inpaintingPlan.reconstructionStrategy.length < 10) {
      diagnostics.push("Inpainting plan incomplete");
    }
    if (!record.outpaintingPlan.expansionRatio || record.outpaintingPlan.expansionRatio.length < 5) {
      diagnostics.push("Outpainting plan incomplete");
    }
    if (record.maskManagement.masks.length < 4) {
      diagnostics.push("Insufficient mask management coverage (minimum 4)");
    }
    if (record.identityPreservation.targets.length < 6) {
      diagnostics.push("Insufficient identity preservation targets (minimum 6)");
    }
    if (!record.nonDestructiveEditing.originalPreserved) {
      diagnostics.push("Non-destructive original preservation not enabled");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: ImageEditingScores, record: ImageEditingRecord): boolean {
    return (
      scores.productionReadinessScore >= 55 &&
      scores.identityPreservationScore >= 55 &&
      scores.editingQualityScore >= 55 &&
      record.platformOptimizations.length >= 1 &&
      record.productionInstructions.renderNotes.length >= 1 &&
      record.nonDestructiveEditing.originalPreserved
    );
  }

  isBrandConsistent(context: ImageEditingContext, operations: ImageEditOperationPlan): boolean {
    if (!context.brandName) return operations.nonDestructiveNotes.length >= 2;
    return (
      operations.operationPrompts &&
      Object.values(operations.operationPrompts).some(
        (p) => p.toLowerCase().includes("brand") || p.toLowerCase().includes(context.brandName!.toLowerCase())
      )
    );
  }

  private computeEditingQuality(
    operations: ImageEditOperationPlan,
    quality: ImageEditQualityImprovementPlan,
    analysis: ImageAnalysisPlan
  ): number {
    let score = 45;
    if (operations.operations.length >= 2) score += 15;
    if (Object.keys(operations.operationPrompts).length >= 1) score += 10;
    if (quality.edgeQuality.length >= 10) score += 15;
    if (analysis.imageQuality.length >= 10) score += 15;
    return Math.min(100, score);
  }

  private computeIdentityPreservation(preservation: IdentityPreservationPlan): number {
    let score = 45;
    if (preservation.targets.length >= 6) score += 25;
    if (preservation.identityLock) score += 10;
    if (preservation.productLock) score += 10;
    if (preservation.logoLock && preservation.brandColorLock) score += 10;
    return Math.min(100, score);
  }

  private computeReconstruction(
    inpainting: InpaintingPlan,
    outpainting: OutpaintingPlan,
    quality: ImageEditQualityImprovementPlan
  ): number {
    let score = 45;
    if (inpainting.textureNotes.length >= 2) score += 15;
    if (inpainting.detailRecoveryNotes.length >= 2) score += 10;
    if (outpainting.sceneExtensionNotes.length >= 2) score += 15;
    if (quality.textureQuality.length >= 10) score += 15;
    return Math.min(100, score);
  }

  private computeBrandConsistency(context: ImageEditingContext, operations: ImageEditOperationPlan): number {
    let score = 45;
    if (context.brandGuidelines) score += 15;
    if (context.brandName) score += 15;
    if (operations.nonDestructiveNotes.length >= 2) score += 10;
    if (context.campaignId) score += 10;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    masks: MaskManagementPlan,
    quality: ImageEditQualityImprovementPlan,
    platforms: ImageEditPlatformOptimization[],
    nonDestructive: NonDestructiveEditingPlan,
    operations: ImageEditOperationPlan
  ): number {
    let score = 45;
    if (masks.masks.length >= 6) score += 15;
    if (quality.artifactPrevention && quality.sharpnessPlanning) score += 15;
    if (platforms.length >= 4) score += 10;
    if (nonDestructive.rollbackSupported && nonDestructive.originalPreserved) score += 10;
    if (operations.executionOrder.length >= 1) score += 10;
    return Math.min(100, score);
  }
}
