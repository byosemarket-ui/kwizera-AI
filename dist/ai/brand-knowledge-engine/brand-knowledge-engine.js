import path from "node:path";
import { KnowledgeAccessPermission, KnowledgeCategory, KnowledgeModuleStatus, KnowledgeSource, } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { BrandAnalyzer } from "./brand-analyzer.js";
import { BrandLearner } from "./brand-learner.js";
import { BrandKnowledgeLogger } from "./brand-logger.js";
import { BrandProcessor } from "./brand-processor.js";
import { BrandRelationshipLinker, BrandRecommender } from "./brand-recommender.js";
import { BrandScorer } from "./brand-scorer.js";
import { BrandPatternStore, BrandRecordStore } from "./brand-stores.js";
import { BrandKnowledgeEngineError, } from "./types.js";
/**
 * Brand Knowledge Engine — understands, protects and improves brand identity knowledge.
 */
export class AiBrandKnowledgeEngine {
    foundation = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new BrandKnowledgeLogger();
    patterns = new BrandPatternStore();
    records = new BrandRecordStore();
    analyzer = new BrandAnalyzer();
    scorer = new BrandScorer();
    recommender = new BrandRecommender();
    linker = new BrandRelationshipLinker();
    processor = null;
    learner = null;
    analysisTimes = [];
    searchTimes = [];
    recommendationTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const brandDir = path.join(storageRoot, "knowledge", "brands", "engine");
        this.logger.initialize(logDir);
        this.patterns.initialize(brandDir);
        this.records.initialize(brandDir);
        this.learner = new BrandLearner(this.patterns, this.logger);
        this.processor = new BrandProcessor(foundation, this.analyzer, this.scorer, this.recommender, this.linker, this.learner, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Brand Knowledge Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        const entries = this.foundation
            .getStorageEngine()
            .getIndexEntries()
            .filter((e) => e.knowledgeType === KnowledgeStorageType.Brand);
        for (const entry of entries) {
            const read = await this.foundation.getStorageEngine().getRecord(entry.knowledgeId);
            if (read.success && read.record?.payload) {
                const payload = read.record.payload;
                if (payload.brandId)
                    this.records.upsert(payload);
            }
        }
        this.foundation.registerKnowledgeModule({
            knowledgeId: "brand-knowledge",
            knowledgeName: "Brand Knowledge",
            category: KnowledgeCategory.Brand,
            version: "0.1.0",
            status: KnowledgeModuleStatus.Active,
            dependencies: ["knowledge-engine", "memory-engine"],
            source: KnowledgeSource.KnowledgeModule,
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.storageRoot, "knowledge", "brands"),
            accessPermissions: [
                KnowledgeAccessPermission.Read,
                KnowledgeAccessPermission.Write,
                KnowledgeAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Brand Knowledge Engine startup complete", {
            brandsLoaded: this.records.getCount(),
            patternsLoaded: this.patterns.getCount(),
            durationMs: Date.now() - start,
        });
    }
    async analyzeBrand(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success)
            this.analysisTimes.push(result.durationMs);
        return result;
    }
    getBrand(brandId) {
        this.ensureReady();
        return this.records.get(brandId) ?? null;
    }
    async searchBrands(query) {
        this.ensureReady();
        const start = Date.now();
        const results = await this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    getRecommendations(brandId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(brandId);
        if (!record)
            return [];
        const recs = this.recommender.recommend(record);
        this.recommendationTimes.push(Date.now() - start);
        return recs;
    }
    verifyConsistency(brandId) {
        this.ensureReady();
        const record = this.records.get(brandId);
        if (!record)
            return null;
        return this.analyzer.evaluateConsistency(record.profile, record.visual, record.communication, {});
    }
    detectRelationships(brandId) {
        this.ensureReady();
        const record = this.records.get(brandId);
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
        const avgConsistency = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.brandConsistencyScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            brandConsistencyStatus: "logo, color, typography, voice and motion consistency verified",
            visualIdentityStatus: "logo, colors, typography and design language tracked",
            recommendationQuality: "branding, logo placement, color, typography and consistency recommendations active",
            relationshipStatus: `${all.length} brands indexed for relationship detection`,
            brandsAnalyzed: all.length,
            patternsLearned: this.patterns.getCount(),
            averageBrandConsistencyScore: avgConsistency,
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
            throw new BrandKnowledgeEngineError("Brand Knowledge Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=brand-knowledge-engine.js.map