import path from "node:path";
import { KnowledgeAccessPermission, KnowledgeCategory, KnowledgeModuleStatus, KnowledgeSource, } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { ProductAnalyzer } from "./product-analyzer.js";
import { ProductLearner } from "./product-learner.js";
import { ProductKnowledgeLogger } from "./product-logger.js";
import { ProductProcessor } from "./product-processor.js";
import { ProductRelationshipLinker, ProductRecommender } from "./product-recommender.js";
import { ProductScorer } from "./product-scorer.js";
import { ProductPatternStore, ProductRecordStore } from "./product-stores.js";
import { ProductKnowledgeEngineError, } from "./types.js";
/**
 * Product Knowledge Engine — understands, organizes and improves product knowledge.
 */
export class AiProductKnowledgeEngine {
    foundation = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new ProductKnowledgeLogger();
    patterns = new ProductPatternStore();
    records = new ProductRecordStore();
    analyzer = new ProductAnalyzer();
    scorer = new ProductScorer();
    recommender = new ProductRecommender();
    linker = new ProductRelationshipLinker();
    processor = null;
    learner = null;
    analysisTimes = [];
    searchTimes = [];
    recommendationTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const productDir = path.join(storageRoot, "knowledge", "products", "engine");
        this.logger.initialize(logDir);
        this.patterns.initialize(productDir);
        this.records.initialize(productDir);
        this.learner = new ProductLearner(this.patterns, this.logger);
        this.processor = new ProductProcessor(foundation, this.analyzer, this.scorer, this.recommender, this.linker, this.learner, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Product Knowledge Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        const entries = this.foundation
            .getStorageEngine()
            .getIndexEntries()
            .filter((e) => e.knowledgeType === KnowledgeStorageType.Product);
        for (const entry of entries) {
            const read = await this.foundation.getStorageEngine().getRecord(entry.knowledgeId);
            if (read.success && read.record?.payload) {
                const payload = read.record.payload;
                if (payload.productId)
                    this.records.upsert(payload);
            }
        }
        this.foundation.registerKnowledgeModule({
            knowledgeId: "product-knowledge",
            knowledgeName: "Product Knowledge",
            category: KnowledgeCategory.Product,
            version: "0.1.0",
            status: KnowledgeModuleStatus.Active,
            dependencies: ["knowledge-engine", "memory-engine"],
            source: KnowledgeSource.Product,
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.storageRoot, "knowledge", "products"),
            accessPermissions: [
                KnowledgeAccessPermission.Read,
                KnowledgeAccessPermission.Write,
                KnowledgeAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Product Knowledge Engine startup complete", {
            productsLoaded: this.records.getCount(),
            patternsLoaded: this.patterns.getCount(),
            durationMs: Date.now() - start,
        });
    }
    async analyzeProduct(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success)
            this.analysisTimes.push(result.durationMs);
        return result;
    }
    getProduct(productId) {
        this.ensureReady();
        return this.records.get(productId) ?? null;
    }
    async searchProducts(query) {
        this.ensureReady();
        const start = Date.now();
        const results = await this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    getRecommendations(productId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(productId);
        if (!record)
            return [];
        const recs = this.recommender.recommend(record);
        this.recommendationTimes.push(Date.now() - start);
        return recs;
    }
    detectRelationships(productId) {
        this.ensureReady();
        const record = this.records.get(productId);
        if (!record)
            return null;
        return this.linker.detectSimilar(record, this.records.getAll());
    }
    getLearnedPatterns() {
        this.ensureReady();
        return this.patterns.getAll();
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productQualityScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            categoryAnalysisStatus: "category and subcategory understanding active for all product records",
            brandKnowledgeStatus: "brand identity, colors, style and consistency tracked",
            recommendationQuality: "presentation, positioning, marketing, branding and creative direction recommendations active",
            relationshipStatus: `${all.length} products indexed for relationship detection`,
            productsAnalyzed: all.length,
            patternsLearned: this.patterns.getCount(),
            averageProductQualityScore: avgQuality,
            performance: {
                averageAnalysisMs: avg(this.analysisTimes),
                averageSearchMs: avg(this.searchTimes),
                averageRecommendationMs: avg(this.recommendationTimes),
            },
            knownIssues: [],
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new ProductKnowledgeEngineError("Product Knowledge Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=product-knowledge-engine.js.map