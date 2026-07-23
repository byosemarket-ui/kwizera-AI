import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { CameraMovementPlan, CameraMovementType, CameraRecommendation, CameraTransitionAnalysis, CinematicPurpose, ShotCameraAnalysis } from "./types.js";
export declare class CameraMovementAnalyzer {
    analyze(analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, timeline: TimelineIntelligenceRecord | null | undefined, understanding: VideoUnderstandingRecord | null | undefined): {
        shotAnalyses: ShotCameraAnalysis[];
        transitions: CameraTransitionAnalysis[];
        movementPlan: CameraMovementPlan;
        recommendations: CameraRecommendation[];
        keywords: string[];
        detectedMovements: CameraMovementType[];
        cinematicPurposes: CinematicPurpose[];
    };
    private analyzeShot;
    private inferMovement;
    private inferAngle;
    private inferFraming;
    private inferStability;
    private inferPurpose;
    private analyzeTransitions;
    private buildMovementPlan;
    private getDominantMovement;
    private buildRecommendations;
}
//# sourceMappingURL=camera-movement-analyzer.d.ts.map