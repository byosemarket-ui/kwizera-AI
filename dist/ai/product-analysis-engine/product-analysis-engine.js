import path from "node:path";
import { ProductIntelligenceAccessPermission, ProductIntelligenceCategory, ProductIntelligenceModuleStatus, } from "../product-intelligence-foundation/types.js";
import { ProductAnalysisAnalyzer } from "./product-analysis-analyzer.js";
import { ProductAnalysisCompletenessDetector } from "./product-analysis-completeness.js";
import { ProductAnalysisLinker } from "./product-analysis-linker.js";
import { ProductAnalysisLogger } from "./product-analysis-logger.js";
import { ProductAnalysisProcessor } from "./product-analysis-processor.js";
import { ProductAnalysisScorer } from "./product-analysis-scorer.js";
import { ProductAnalysisRecordStore } from "./product-analysis-stores.js";
import { ProductAnalysisEngineError, } from "./types.js";
/**
 * Product Analysis Engine — collects, organizes, validates and analyzes product information
 * before creative planning begins.
 */
export class AiProductAnalysisEngine {
    foundation = null;
    storageRoot = "";
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ProductAnalysisLogger();
    records = new ProductAnalysisRecordStore();
    analyzer = new ProductAnalysisAnalyzer();
    completeness = new ProductAnalysisCompletenessDetector();
    scorer = new ProductAnalysisScorer();
    linker = new ProductAnalysisLinker();
    processor = null;
    analysisTimes = [];
    searchTimes = [];
    classificationTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "analysis", "engine");
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.records.initialize(this.engineDir);
        this.processor = new ProductAnalysisProcessor(foundation, this.analyzer, this.completeness, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Product Analysis Engine initialized", { storageRoot, engineDir: this.engineDir });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.foundation.registerProductIntelligenceModule({
            moduleId: "product-analysis-engine",
            moduleName: "Product Analysis Engine",
            category: ProductIntelligenceCategory.ProductAnalysis,
            version: "0.1.0",
            status: ProductIntelligenceModuleStatus.Active,
            dependencies: ["product-engine", "knowledge-engine", "memory-engine"],
            qualityScore: 92,
            confidenceScore: 90,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "analysis"),
            accessPermissions: [
                ProductIntelligenceAccessPermission.Read,
                ProductIntelligenceAccessPermission.Write,
                ProductIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Product Analysis Engine startup complete", {
            productsLoaded: this.records.getCount(),
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
    searchProducts(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    detectRelationships(productId) {
        this.ensureReady();
        const record = this.records.get(productId);
        if (!record)
            return null;
        return this.linker.detectRelationships(record, this.records.getAll(), record.relationships.relatedKnowledge, record.relationships.relatedMemory);
    }
    async repairProduct(productId) {
        this.ensureReady();
        const existing = this.records.get(productId);
        if (!existing)
            return null;
        const repairedInput = {
            productId,
            productName: existing.profile.productName,
            category: existing.profile.category,
            subcategory: existing.profile.subcategory,
            brand: existing.profile.brand,
            model: existing.profile.model ?? `model-${productId}`,
            sku: existing.profile.sku ?? `SKU-${productId.toUpperCase()}`,
            description: existing.profile.description,
            features: existing.profile.features.length ? existing.profile.features : ["standard-feature"],
            specifications: Object.keys(existing.profile.specifications).length
                ? existing.profile.specifications
                : { default: "standard" },
            materials: existing.profile.materials,
            dimensions: existing.profile.dimensions ?? "standard",
            weight: existing.profile.weight ?? "standard",
            colors: existing.profile.colors,
            sizes: existing.profile.sizes,
            packaging: existing.profile.packaging,
            countryOfOrigin: existing.profile.countryOfOrigin ?? "unknown",
            supplier: existing.profile.supplier ?? "default-supplier",
            price: existing.profile.price > 0 ? existing.profile.price : 1,
            currency: existing.profile.currency,
            availability: existing.profile.availability,
            tags: existing.tags.length ? existing.tags : ["repaired"],
            keywords: existing.keywords.length ? existing.keywords : [existing.profile.productName],
            relatedKnowledge: existing.relationships.relatedKnowledge,
            relatedMemory: existing.relationships.relatedMemory,
            relatedProjects: existing.relationships.relatedProjects,
        };
        this.logger.log("info", "validation", "Repairing product analysis record", { productId });
        return this.analyzeProduct(repairedInput);
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgCompleteness = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.completenessScore, 0) / all.length)
            : 0;
        const avgConfidence = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.analysisConfidenceScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!integration?.knowledgeEngine)
            readinessScore -= 10;
        if (!integration?.memoryEngine)
            readinessScore -= 5;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            classificationStatus: "industry, category, subcategory, use case, target customer, business type classification active",
            relationshipStatus: `${all.length} products indexed for relationship detection`,
            completenessStatus: "completeness, data quality, marketing readiness, and confidence scoring active",
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productsAnalyzed: all.length,
            averageCompletenessScore: avgCompleteness,
            averageConfidenceScore: avgConfidence,
            performance: {
                averageAnalysisMs: avg(this.analysisTimes),
                averageSearchMs: avg(this.searchTimes),
                averageClassificationMs: avg(this.classificationTimes),
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
    getEngineDir() {
        return this.engineDir;
    }
    ensureReady() {
        if (!this.initialized || !this.foundation || !this.processor) {
            throw new ProductAnalysisEngineError("Product Analysis Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=product-analysis-engine.js.map