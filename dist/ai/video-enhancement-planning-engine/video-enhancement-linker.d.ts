import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import { EnhancementRelationships, VideoEnhancementPlanRecord } from "./types.js";
export declare class VideoEnhancementLinker {
    detectRelationships(record: VideoEnhancementPlanRecord, allRecords: VideoEnhancementPlanRecord[], analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, timeline: TimelineIntelligenceRecord | null | undefined, camera: CameraMovementRecord | null | undefined, motion: MotionIntelligenceRecord | null | undefined, style: VideoStyleIntelligenceRecord | null | undefined, projects?: string[], knowledgeIds?: string[]): EnhancementRelationships;
}
//# sourceMappingURL=video-enhancement-linker.d.ts.map