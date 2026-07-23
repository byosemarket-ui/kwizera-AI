import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { CreativeVideoIntelligenceRecord } from "../creative-video-intelligence-engine/types.js";
import type { ProductionVideoPlanningRecord } from "../production-video-planning-engine/types.js";
import { VideoQualityAnalysisSummary, VideoQualityChecks, VideoQualityPlatformEvaluation, VideoQualityPredictionPlatform, VideoQualityPredictionProfile, VideoQualityPredictions, VideoQualityRecommendation, VideoQualityRiskItem, VideoQualityRiskSeverity } from "./types.js";
export interface UpstreamVideoQualityContext {
    analysis: VideoAnalysisIntelligenceRecord;
    understanding: VideoUnderstandingRecord;
    sceneDetection: SceneDetectionRecord;
    timeline: TimelineIntelligenceRecord;
    camera: CameraMovementRecord;
    motion: MotionIntelligenceRecord;
    style: VideoStyleIntelligenceRecord;
    enhancementPlan: VideoEnhancementPlanRecord;
    creativePlan: CreativeVideoIntelligenceRecord;
    productionPlan: ProductionVideoPlanningRecord;
}
export declare class VideoQualityPredictionAnalyzer {
    buildFromIntelligence(ctx: UpstreamVideoQualityContext, projectId?: string, campaign?: string, platform?: VideoQualityPredictionPlatform): {
        profile: VideoQualityPredictionProfile;
        analysisSummary: VideoQualityAnalysisSummary;
        checks: VideoQualityChecks;
        predictions: VideoQualityPredictions;
        risks: VideoQualityRiskItem[];
        platformQuality: VideoQualityPlatformEvaluation[];
        recommendations: VideoQualityRecommendation[];
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
    highestRiskLevel(risks: VideoQualityRiskItem[]): VideoQualityRiskSeverity;
}
//# sourceMappingURL=video-quality-prediction-analyzer.d.ts.map