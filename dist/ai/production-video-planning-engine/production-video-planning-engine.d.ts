import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { ProductionVideoLogger } from "./production-video-logger.js";
import { ProductionVideoPlanningRecordStore } from "./production-video-stores.js";
import { ProductionVideoExportFormat, ProductionVideoPlanningEngineStatusReport, ProductionVideoPlanningInput, ProductionVideoPlanningRecord, ProductionVideoPlanningResult, ProductionVideoPlanningSearchQuery, ProductionVideoPlatform, ProductionVideoWorkflowStep } from "./types.js";
/**
 * Production Video Planning Engine — combines all video intelligence into production-ready execution plans.
 */
export declare class AiProductionVideoPlanningEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ProductionVideoLogger;
    readonly records: ProductionVideoPlanningRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    planProductionVideo(input: ProductionVideoPlanningInput): Promise<ProductionVideoPlanningResult>;
    getProductionPlan(videoId: string): ProductionVideoPlanningRecord | null;
    searchProductionPlans(query: ProductionVideoPlanningSearchQuery): ProductionVideoPlanningRecord[];
    repairProductionPlan(videoId: string): Promise<ProductionVideoPlanningResult | null>;
    buildStatusReport(): ProductionVideoPlanningEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
export { ProductionVideoPlatform, ProductionVideoWorkflowStep, ProductionVideoExportFormat };
//# sourceMappingURL=production-video-planning-engine.d.ts.map