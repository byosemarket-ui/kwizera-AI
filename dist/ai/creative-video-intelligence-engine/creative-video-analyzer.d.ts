import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { CreativeAudioPlan, CreativeMarketingPlan, CreativeRecommendation, CreativeStructure, CreativeVideoPlatform, CreativeVideoProfile, CreativeVideoTemplate, CreativeVideoType, CreativeVisualPlan, PlatformCreativePlan, ProductionInstructions, StoryboardPlan } from "./types.js";
export declare class CreativeVideoAnalyzer {
    private readonly templateLibrary;
    analyze(analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, understanding: VideoUnderstandingRecord | null | undefined, style: VideoStyleIntelligenceRecord | null | undefined, motion: MotionIntelligenceRecord | null | undefined, camera: CameraMovementRecord | null | undefined, enhancement: VideoEnhancementPlanRecord | null | undefined, projectId?: string, platform?: CreativeVideoPlatform, creativeType?: CreativeVideoType): {
        profile: CreativeVideoProfile;
        creativeType: CreativeVideoType;
        storyboard: StoryboardPlan;
        structure: CreativeStructure;
        visualPlan: CreativeVisualPlan;
        audioPlan: CreativeAudioPlan;
        marketingPlan: CreativeMarketingPlan;
        platformPlans: PlatformCreativePlan[];
        templates: CreativeVideoTemplate[];
        productionInstructions: ProductionInstructions;
        recommendations: CreativeRecommendation[];
        keywords: string[];
    };
    private inferPlatform;
    private inferCreativeType;
    private buildProfile;
    private buildStoryboard;
    private buildStructure;
    private buildVisualPlan;
    private buildAudioPlan;
    private buildMarketingPlan;
    private buildPlatformPlans;
    private isSocialPlatform;
    private platformNotes;
    private buildProductionInstructions;
    private buildRecommendations;
}
//# sourceMappingURL=creative-video-analyzer.d.ts.map