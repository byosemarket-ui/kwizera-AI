import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { ProductKnowledgeLogger } from "./product-logger.js";
import { ProductPatternStore, ProductRecordStore } from "./product-stores.js";
import { ProductAnalysisInput, ProductAnalysisRecord, ProductAnalysisResult, ProductKnowledgeLearningPattern, ProductKnowledgeRecommendation, ProductKnowledgeStatusReport, ProductSearchQuery } from "./types.js";
/**
 * Product Knowledge Engine — understands, organizes and improves product knowledge.
 */
export declare class AiProductKnowledgeEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: ProductKnowledgeLogger;
    readonly patterns: ProductPatternStore;
    readonly records: ProductRecordStore;
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
    analyzeProduct(input: ProductAnalysisInput): Promise<ProductAnalysisResult>;
    getProduct(productId: string): ProductAnalysisRecord | null;
    searchProducts(query: ProductSearchQuery): Promise<ProductAnalysisRecord[]>;
    getRecommendations(productId: string): ProductKnowledgeRecommendation[];
    detectRelationships(productId: string): import("./types.js").ProductKnowledgeRelationships | null;
    getLearnedPatterns(): ProductKnowledgeLearningPattern[];
    buildStatusReport(): ProductKnowledgeStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=product-knowledge-engine.d.ts.map