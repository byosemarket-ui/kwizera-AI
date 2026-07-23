import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { TimelineIntelligenceAnalyzer } from "./timeline-intelligence-analyzer.js";
import { TimelineIntelligenceLinker } from "./timeline-intelligence-linker.js";
import { TimelineIntelligenceLogger } from "./timeline-intelligence-logger.js";
import { TimelineIntelligenceScorer } from "./timeline-intelligence-scorer.js";
import { TimelineIntelligenceRecordStore } from "./timeline-intelligence-stores.js";
import { TimelineIntelligenceInput, TimelineIntelligenceRecord, TimelineIntelligenceResult, TimelineIntelligenceSearchQuery, TrackType, TimelineVariant } from "./types.js";
export declare class TimelineIntelligenceProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    private readonly indexer;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: TimelineIntelligenceAnalyzer, scorer: TimelineIntelligenceScorer, linker: TimelineIntelligenceLinker, records: TimelineIntelligenceRecordStore, logger: TimelineIntelligenceLogger);
    analyze(input: TimelineIntelligenceInput): Promise<TimelineIntelligenceResult>;
    search(query: TimelineIntelligenceSearchQuery): TimelineIntelligenceRecord[];
}
export { TrackType, TimelineVariant };
//# sourceMappingURL=timeline-intelligence-processor.d.ts.map