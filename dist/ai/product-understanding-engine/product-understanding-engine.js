import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { ProductUnderstandingAnalyzer } from "./product-understanding-analyzer.js";
import { ProductUnderstandingLinker } from "./product-understanding-linker.js";
import { ProductUnderstandingLogger } from "./product-understanding-logger.js";
import { ProductUnderstandingProcessor } from "./product-understanding-processor.js";
import { ProductUnderstandingScorer } from "./product-understanding-scorer.js";
import { ProductUnderstandingRecordStore } from "./product-understanding-stores.js";
import { ProductUnderstandingEngineError, ProductUnderstandingMarketingGoal, } from "./types.js";
/**
 * Product Understanding Engine — transforms analyzed product information into deep product understanding.
 */
export class AiProductUnderstandingEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ProductUnderstandingLogger();
    records = new ProductUnderstandingRecordStore();
    analyzer = new ProductUnderstandingAnalyzer();
    scorer = new ProductUnderstandingScorer();
    linker = new ProductUnderstandingLinker();
    processor = null;
    understandingTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "understanding", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ProductUnderstandingProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Product Understanding Engine initialized", { engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "product-understanding-engine",
            moduleName: "Product Understanding Engine",
            category: ProductIntelligenceCategory.ProductUnderstanding,
            version: "0.1.0",
            status: ProductIntelligenceModuleStatus.Active,
            dependencies: ["product-engine", "product-analysis-engine", "knowledge-engine"],
            qualityScore: 91,
            confidenceScore: 89,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "understanding"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Write,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Product Understanding Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async understandProduct(input) {
        this.ensureReady();
        const result = await this.processor.understand(input);
        if (result.success)
            this.understandingTimes.push(result.durationMs);
        return result;
    }
    getUnderstanding(productId) {
        this.ensureReady();
        return this.records.get(productId) ?? null;
    }
    searchUnderstanding(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    detectRelationships(productId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(productId);
        if (!record)
            return null;
        const analysis = this.foundation.getProductAnalysisEngine().getProduct(productId);
        if (!analysis)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), analysis, record.relationships.projects, record.relationships.knowledgeRecords);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairUnderstanding(productId) {
        this.ensureReady();
        const analysisEngine = this.foundation.getProductAnalysisEngine();
        let analysis = analysisEngine.getProduct(productId);
        if (!analysis) {
            this.logger.log("warn", "validation", "Cannot repair — no analysis record", { productId });
            return null;
        }
        if (!analysis.validated) {
            const repaired = await analysisEngine.repairProduct(productId);
            if (!repaired?.success || !repaired.record)
                return null;
            analysis = repaired.record;
        }
        this.logger.log("info", "validation", "Repairing product understanding", { productId });
        return this.understandProduct({
            productId,
            marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
            relatedKnowledge: analysis.relationships.relatedKnowledge,
            relatedProjects: analysis.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgUnderstanding = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.understandingScore, 0) / all.length)
            : 0;
        const avgBusiness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.businessValueScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getProductAnalysisEngine().isStartupComplete())
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            valueAnalysisStatus: "functional, emotional, practical, commercial, brand and market value analysis active",
            customerUnderstandingStatus: "customer needs, pain points, benefits and expectations tracked",
            relationshipStatus: `${all.length} products indexed for understanding relationships`,
            productsUnderstood: all.length,
            averageUnderstandingScore: avgUnderstanding,
            averageBusinessValueScore: avgBusiness,
            performance: {
                averageUnderstandingMs: avg(this.understandingTimes),
                averageSearchMs: avg(this.searchTimes),
                averageRelationshipMs: avg(this.relationshipTimes),
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
        if (!this.initialized || !this.foundation || !this.processor) {
            throw new ProductUnderstandingEngineError("Product Understanding Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=product-understanding-engine.js.map