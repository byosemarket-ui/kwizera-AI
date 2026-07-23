import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { CreativeVideoLogger } from "./creative-video-logger.js";
import { CreativeVideoRecordStore } from "./creative-video-stores.js";
import { CreativeVideoTemplateLibrary } from "./creative-video-template-library.js";
import { CreativeVideoEngineStatusReport, CreativeVideoIntelligenceInput, CreativeVideoIntelligenceRecord, CreativeVideoIntelligenceResult, CreativeVideoSearchQuery, CreativeVideoPlatform, CreativeVideoType, CreativeVideoTemplateType } from "./types.js";
/**
 * Creative Video Intelligence Engine — transforms video intelligence into complete creative production planning.
 */
export declare class AiCreativeVideoIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: CreativeVideoLogger;
    readonly records: CreativeVideoRecordStore;
    readonly templateLibrary: CreativeVideoTemplateLibrary;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    planCreativeVideo(input: CreativeVideoIntelligenceInput): Promise<CreativeVideoIntelligenceResult>;
    getCreativePlan(videoId: string): CreativeVideoIntelligenceRecord | null;
    searchCreativePlans(query: CreativeVideoSearchQuery): CreativeVideoIntelligenceRecord[];
    repairCreativePlan(videoId: string): Promise<CreativeVideoIntelligenceResult | null>;
    buildStatusReport(): CreativeVideoEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
export { CreativeVideoPlatform, CreativeVideoType, CreativeVideoTemplateType };
//# sourceMappingURL=creative-video-intelligence-engine.d.ts.map