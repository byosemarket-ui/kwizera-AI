import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { SceneDetectionAnalyzer } from "./scene-detection-analyzer.js";
import { SceneDetectionLinker } from "./scene-detection-linker.js";
import { SceneDetectionLogger } from "./scene-detection-logger.js";
import { SceneDetectionScorer } from "./scene-detection-scorer.js";
import { SceneDetectionRecordStore } from "./scene-detection-stores.js";
import { SceneClassification, SceneDetectionInput, SceneDetectionRecord, SceneDetectionResult, SceneDetectionSearchQuery, ShotType, TransitionType } from "./types.js";
export declare class SceneDetectionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    private readonly indexer;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: SceneDetectionAnalyzer, scorer: SceneDetectionScorer, linker: SceneDetectionLinker, records: SceneDetectionRecordStore, logger: SceneDetectionLogger);
    detect(input: SceneDetectionInput): Promise<SceneDetectionResult>;
    search(query: SceneDetectionSearchQuery): SceneDetectionRecord[];
}
export { SceneClassification, ShotType, TransitionType };
//# sourceMappingURL=scene-detection-processor.d.ts.map