import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { MotionGenerationAnalyzer } from "./motion-generation-analyzer.js";
import { MotionGenerationLinker } from "./motion-generation-linker.js";
import { MotionGenerationLogger } from "./motion-generation-logger.js";
import { MotionGenerationScorer } from "./motion-generation-scorer.js";
import { MotionGenerationRecordStore } from "./motion-generation-stores.js";
import { MotionGenerationInput, MotionGenerationRecord, MotionGenerationResult, MotionGenerationSearchQuery } from "./types.js";
export declare class MotionGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: MotionGenerationAnalyzer, scorer: MotionGenerationScorer, linker: MotionGenerationLinker, records: MotionGenerationRecordStore, logger: MotionGenerationLogger);
    generateMotionPlans(input: MotionGenerationInput): Promise<MotionGenerationResult>;
    search(query: MotionGenerationSearchQuery): MotionGenerationRecord[];
    private resolveSceneCameraPairs;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=motion-generation-processor.d.ts.map