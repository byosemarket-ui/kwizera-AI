import { AssetValidationEntry, AudioProductionRecord, AudioProductionScores, DependencyValidationEntry, ProductionStructure, WorkflowValidationEntry } from "./types.js";
import type { AudioProductionContext } from "./audio-production-analyzer.js";
export declare class AudioProductionScorer {
    computeScores(workflowValidation: WorkflowValidationEntry[], assetValidation: AssetValidationEntry[], dependencyValidation: DependencyValidationEntry[], productionStructure: ProductionStructure, context: AudioProductionContext): AudioProductionScores;
    isProductionPlanValid(scores: AudioProductionScores, record: Pick<AudioProductionRecord, "workflowValidation" | "assetValidation" | "trackValidation" | "dependencyValidation" | "productionStructure" | "renderPreparation" | "exportPreparation">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: AudioProductionScores, record: AudioProductionRecord): boolean;
    isBrandConsistent(context: AudioProductionContext, structure: ProductionStructure): boolean;
    private computeWorkflowScore;
    private computeAssetReadiness;
    private computeDependencyScore;
    private computeTrackIntegrity;
    private computeProductionReadiness;
    private computePerformanceScore;
}
//# sourceMappingURL=audio-production-scorer.d.ts.map