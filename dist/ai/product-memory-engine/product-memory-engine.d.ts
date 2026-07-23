import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ProductHistoryStore } from "./product-history-store.js";
import { ProductMemoryLogger } from "./product-logger.js";
import { ProductPatternStore } from "./product-pattern-store.js";
import { ProductPreferenceStore } from "./product-preference-store.js";
import { ProductCreateInput, ProductCustomerPreferences, ProductLearningResult, ProductMemoryStatusReport, ProductPattern, ProductProcessResult, ProductRecord, ProductRelationships, ProductUpdateInput } from "./types.js";
/**
 * Product Memory Engine — permanent product knowledge storage and learning.
 */
export declare class AiProductMemoryEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: ProductMemoryLogger;
    readonly history: ProductHistoryStore;
    readonly patterns: ProductPatternStore;
    readonly preferences: ProductPreferenceStore;
    private readonly products;
    private readonly scorer;
    private linker;
    private patternDetector;
    private learner;
    private processor;
    private saveTimes;
    private loadTimes;
    private searchTimes;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createProduct(input: ProductCreateInput): Promise<ProductProcessResult>;
    updateProduct(productId: string, input: ProductUpdateInput): Promise<ProductProcessResult>;
    learnFromProject(productId: string): Promise<ProductLearningResult>;
    getProduct(productId: string): Promise<ProductRecord | null>;
    listProducts(): Promise<ProductRecord[]>;
    getCustomerPreferences(): ProductCustomerPreferences;
    learnCustomerPreferences(partial: Partial<ProductCustomerPreferences>): ProductCustomerPreferences;
    getProductRelationships(productId: string): ProductRelationships | null;
    getDetectedPatterns(): ProductPattern[];
    getReusablePatterns(): ProductPattern[];
    searchProducts(query: {
        name?: string;
        brand?: string;
        category?: string;
        subcategory?: string;
        sku?: string;
        supplier?: string;
        color?: string;
        minPrice?: number;
        maxPrice?: number;
        language?: string;
        marketingGoal?: string;
        tags?: string[];
        keywords?: string[];
    }): ProductRecord[];
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): ProductMemoryStatusReport;
    private ensureReady;
}
//# sourceMappingURL=product-memory-engine.d.ts.map