import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ObjectDetectionAnalyzer } from "./object-detection-analyzer.js";
import { ObjectDetectionLinker } from "./object-detection-linker.js";
import { ObjectDetectionLogger } from "./object-detection-logger.js";
import { ObjectDetectionScorer } from "./object-detection-scorer.js";
import { ObjectDetectionRecordStore } from "./object-detection-stores.js";
import { ObjectDetectionInput, ObjectDetectionRecord, ObjectDetectionResult, ObjectDetectionSearchQuery } from "./types.js";
export declare class ObjectDetectionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: ObjectDetectionAnalyzer, scorer: ObjectDetectionScorer, linker: ObjectDetectionLinker, records: ObjectDetectionRecordStore, logger: ObjectDetectionLogger);
    detect(input: ObjectDetectionInput): Promise<ObjectDetectionResult>;
    search(query: ObjectDetectionSearchQuery): ObjectDetectionRecord[];
}
//# sourceMappingURL=object-detection-processor.d.ts.map