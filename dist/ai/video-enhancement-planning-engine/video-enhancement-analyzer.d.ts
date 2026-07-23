import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { AudioEnhancementPlan, CinematicEnhancementPlan, VideoEnhancementPlatform, EnhancementProfile, EnhancementRecommendation, EnhancementVersionEntry, MotionEnhancementPlan, NonDestructivePolicy, PlatformOptimizationRule, VideoQualityAnalysis, VisualEnhancementPlan } from "./types.js";
export declare class VideoEnhancementAnalyzer {
    private readonly platformOptimizer;
    analyze(analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, timeline: TimelineIntelligenceRecord | null | undefined, camera: CameraMovementRecord | null | undefined, motion: MotionIntelligenceRecord | null | undefined, style: VideoStyleIntelligenceRecord | null | undefined, understanding: VideoUnderstandingRecord | null | undefined, projectId?: string, platform?: VideoEnhancementPlatform): {
        profile: EnhancementProfile;
        qualityAnalysis: VideoQualityAnalysis;
        visualPlan: VisualEnhancementPlan;
        audioPlan: AudioEnhancementPlan;
        motionPlan: MotionEnhancementPlan;
        cinematicPlan: CinematicEnhancementPlan;
        platformOptimizations: PlatformOptimizationRule[];
        nonDestructive: NonDestructivePolicy;
        versionHistory: EnhancementVersionEntry[];
        recommendations: EnhancementRecommendation[];
        keywords: string[];
    };
    private inferPlatform;
    private analyzeQuality;
    private buildVisualPlan;
    private buildAudioPlan;
    private buildMotionPlan;
    private buildCinematicPlan;
    private buildNonDestructivePolicy;
    private buildProfile;
    private buildRecommendations;
}
//# sourceMappingURL=video-enhancement-analyzer.d.ts.map