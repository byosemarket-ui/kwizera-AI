import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import { TimelineIntelligenceRecord, TimelineRelationships } from "./types.js";
export declare class TimelineIntelligenceLinker {
    detectRelationships(record: TimelineIntelligenceRecord, allRecords: TimelineIntelligenceRecord[], analysis: VideoAnalysisIntelligenceRecord, sceneDetection: SceneDetectionRecord, projects?: string[], knowledgeIds?: string[], storyboards?: string[], scripts?: string[], audioPlans?: string[], productionPlans?: string[]): TimelineRelationships;
}
//# sourceMappingURL=timeline-intelligence-linker.d.ts.map