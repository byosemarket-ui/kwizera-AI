import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { MotionAnalysisMetrics, MotionClassification, MotionEvent, MotionPlan, MotionRecommendation, ObjectMotionAnalysis, SubjectTrack } from "./types.js";
export declare class MotionIntelligenceAnalyzer {
    analyze(analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, timeline: TimelineIntelligenceRecord | null | undefined, camera: CameraMovementRecord | null | undefined, understanding: VideoUnderstandingRecord | null | undefined): {
        metrics: MotionAnalysisMetrics;
        objectMotions: ObjectMotionAnalysis[];
        subjectTracks: SubjectTrack[];
        motionEvents: MotionEvent[];
        classifications: MotionClassification[];
        dominantClassification: MotionClassification;
        motionPlan: MotionPlan;
        recommendations: MotionRecommendation[];
        keywords: string[];
    };
    private buildMetrics;
    private inferGlobalDirection;
    private inferSpeed;
    private analyzeObjectMotions;
    private objectMotion;
    private inferShotDirection;
    private buildSubjectTracks;
    private detectTrackGaps;
    private summarizeDirections;
    private detectMotionEvents;
    private classifyMotion;
    private getDominantClassification;
    private buildMotionPlan;
    private buildRecommendations;
}
//# sourceMappingURL=motion-intelligence-analyzer.d.ts.map