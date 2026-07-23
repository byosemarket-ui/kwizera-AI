import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { ProductionPlanningLogger } from "./production-planning-logger.js";
import { ProductionPlanningRecordStore } from "./production-planning-stores.js";
import { ProductionPlanningEngineStatusReport, ProductionPlanningInput, ProductionPlanningRecord, ProductionPlanningResult, ProductionPlanningSearchQuery } from "./types.js";
/**
 * Production Planning Engine — combines all approved planning modules into
 * a complete production-ready execution plan before media generation.
 */
export declare class AiProductionPlanningEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ProductionPlanningLogger;
    readonly records: ProductionPlanningRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createProductionPlan(input: ProductionPlanningInput): Promise<ProductionPlanningResult>;
    getProductionPlan(productionPlanId: string): ProductionPlanningRecord | null;
    getProductionPlansByProduct(productId: string): ProductionPlanningRecord[];
    searchProductionPlans(query: ProductionPlanningSearchQuery): ProductionPlanningRecord[];
    detectRelationships(productionPlanId: string): ProductionPlanningRecord["relationships"] | null;
    repairProductionPlan(productId: string, platform?: CreativePlatform): Promise<ProductionPlanningResult | null>;
    buildStatusReport(): ProductionPlanningEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=production-planning-engine.d.ts.map