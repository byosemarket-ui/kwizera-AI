import { AssetValidationEntry, DependencyValidationEntry, ImageProductionRecord, ImageProductionScores, ProductionStructure, WorkflowValidationEntry } from "./types.js";
import type { ImageProductionContext } from "./image-production-analyzer.js";
export declare class ImageProductionScorer {
    computeScores(workflowValidation: WorkflowValidationEntry[], assetValidation: AssetValidationEntry[], dependencyValidation: DependencyValidationEntry[], productionStructure: ProductionStructure, context: ImageProductionContext): ImageProductionScores;
    isProductionPlanValid(scores: ImageProductionScores, record: Pick<ImageProductionRecord, "workflowValidation" | "assetValidation" | "dependencyValidation" | "productionStructure" | "renderPreparation" | "exportPreparation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: ImageProductionScores, record: ImageProductionRecord): boolean;
    isBrandConsistent(context: ImageProductionContext, structure: ProductionStructure): boolean;
    private computeWorkflowScore;
    private computeAssetReadiness;
    private computeDependencyScore;
    private computeLayerIntegrity;
    private computeProductionReadiness;
    private computePerformanceScore;
}
//# sourceMappingURL=image-production-scorer.d.ts.map