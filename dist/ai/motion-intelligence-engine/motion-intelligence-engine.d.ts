import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { MotionIntelligenceLogger } from "./motion-intelligence-logger.js";
import { MotionIntelligenceRecordStore } from "./motion-intelligence-stores.js";
import { MotionClassification, MotionIntelligenceEngineStatusReport, MotionIntelligenceInput, MotionIntelligenceRecord, MotionIntelligenceResult, MotionIntelligenceSearchQuery, MotionEventType, ObjectMotionType, TrackingSubjectType } from "./types.js";
/**
 * Motion Intelligence Engine — detects, analyzes, understands and plans all movement inside videos.
 */
export declare class AiMotionIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: MotionIntelligenceLogger;
    readonly records: MotionIntelligenceRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeMotion(input: MotionIntelligenceInput): Promise<MotionIntelligenceResult>;
    getMotionAnalysis(videoId: string): MotionIntelligenceRecord | null;
    searchMotionAnalysis(query: MotionIntelligenceSearchQuery): MotionIntelligenceRecord[];
    repairMotionAnalysis(videoId: string): Promise<MotionIntelligenceResult | null>;
    buildStatusReport(): MotionIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
export { MotionClassification, MotionEventType, ObjectMotionType, TrackingSubjectType };
//# sourceMappingURL=motion-intelligence-engine.d.ts.map