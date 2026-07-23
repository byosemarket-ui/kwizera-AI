import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import { CameraMovementRecord, CameraRelationships } from "./types.js";
export declare class CameraMovementLinker {
    detectRelationships(record: CameraMovementRecord, allRecords: CameraMovementRecord[], analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, timeline: TimelineIntelligenceRecord | null | undefined, projects?: string[], knowledgeIds?: string[], storyboards?: string[], scripts?: string[]): CameraRelationships;
}
//# sourceMappingURL=camera-movement-linker.d.ts.map