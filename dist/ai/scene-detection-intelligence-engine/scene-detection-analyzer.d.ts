import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import { DetectedScene, DetectedShot, DetectedTransition, SceneDetectionRecommendation, SceneRelationship } from "./types.js";
export declare class SceneDetectionAnalyzer {
    detect(analysis: VideoAnalysisIntelligenceRecord, understanding?: VideoUnderstandingRecord | null): {
        scenes: DetectedScene[];
        shots: DetectedShot[];
        transitions: DetectedTransition[];
        sceneRelationships: SceneRelationship[];
        recommendations: SceneDetectionRecommendation[];
        keywords: string[];
    };
    private detectScenes;
    private classifyByOrder;
    private assignPriority;
    private inferPurpose;
    private detectShots;
    private inferShotType;
    private detectTransitions;
    private inferTransitionType;
    private buildSceneRelationships;
    private buildRecommendations;
}
//# sourceMappingURL=scene-detection-analyzer.d.ts.map