import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { MotionIntelligenceAnalyzer } from "./motion-intelligence-analyzer.js";
import { MotionIntelligenceLinker } from "./motion-intelligence-linker.js";
import { MotionIntelligenceLogger } from "./motion-intelligence-logger.js";
import { MotionIntelligenceScorer } from "./motion-intelligence-scorer.js";
import { MotionIntelligenceRecordStore } from "./motion-intelligence-stores.js";
import { MotionClassification, MotionEventType, MotionIntelligenceInput, MotionIntelligenceRecord, MotionIntelligenceResult, MotionIntelligenceSearchQuery, ObjectMotionType, TrackingSubjectType } from "./types.js";
export declare class MotionIntelligenceProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: MotionIntelligenceAnalyzer, scorer: MotionIntelligenceScorer, linker: MotionIntelligenceLinker, records: MotionIntelligenceRecordStore, logger: MotionIntelligenceLogger);
    analyze(input: MotionIntelligenceInput): Promise<MotionIntelligenceResult>;
    search(query: MotionIntelligenceSearchQuery): MotionIntelligenceRecord[];
    private reject;
}
export { MotionClassification, MotionEventType, ObjectMotionType, TrackingSubjectType };
//# sourceMappingURL=motion-intelligence-processor.d.ts.map