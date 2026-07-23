import path from "node:path";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryAccessPermission, MemoryCategory, MemoryModuleStatus } from "../memory-foundation/types.js";
import { ProductHistoryStore } from "./product-history-store.js";
import { ProductLearner } from "./product-learner.js";
import { ProductMemoryLogger } from "./product-logger.js";
import { ProductPatternDetector } from "./product-pattern-detector.js";
import { ProductPatternStore } from "./product-pattern-store.js";
import { ProductPreferenceStore } from "./product-preference-store.js";
import { ProductProcessor, recordFromMemory } from "./product-processor.js";
import { ProductRelationshipLinker } from "./product-relationship-linker.js";
import { ProductScorer } from "./product-scorer.js";
import { ProductMemoryEngineError, } from "./types.js";
/**
 * Product Memory Engine — permanent product knowledge storage and learning.
 */
export class AiProductMemoryEngine {
    foundation = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new ProductMemoryLogger();
    history = new ProductHistoryStore();
    patterns = new ProductPatternStore();
    preferences = new ProductPreferenceStore();
    products = new Map();
    scorer = new ProductScorer();
    linker = null;
    patternDetector = null;
    learner = null;
    processor = null;
    saveTimes = [];
    loadTimes = [];
    searchTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const productDir = path.join(storageRoot, "memory", "products");
        this.logger.initialize(logDir);
        this.history.initialize(productDir);
        this.patterns.initialize(productDir);
        this.preferences.initialize(productDir);
        this.linker = new ProductRelationshipLinker(foundation, this.logger);
        this.patternDetector = new ProductPatternDetector(this.patterns);
        this.learner = new ProductLearner(foundation, this.logger);
        this.processor = new ProductProcessor(foundation, this.history, this.preferences, this.scorer, this.patternDetector, this.linker, this.learner, this.logger, this.products);
        this.initialized = true;
        this.logger.log("info", "startup", "Product Memory Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        const entries = this.foundation
            .getStorageEngine()
            .getIndexEntries()
            .filter((e) => e.memoryType === MemoryStorageType.Product);
        for (const entry of entries) {
            const read = await this.foundation.getStorageEngine().getRecord(entry.memoryId);
            if (read.success && read.record) {
                this.products.set(entry.memoryId, recordFromMemory(read.record));
            }
        }
        this.foundation.registerMemoryModule({
            memoryId: "product-memory",
            memoryName: "Product Memory",
            category: MemoryCategory.Product,
            version: "0.1.0",
            status: MemoryModuleStatus.Active,
            dependencies: ["memory-engine"],
            storageLocation: path.join(this.storageRoot, "memory", "products"),
            accessPermissions: [MemoryAccessPermission.Read, MemoryAccessPermission.Write],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Product Memory Engine startup complete", {
            productsLoaded: this.products.size,
            patternsLoaded: this.patterns.getCount(),
            durationMs: Date.now() - start,
        });
    }
    async createProduct(input) {
        this.ensureReady();
        const result = await this.processor.create(input);
        if (result.success)
            this.saveTimes.push(result.durationMs);
        return result;
    }
    async updateProduct(productId, input) {
        this.ensureReady();
        const result = await this.processor.update(productId, input);
        if (result.success)
            this.saveTimes.push(result.durationMs);
        return result;
    }
    async learnFromProject(productId) {
        this.ensureReady();
        return this.processor.learnFromProject(productId);
    }
    async getProduct(productId) {
        this.ensureReady();
        const start = Date.now();
        const product = await this.processor.loadProduct(productId);
        this.loadTimes.push(Date.now() - start);
        return product;
    }
    async listProducts() {
        this.ensureReady();
        return [...this.products.values()];
    }
    getCustomerPreferences() {
        return this.preferences.get();
    }
    learnCustomerPreferences(partial) {
        this.ensureReady();
        const updated = this.preferences.learn(partial);
        this.logger.log("info", "preference", "Customer preferences updated", {
            fields: Object.keys(partial).length,
        });
        return updated;
    }
    getProductRelationships(productId) {
        const product = this.products.get(productId);
        if (!product || !this.linker)
            return null;
        return this.linker.link(product.productId, product.projectId, product.brand, product.category, product.tags);
    }
    getDetectedPatterns() {
        return [...this.patterns.getAll()];
    }
    getReusablePatterns() {
        return this.patterns.getReusable();
    }
    searchProducts(query) {
        this.ensureReady();
        const start = Date.now();
        let results = [...this.products.values()];
        if (query.name) {
            const lower = query.name.toLowerCase();
            results = results.filter((p) => p.productName.toLowerCase().includes(lower));
        }
        if (query.brand) {
            const lower = query.brand.toLowerCase();
            results = results.filter((p) => p.brand.toLowerCase().includes(lower));
        }
        if (query.category)
            results = results.filter((p) => p.category === query.category);
        if (query.subcategory)
            results = results.filter((p) => p.subcategory === query.subcategory);
        if (query.sku)
            results = results.filter((p) => p.sku === query.sku);
        if (query.supplier) {
            const lower = query.supplier.toLowerCase();
            results = results.filter((p) => p.supplier.toLowerCase().includes(lower));
        }
        if (query.color) {
            const lower = query.color.toLowerCase();
            results = results.filter((p) => p.colors.some((c) => c.toLowerCase().includes(lower)) ||
                p.visual.colorPalette.some((c) => c.toLowerCase().includes(lower)));
        }
        if (query.minPrice !== undefined)
            results = results.filter((p) => p.price >= query.minPrice);
        if (query.maxPrice !== undefined)
            results = results.filter((p) => p.price <= query.maxPrice);
        if (query.language)
            results = results.filter((p) => p.language === query.language);
        if (query.marketingGoal) {
            const lower = query.marketingGoal.toLowerCase();
            results = results.filter((p) => p.marketingGoal.toLowerCase().includes(lower));
        }
        if (query.tags?.length) {
            results = results.filter((p) => query.tags.some((t) => p.tags.includes(t)));
        }
        if (query.keywords?.length) {
            results = results.filter((p) => query.keywords.some((kw) => p.keywords.some((k) => k.toLowerCase().includes(kw.toLowerCase()))));
        }
        const searchMs = Date.now() - start;
        this.searchTimes.push(searchMs);
        this.logger.log("info", "search", "Product search complete", {
            results: results.length,
            searchMs,
        });
        return results;
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    buildStatusReport() {
        const products = [...this.products.values()];
        const patterns = this.patterns.getAll();
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        const learned = products.filter((p) => p.lessonsLearned.length > 0 || p.patterns.length > 0).length;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            relationshipStatus: `${products.reduce((s, p) => s + p.relatedMemories.length, 0)} relationship link(s)`,
            patternDetectionStatus: `${patterns.length} pattern(s), ${this.patterns.getReusable().length} reusable`,
            learningStatus: `${learned} product(s) with learned experience`,
            totalProducts: products.length,
            totalPatterns: patterns.length,
            totalPreferenceFields: this.preferences.getFieldCount(),
            performance: {
                averageSaveMs: avg(this.saveTimes),
                averageLoadMs: avg(this.loadTimes),
                averageSearchMs: avg(this.searchTimes),
                totalVersions: products.reduce((s, p) => s + p.versions.length, 0),
            },
            knownIssues: [],
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new ProductMemoryEngineError("Product Memory Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=product-memory-engine.js.map