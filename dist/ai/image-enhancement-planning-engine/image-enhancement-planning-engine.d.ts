import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { EnhancementPlanningLogger } from "./enhancement-planning-logger.js";
import { ImageEnhancementPlanningRecordStore } from "./enhancement-planning-stores.js";
import { ImageEnhancementPlanningEngineStatusReport, ImageEnhancementPlanningInput, ImageEnhancementPlanningRecord, ImageEnhancementPlanningResult, ImageEnhancementPlanningSearchQuery } from "./types.js";
/**
 * Image Enhancement Planning Engine — prepares non-destructive enhancement plans before image processing.
 */
export declare class AiImageEnhancementPlanningEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: EnhancementPlanningLogger;
    readonly records: ImageEnhancementPlanningRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    planEnhancement(input: ImageEnhancementPlanningInput): Promise<ImageEnhancementPlanningResult>;
    getEnhancementPlan(imageId: string): ImageEnhancementPlanningRecord | null;
    searchEnhancementPlans(query: ImageEnhancementPlanningSearchQuery): ImageEnhancementPlanningRecord[];
    detectRelationships(imageId: string): ImageEnhancementPlanningRecord["relationships"] | null;
    repairEnhancementPlan(imageId: string): Promise<ImageEnhancementPlanningResult | null>;
    buildStatusReport(): ImageEnhancementPlanningEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-enhancement-planning-engine.d.ts.map