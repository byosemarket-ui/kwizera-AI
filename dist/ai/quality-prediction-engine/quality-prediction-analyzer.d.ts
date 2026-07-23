import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { AudienceIntelligenceRecord } from "../audience-intelligence-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import type { ProductionPlanningRecord } from "../production-planning-engine/types.js";
import { PlatformQualityEvaluation, QualityAnalysisSummary, QualityChecks, QualityPredictionInput, QualityPredictionProfile, QualityPredictions, QualityRecommendations, QualityScores, RiskItem } from "./types.js";
export declare class QualityPredictionAnalyzer {
    buildProfile(input: QualityPredictionInput, productionPlan: ProductionPlanningRecord, version: number): QualityPredictionProfile;
    buildAnalysisSummary(understanding: ProductUnderstandingRecord, audience: AudienceIntelligenceRecord | null, strategy: MarketingStrategyRecord, creative: CreativeDirectionRecord, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, productionPlan: ProductionPlanningRecord): QualityAnalysisSummary;
    computeScores(understanding: ProductUnderstandingRecord, audience: AudienceIntelligenceRecord | null, strategy: MarketingStrategyRecord, creative: CreativeDirectionRecord, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, productionPlan: ProductionPlanningRecord, checks: QualityChecks): QualityScores;
    runQualityChecks(storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, productionPlan: ProductionPlanningRecord, creative: CreativeDirectionRecord): QualityChecks;
    detectRisks(checks: QualityChecks, productionPlan: ProductionPlanningRecord, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, scores: QualityScores, audience: AudienceIntelligenceRecord | null): RiskItem[];
    buildPredictions(scores: QualityScores, risks: RiskItem[], storyboard: StoryboardIntelligenceRecord): QualityPredictions;
    buildRecommendations(scores: QualityScores, risks: RiskItem[], storyboard: StoryboardIntelligenceRecord, platform: CreativePlatform): QualityRecommendations;
    buildPlatformQuality(storyboard: StoryboardIntelligenceRecord, scores: QualityScores): PlatformQualityEvaluation;
    hasUnresolvedCriticalRisks(risks: RiskItem[]): boolean;
    applySafeRiskRepairs(risks: RiskItem[], checks: QualityChecks): RiskItem[];
}
//# sourceMappingURL=quality-prediction-analyzer.d.ts.map