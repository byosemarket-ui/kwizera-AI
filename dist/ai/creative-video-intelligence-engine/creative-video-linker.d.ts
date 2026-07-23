import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import { CreativeRelationships, CreativeVideoIntelligenceRecord } from "./types.js";
export declare class CreativeVideoLinker {
    detectRelationships(record: CreativeVideoIntelligenceRecord, allRecords: CreativeVideoIntelligenceRecord[], analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, motion: MotionIntelligenceRecord | null | undefined, camera: CameraMovementRecord | null | undefined, enhancement: VideoEnhancementPlanRecord | null | undefined, style: VideoStyleIntelligenceRecord | null | undefined, projects?: string[], knowledgeIds?: string[], storyboards?: string[], scripts?: string[]): CreativeRelationships;
}
//# sourceMappingURL=creative-video-linker.d.ts.map