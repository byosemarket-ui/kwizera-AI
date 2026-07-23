import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { BackgroundIntelligenceRecord } from "../background-intelligence-engine/types.js";
import type { BrandVisualIntelligenceRecord } from "../brand-visual-intelligence-engine/types.js";
import type { CompositionIntelligenceRecord } from "../composition-intelligence-engine/types.js";
import type { LightingColorIntelligenceRecord } from "../lighting-color-intelligence-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ObjectDetectionRecord } from "../object-detection-intelligence-engine/types.js";
import { BackgroundEnhancementPlanning, EnhancementPlanningSteps, EnhancementPlatform, ImageEnhancementPlanningRecommendation, ImageEnhancementProfile, ImageQualityAnalysis, PlatformOptimizationRules, RestorationPlanning } from "./types.js";
export declare class EnhancementPlanningAnalyzer {
    buildFromIntelligence(analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord, detection: ObjectDetectionRecord | null, background: BackgroundIntelligenceRecord | null, composition: CompositionIntelligenceRecord | null, lightingColor: LightingColorIntelligenceRecord | null, brandVisual: BrandVisualIntelligenceRecord | null, projectId?: string, platform?: EnhancementPlatform): {
        profile: ImageEnhancementProfile;
        qualityAnalysis: ImageQualityAnalysis;
        enhancementPlan: EnhancementPlanningSteps;
        restorationPlan: RestorationPlanning;
        backgroundPlan: BackgroundEnhancementPlanning;
        platformOptimization: PlatformOptimizationRules;
        recommendations: ImageEnhancementPlanningRecommendation[];
        keywords: string[];
    };
    private buildQualityAnalysis;
    private buildEnhancementPlan;
    private exposurePlan;
    private buildRestorationPlan;
    private buildBackgroundPlan;
    private buildPlatformRules;
    private buildRecommendations;
}
//# sourceMappingURL=enhancement-planning-analyzer.d.ts.map