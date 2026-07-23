import { BackgroundAnalysis, BackgroundGenerationRecord, BackgroundGenerationScores, BackgroundGenerationPlan, BackgroundReplacementPlan, DepthPlanningPlan, LightingMatchingPlan, QualityImprovementPlan, SubjectPreservationPlan, BackgroundPlatformOptimization } from "./types.js";
import type { BackgroundGenerationContext } from "./background-generation-analyzer.js";
export declare class BackgroundGenerationScorer {
    computeScores(analysis: BackgroundAnalysis, preservation: SubjectPreservationPlan, generationPlan: BackgroundGenerationPlan, lightingMatching: LightingMatchingPlan, depthPlanning: DepthPlanningPlan, qualityImprovement: QualityImprovementPlan, replacementPlan: BackgroundReplacementPlan, platformOptimizations: BackgroundPlatformOptimization[], context: BackgroundGenerationContext): BackgroundGenerationScores;
    isBackgroundPlanValid(scores: BackgroundGenerationScores, record: Pick<BackgroundGenerationRecord, "backgroundAnalysis" | "subjectPreservation" | "lightingMatching" | "depthPlanning" | "generationPlan">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: BackgroundGenerationScores, record: BackgroundGenerationRecord): boolean;
    isBrandConsistent(context: BackgroundGenerationContext, generationPlan: BackgroundGenerationPlan): boolean;
    private computeBackgroundQuality;
    private computeSubjectPreservation;
    private computeLightingConsistency;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=background-generation-scorer.d.ts.map