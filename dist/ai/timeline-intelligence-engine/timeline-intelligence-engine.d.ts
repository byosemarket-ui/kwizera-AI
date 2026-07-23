import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { TimelineIntelligenceLogger } from "./timeline-intelligence-logger.js";
import { TimelineIntelligenceRecordStore } from "./timeline-intelligence-stores.js";
import { TimelineIntelligenceEngineStatusReport, TimelineIntelligenceInput, TimelineIntelligenceRecord, TimelineIntelligenceResult, TimelineIntelligenceSearchQuery, TimelineVariant, TrackType } from "./types.js";
/**
 * Timeline Intelligence Engine — understands, organizes and optimizes complete timeline structure.
 */
export declare class AiTimelineIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: TimelineIntelligenceLogger;
    readonly records: TimelineIntelligenceRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private indexingTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeTimeline(input: TimelineIntelligenceInput): Promise<TimelineIntelligenceResult>;
    getTimeline(videoId: string): TimelineIntelligenceRecord | null;
    searchTimelines(query: TimelineIntelligenceSearchQuery): TimelineIntelligenceRecord[];
    detectRelationships(videoId: string): TimelineIntelligenceRecord["relationships"] | null;
    repairTimeline(videoId: string): Promise<TimelineIntelligenceResult | null>;
    buildStatusReport(): TimelineIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getEngineDir(): string;
    private ensureReady;
}
export { TimelineVariant, TrackType };
//# sourceMappingURL=timeline-intelligence-engine.d.ts.map