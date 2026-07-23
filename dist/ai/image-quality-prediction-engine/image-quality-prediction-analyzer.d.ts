import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { CreativeImageIntelligenceRecord } from "../creative-image-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { LightingColorIntelligenceRecord } from "../lighting-color-intelligence-engine/types.js";
import type { ProductionImagePlanningRecord } from "../production-image-planning-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { ImageQualityAnalysisSummary, ImageQualityChecks, ImageQualityPlatformEvaluation, ImageQualityPredictionPlatform, ImageQualityPredictionProfile, ImageQualityPredictions, ImageQualityRecommendation, ImageQualityRiskItem, ImageQualityRiskSeverity } from "./types.js";
export interface UpstreamQualityContext {
    analysis: ImageAnalysisIntelligenceRecord;
    understanding: ImageUnderstandingRecord;
    detection: ObjectDetectionRecord;
    background: BackgroundIntelligenceRecord;
    composition: CompositionIntelligenceRecord;
    lightingColor: LightingColorIntelligenceRecord;
    brandVisual: BrandVisualIntelligenceRecord;
    enhancementPlan: ImageEnhancementPlanningRecord;
    creativePlan: CreativeImageIntelligenceRecord;
    productionPlan: ProductionImagePlanningRecord;
}
export declare class ImageQualityPredictionAnalyzer {
    buildFromIntelligence(ctx: UpstreamQualityContext, projectId?: string, campaign?: string, platform?: ImageQualityPredictionPlatform): {
        profile: ImageQualityPredictionProfile;
        analysisSummary: ImageQualityAnalysisSummary;
        checks: ImageQualityChecks;
        predictions: ImageQualityPredictions;
        risks: ImageQualityRiskItem[];
        platformQuality: ImageQualityPlatformEvaluation[];
        recommendations: ImageQualityRecommendation[];
        keywords: string[];
    };
    private mapPlatform;
    private buildAnalysisSummary;
    private buildQualityChecks;
    private detectRisks;
    private buildPredictions;
    private buildPlatformQuality;
    private platformRuleNote;
    private buildRecommendations;
    highestRiskLevel(risks: ImageQualityRiskItem[]): ImageQualityRiskSeverity;
}
//# sourceMappingURL=image-quality-prediction-analyzer.d.ts.map