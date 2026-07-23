import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import { SceneDetectionRecord, SceneDetectionRelationships } from "./types.js";
export declare class SceneDetectionLinker {
    detectRelationships(record: SceneDetectionRecord, allRecords: SceneDetectionRecord[], analysis: VideoAnalysisIntelligenceRecord, projects?: string[], knowledgeIds?: string[], storyboards?: string[], scripts?: string[]): SceneDetectionRelationships;
}
//# sourceMappingURL=scene-detection-linker.d.ts.map