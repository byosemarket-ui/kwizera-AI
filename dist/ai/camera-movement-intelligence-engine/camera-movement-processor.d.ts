import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { CameraMovementAnalyzer } from "./camera-movement-analyzer.js";
import { CameraMovementLinker } from "./camera-movement-linker.js";
import { CameraMovementLogger } from "./camera-movement-logger.js";
import { CameraMovementScorer } from "./camera-movement-scorer.js";
import { CameraMovementRecordStore } from "./camera-movement-stores.js";
import { CameraAngle, CameraMovementInput, CameraMovementRecord, CameraMovementResult, CameraMovementSearchQuery, CameraMovementType, ShotFraming } from "./types.js";
export declare class CameraMovementProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: CameraMovementAnalyzer, scorer: CameraMovementScorer, linker: CameraMovementLinker, records: CameraMovementRecordStore, logger: CameraMovementLogger);
    analyze(input: CameraMovementInput): Promise<CameraMovementResult>;
    search(query: CameraMovementSearchQuery): CameraMovementRecord[];
    private reject;
}
export { CameraMovementType, CameraAngle, ShotFraming };
//# sourceMappingURL=camera-movement-processor.d.ts.map