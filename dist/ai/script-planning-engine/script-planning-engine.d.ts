import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { ScriptPlanningLogger } from "./script-planning-logger.js";
import { ScriptPlanningRecordStore } from "./script-planning-stores.js";
import { ScriptPlanningEngineStatusReport, ScriptPlanningInput, ScriptPlanningRecord, ScriptPlanningResult, ScriptPlanningSearchQuery } from "./types.js";
/**
 * Script Planning Engine — transforms approved storyboard into production-ready
 * script planning (structure, timing, communication flow) before script generation.
 */
export declare class AiScriptPlanningEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ScriptPlanningLogger;
    readonly records: ScriptPlanningRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createScriptPlan(input: ScriptPlanningInput): Promise<ScriptPlanningResult>;
    getScriptPlan(scriptPlanId: string): ScriptPlanningRecord | null;
    getScriptPlansByProduct(productId: string): ScriptPlanningRecord[];
    searchScriptPlans(query: ScriptPlanningSearchQuery): ScriptPlanningRecord[];
    detectRelationships(scriptPlanId: string): ScriptPlanningRecord["relationships"] | null;
    repairScriptPlan(productId: string, platform?: CreativePlatform): Promise<ScriptPlanningResult | null>;
    buildStatusReport(): ScriptPlanningEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=script-planning-engine.d.ts.map