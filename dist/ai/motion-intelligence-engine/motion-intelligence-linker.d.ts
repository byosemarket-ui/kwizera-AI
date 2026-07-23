import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { MotionIntelligenceRecord, MotionRelationships } from "./types.js";
export declare class MotionIntelligenceLinker {
    detectRelationships(record: MotionIntelligenceRecord, allRecords: MotionIntelligenceRecord[], analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, timeline: TimelineIntelligenceRecord | null | undefined, camera: CameraMovementRecord | null | undefined, projects?: string[], knowledgeIds?: string[], storyboards?: string[]): MotionRelationships;
}
//# sourceMappingURL=motion-intelligence-linker.d.ts.map