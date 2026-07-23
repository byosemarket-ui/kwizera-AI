import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { VisualPlanningLogger } from "./visual-planning-logger.js";
import { VisualPlanningRecordStore } from "./visual-planning-stores.js";
import { VisualPlanningEngineStatusReport, VisualPlanningInput, VisualPlanningRecord, VisualPlanningResult, VisualPlanningSearchQuery } from "./types.js";
/**
 * Visual Planning Engine — prepares complete visual production plans before
 * image or video generation, aligned with storyboard, script plan, brand and strategy.
 */
export declare class AiVisualPlanningEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VisualPlanningLogger;
    readonly records: VisualPlanningRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createVisualPlan(input: VisualPlanningInput): Promise<VisualPlanningResult>;
    getVisualPlan(visualPlanId: string): VisualPlanningRecord | null;
    getVisualPlansByProduct(productId: string): VisualPlanningRecord[];
    searchVisualPlans(query: VisualPlanningSearchQuery): VisualPlanningRecord[];
    detectRelationships(visualPlanId: string): VisualPlanningRecord["relationships"] | null;
    repairVisualPlan(productId: string, platform?: CreativePlatform): Promise<VisualPlanningResult | null>;
    buildStatusReport(): VisualPlanningEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=visual-planning-engine.d.ts.map