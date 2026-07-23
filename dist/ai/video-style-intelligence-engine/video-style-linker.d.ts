import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { StyleRelationships, VideoStyleIntelligenceRecord } from "./types.js";
export declare class VideoStyleLinker {
    detectRelationships(record: VideoStyleIntelligenceRecord, allRecords: VideoStyleIntelligenceRecord[], analysis: VideoAnalysisIntelligenceRecord, timeline: TimelineIntelligenceRecord | null | undefined, camera: CameraMovementRecord | null | undefined, motion: MotionIntelligenceRecord | null | undefined, projects?: string[], knowledgeIds?: string[], storyboards?: string[], creativePlans?: string[]): StyleRelationships;
}
//# sourceMappingURL=video-style-linker.d.ts.map