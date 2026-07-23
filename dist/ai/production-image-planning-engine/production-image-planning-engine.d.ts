import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ProductionPlanningLogger } from "./production-planning-logger.js";
import { ProductionImagePlanningRecordStore } from "./production-planning-stores.js";
import { ProductionImagePlanningEngineStatusReport, ProductionImagePlanningInput, ProductionImagePlanningRecord, ProductionImagePlanningResult, ProductionImagePlanningSearchQuery } from "./types.js";
/**
 * Production Image Planning Engine — combines all image intelligence into production-ready execution plans.
 */
export declare class AiProductionImagePlanningEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ProductionPlanningLogger;
    readonly records: ProductionImagePlanningRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    planProduction(input: ProductionImagePlanningInput): Promise<ProductionImagePlanningResult>;
    getProductionPlan(imageId: string): ProductionImagePlanningRecord | null;
    searchProductionPlans(query: ProductionImagePlanningSearchQuery): ProductionImagePlanningRecord[];
    detectRelationships(imageId: string): ProductionImagePlanningRecord["relationships"] | null;
    repairProductionPlan(imageId: string): Promise<ProductionImagePlanningResult | null>;
    buildStatusReport(): ProductionImagePlanningEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=production-image-planning-engine.d.ts.map