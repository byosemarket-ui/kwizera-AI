import {
  AssetValidationEntry,
  DependencyValidationEntry,
  ImageProductionRecord,
  ImageProductionScores,
  ProductionStructure,
  WorkflowValidationEntry,
} from "./types.js";
import type { ImageProductionContext } from "./image-production-analyzer.js";

export class ImageProductionScorer {
  computeScores(
    workflowValidation: WorkflowValidationEntry[],
    assetValidation: AssetValidationEntry[],
    dependencyValidation: DependencyValidationEntry[],
    productionStructure: ProductionStructure,
    context: ImageProductionContext
  ): ImageProductionScores {
    const workflowScore = this.computeWorkflowScore(workflowValidation);
    const assetReadinessScore = this.computeAssetReadiness(assetValidation, context);
    const dependencyScore = this.computeDependencyScore(dependencyValidation);
    const layerIntegrityScore = this.computeLayerIntegrity(productionStructure);
    const productionReadinessScore = this.computeProductionReadiness(
      workflowScore,
      assetReadinessScore,
      dependencyScore,
      layerIntegrityScore
    );
    const performanceScore = this.computePerformanceScore(workflowValidation, assetValidation);
    const aiConfidenceScore = Math.round(
      (workflowScore + assetReadinessScore + dependencyScore + layerIntegrityScore + productionReadinessScore + performanceScore) / 6
    );

    return {
      productionReadinessScore,
      assetReadinessScore,
      workflowScore,
      layerIntegrityScore,
      dependencyScore,
      performanceScore,
      aiConfidenceScore,
    };
  }

  isProductionPlanValid(
    scores: ImageProductionScores,
    record: Pick<
      ImageProductionRecord,
      "workflowValidation" | "assetValidation" | "dependencyValidation" | "productionStructure" | "renderPreparation" | "exportPreparation"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.assetReadinessScore < 55) {
      diagnostics.push(`Asset readiness score ${scores.assetReadinessScore} below threshold (55)`);
    }
    if (scores.workflowScore < 55) {
      diagnostics.push(`Workflow score ${scores.workflowScore} below threshold (55)`);
    }
    if (scores.layerIntegrityScore < 55) {
      diagnostics.push(`Layer integrity score ${scores.layerIntegrityScore} below threshold (55)`);
    }
    if (scores.dependencyScore < 55) {
      diagnostics.push(`Dependency score ${scores.dependencyScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    const failedWorkflows = record.workflowValidation.filter((w) => !w.validated);
    if (failedWorkflows.length > 0) {
      diagnostics.push(`Workflow validation failed for: ${failedWorkflows.map((w) => w.stage).join(", ")}`);
    }

    const missingDeps = record.dependencyValidation.filter((d) => !d.available);
    if (missingDeps.length > 0) {
      diagnostics.push(`Missing dependencies: ${missingDeps.map((d) => d.dependency).join(", ")}`);
    }

    if (record.productionStructure.layerStructure.length < 3) {
      diagnostics.push("Insufficient layer structure (minimum 3 layers)");
    }
    if (record.renderPreparation.instructions.length < 2) {
      diagnostics.push("Render preparation incomplete");
    }
    if (record.exportPreparation.exports.length < 4) {
      diagnostics.push("Insufficient export formats planned (minimum 4)");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: ImageProductionScores, record: ImageProductionRecord): boolean {
    return (
      scores.productionReadinessScore >= 55 &&
      scores.workflowScore >= 55 &&
      scores.dependencyScore >= 55 &&
      record.workflowValidation.every((w) => w.validated) &&
      record.dependencyValidation.every((d) => d.available) &&
      record.renderPreparation.instructions.length >= 2
    );
  }

  isBrandConsistent(context: ImageProductionContext, structure: ProductionStructure): boolean {
    if (!context.brandName && !context.brandId) {
      return structure.colorManagement.brandColors.length >= 1;
    }
    const brandRef = (context.brandName ?? context.brandId ?? "").toLowerCase();
    return structure.colorManagement.brandColors.some((c) => c.toLowerCase().includes(brandRef.split("-")[0] ?? brandRef));
  }

  private computeWorkflowScore(workflowValidation: WorkflowValidationEntry[]): number {
    const validated = workflowValidation.filter((w) => w.validated).length;
    const ratio = validated / Math.max(workflowValidation.length, 1);
    return Math.min(100, Math.round(45 + ratio * 55));
  }

  private computeAssetReadiness(assetValidation: AssetValidationEntry[], context: ImageProductionContext): number {
    const validated = assetValidation.filter((a) => a.validated).length;
    let score = Math.min(100, Math.round(40 + (validated / Math.max(assetValidation.length, 1)) * 45));
    if (context.productImagePlan) score += 5;
    if (context.brandingPlan) score += 5;
    if (context.stylePlan) score += 5;
    return Math.min(100, score);
  }

  private computeDependencyScore(dependencyValidation: DependencyValidationEntry[]): number {
    const available = dependencyValidation.filter((d) => d.available).length;
    const ratio = available / Math.max(dependencyValidation.length, 1);
    return Math.min(100, Math.round(45 + ratio * 55));
  }

  private computeLayerIntegrity(structure: ProductionStructure): number {
    let score = 45;
    if (structure.layerStructure.length >= 5) score += 20;
    if (structure.maskStructure.length >= 2) score += 15;
    if (structure.objectHierarchy.length >= 4) score += 10;
    if (structure.assetHierarchy.length >= 4) score += 10;
    return Math.min(100, score);
  }

  private computeProductionReadiness(
    workflowScore: number,
    assetScore: number,
    dependencyScore: number,
    layerScore: number
  ): number {
    return Math.round((workflowScore + assetScore + dependencyScore + layerScore) / 4);
  }

  private computePerformanceScore(
    workflowValidation: WorkflowValidationEntry[],
    assetValidation: AssetValidationEntry[]
  ): number {
    const workflowEfficiency = workflowValidation.filter((w) => w.validated).length / Math.max(workflowValidation.length, 1);
    const assetEfficiency = assetValidation.filter((a) => a.validated).length / Math.max(assetValidation.length, 1);
    return Math.min(100, Math.round(50 + (workflowEfficiency + assetEfficiency) * 25));
  }
}
