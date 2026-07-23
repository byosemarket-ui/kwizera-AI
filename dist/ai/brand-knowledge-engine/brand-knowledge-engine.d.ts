import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { BrandKnowledgeLogger } from "./brand-logger.js";
import { BrandPatternStore, BrandRecordStore } from "./brand-stores.js";
import { BrandAnalysisInput, BrandAnalysisRecord, BrandAnalysisResult, BrandConsistencyCheck, BrandKnowledgeLearningPattern, BrandKnowledgeRecommendation, BrandKnowledgeStatusReport, BrandSearchQuery } from "./types.js";
/**
 * Brand Knowledge Engine — understands, protects and improves brand identity knowledge.
 */
export declare class AiBrandKnowledgeEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: BrandKnowledgeLogger;
    readonly patterns: BrandPatternStore;
    readonly records: BrandRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private processor;
    private learner;
    private analysisTimes;
    private searchTimes;
    private recommendationTimes;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeBrand(input: BrandAnalysisInput): Promise<BrandAnalysisResult>;
    getBrand(brandId: string): BrandAnalysisRecord | null;
    searchBrands(query: BrandSearchQuery): Promise<BrandAnalysisRecord[]>;
    getRecommendations(brandId: string): BrandKnowledgeRecommendation[];
    verifyConsistency(brandId: string): BrandConsistencyCheck | null;
    detectRelationships(brandId: string): import("./types.js").BrandKnowledgeRelationships | null;
    getLearnedPatterns(): BrandKnowledgeLearningPattern[];
    buildStatusReport(): BrandKnowledgeStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=brand-knowledge-engine.d.ts.map