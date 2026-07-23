import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativeDirectionLogger } from "./creative-direction-logger.js";
import { CreativeDirectionRecordStore } from "./creative-direction-stores.js";
import { CreativeDirectionEngineStatusReport, CreativeDirectionInput, CreativeDirectionRecord, CreativeDirectionResult, CreativeDirectionSearchQuery, CreativePlatform } from "./types.js";
/**
 * Creative Direction Engine — transforms product understanding and marketing strategy
 * into a complete creative vision before content is generated.
 */
export declare class AiCreativeDirectionEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: CreativeDirectionLogger;
    readonly records: CreativeDirectionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    planCreativeDirection(input: CreativeDirectionInput): Promise<CreativeDirectionResult>;
    getCreativeDirection(creativeId: string): CreativeDirectionRecord | null;
    getCreativeDirectionsByProduct(productId: string): CreativeDirectionRecord[];
    searchCreativeDirections(query: CreativeDirectionSearchQuery): CreativeDirectionRecord[];
    detectRelationships(creativeId: string): CreativeDirectionRecord["relationships"] | null;
    repairCreativeDirection(productId: string, platform?: CreativePlatform): Promise<CreativeDirectionResult | null>;
    buildStatusReport(): CreativeDirectionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=creative-direction-engine.d.ts.map