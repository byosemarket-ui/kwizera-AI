import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { SceneDetectionIndexes, SceneDetectionRecord } from "./types.js";
export declare class SceneDetectionIndexer {
    private readonly foundation;
    constructor(foundation: AiVideoIntelligenceFoundation);
    createIndexes(record: SceneDetectionRecord, projectId?: string): SceneDetectionIndexes;
}
//# sourceMappingURL=scene-detection-indexer.d.ts.map