import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { AudienceLogger } from "./audience-logger.js";
import { AudienceRecordStore } from "./audience-stores.js";
import { AudienceIntelligenceEngineStatusReport, AudienceIntelligenceInput, AudienceIntelligenceRecord, AudienceIntelligenceResult, AudienceSearchQuery } from "./types.js";
/**
 * Target Audience Intelligence Engine — understands, organizes, and analyzes audiences
 * most likely to benefit from a product or service.
 */
export declare class AiTargetAudienceIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AudienceLogger;
    readonly records: AudienceRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeAudience(input: AudienceIntelligenceInput): Promise<AudienceIntelligenceResult>;
    getAudience(audienceId: string): AudienceIntelligenceRecord | null;
    getAudiencesByProduct(productId: string): AudienceIntelligenceRecord[];
    searchAudiences(query: AudienceSearchQuery): AudienceIntelligenceRecord[];
    detectRelationships(audienceId: string): AudienceIntelligenceRecord["relationships"] | null;
    repairAudience(productId: string): Promise<AudienceIntelligenceResult | null>;
    buildStatusReport(): AudienceIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=audience-intelligence-engine.d.ts.map