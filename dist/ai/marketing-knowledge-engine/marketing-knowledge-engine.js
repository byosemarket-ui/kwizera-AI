import path from "node:path";
import { KnowledgeAccessPermission, KnowledgeCategory, KnowledgeModuleStatus, KnowledgeSource, } from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { MarketingAnalyzer } from "./marketing-analyzer.js";
import { MarketingLearner } from "./marketing-learner.js";
import { MarketingKnowledgeLogger } from "./marketing-logger.js";
import { MarketingProcessor } from "./marketing-processor.js";
import { MarketingRelationshipLinker, MarketingRecommender } from "./marketing-recommender.js";
import { MarketingScorer } from "./marketing-scorer.js";
import { MarketingPatternStore, MarketingRecordStore } from "./marketing-stores.js";
import { MarketingKnowledgeEngineError, } from "./types.js";
/**
 * Marketing Knowledge Engine — understands, organizes and improves marketing knowledge.
 */
export class AiMarketingKnowledgeEngine {
    foundation = null;
    storageRoot = "";
    initialized = false;
    startupComplete = false;
    logger = new MarketingKnowledgeLogger();
    patterns = new MarketingPatternStore();
    records = new MarketingRecordStore();
    analyzer = new MarketingAnalyzer();
    scorer = new MarketingScorer();
    recommender = new MarketingRecommender();
    linker = new MarketingRelationshipLinker();
    processor = null;
    learner = null;
    analysisTimes = [];
    searchTimes = [];
    recommendationTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        const logDir = path.join(storageRoot, "logs");
        const marketingDir = path.join(storageRoot, "knowledge", "marketing", "engine");
        this.logger.initialize(logDir);
        this.patterns.initialize(marketingDir);
        this.records.initialize(marketingDir);
        this.learner = new MarketingLearner(this.patterns, this.logger);
        this.processor = new MarketingProcessor(foundation, this.analyzer, this.scorer, this.recommender, this.linker, this.learner, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Marketing Knowledge Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        const entries = this.foundation
            .getStorageEngine()
            .getIndexEntries()
            .filter((e) => e.knowledgeType === KnowledgeStorageType.Marketing);
        for (const entry of entries) {
            const read = await this.foundation.getStorageEngine().getRecord(entry.knowledgeId);
            if (read.success && read.record?.payload) {
                const payload = read.record.payload;
                if (payload.campaignId)
                    this.records.upsert(payload);
            }
        }
        this.foundation.registerKnowledgeModule({
            knowledgeId: "marketing-knowledge",
            knowledgeName: "Marketing Knowledge",
            category: KnowledgeCategory.Marketing,
            version: "0.1.0",
            status: KnowledgeModuleStatus.Active,
            dependencies: ["knowledge-engine", "memory-engine"],
            source: KnowledgeSource.MarketingCampaign,
            qualityScore: 90,
            confidenceScore: 88,
            storageLocation: path.join(this.storageRoot, "knowledge", "marketing"),
            accessPermissions: [
                KnowledgeAccessPermission.Read,
                KnowledgeAccessPermission.Write,
                KnowledgeAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Marketing Knowledge Engine startup complete", {
            campaignsLoaded: this.records.getCount(),
            patternsLoaded: this.patterns.getCount(),
            durationMs: Date.now() - start,
        });
    }
    async analyzeCampaign(input) {
        this.ensureReady();
        const result = await this.processor.analyze(input);
        if (result.success)
            this.analysisTimes.push(result.durationMs);
        return result;
    }
    getCampaign(campaignId) {
        this.ensureReady();
        return this.records.get(campaignId) ?? null;
    }
    async searchCampaigns(query) {
        this.ensureReady();
        const start = Date.now();
        const results = await this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    getRecommendations(campaignId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(campaignId);
        if (!record)
            return [];
        const recs = this.recommender.recommend(record);
        this.recommendationTimes.push(Date.now() - start);
        return recs;
    }
    detectRelationships(campaignId) {
        this.ensureReady();
        const record = this.records.get(campaignId);
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
            ? Math.round(all.reduce((s, r) => s + r.scores.marketingQualityScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            campaignAnalysisStatus: "campaign objectives, flow and structure analyzed for all records",
            customerKnowledgeStatus: "customer intent, needs, triggers and decision factors tracked",
            relationshipStatus: `${all.length} campaigns indexed for relationship detection`,
            recommendationQuality: "headlines, hooks, CTA, positioning and targeting recommendations active",
            campaignsAnalyzed: all.length,
            patternsLearned: this.patterns.getCount(),
            averageMarketingQualityScore: avgQuality,
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
            throw new MarketingKnowledgeEngineError("Marketing Knowledge Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=marketing-knowledge-engine.js.map