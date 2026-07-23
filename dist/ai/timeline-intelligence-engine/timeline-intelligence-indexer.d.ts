import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { TimelineIntelligenceIndexes, TimelineIntelligenceRecord } from "./types.js";
export declare class TimelineIntelligenceIndexer {
    private readonly foundation;
    constructor(foundation: AiVideoIntelligenceFoundation);
    createIndexes(record: TimelineIntelligenceRecord, projectId?: string): TimelineIntelligenceIndexes;
}
//# sourceMappingURL=timeline-intelligence-indexer.d.ts.map