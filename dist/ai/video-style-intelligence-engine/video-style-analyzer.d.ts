import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { BrandStyleAnalysis, CinematicStyleClass, EditingStyleAnalysis, StyleRecommendation, StyleTemplate, VideoStyleProfile, VisualStyleAnalysis } from "./types.js";
export declare class VideoStyleAnalyzer {
    private readonly templateLibrary;
    analyze(analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, timeline: TimelineIntelligenceRecord | null | undefined, camera: CameraMovementRecord | null | undefined, motion: MotionIntelligenceRecord | null | undefined, understanding: VideoUnderstandingRecord | null | undefined, industry?: string): {
        profile: VideoStyleProfile;
        visualStyle: VisualStyleAnalysis;
        editingStyle: EditingStyleAnalysis;
        cinematicStyles: CinematicStyleClass[];
        dominantCinematicStyle: CinematicStyleClass;
        brandStyle: BrandStyleAnalysis;
        templates: StyleTemplate[];
        recommendations: StyleRecommendation[];
        keywords: string[];
    };
    private inferStyleCategory;
    private inferIndustry;
    private analyzeVisualStyle;
    private analyzeEditingStyle;
    private classifyCinematicStyle;
    private analyzeBrandStyle;
    private buildRecommendations;
}
//# sourceMappingURL=video-style-analyzer.d.ts.map