import path from "node:path";
import { ImageGenerationAccessPermission, ImageGenerationCategory, ImageGenerationModuleStatus, } from "../image-generation-foundation/types.js";
import { ImageProductionAnalyzer } from "./image-production-analyzer.js";
import { ImageProductionLinker } from "./image-production-linker.js";
import { ImageProductionLogger } from "./image-production-logger.js";
import { ImageProductionProcessor } from "./image-production-processor.js";
import { ImageProductionScorer } from "./image-production-scorer.js";
import { ImageProductionRecordStore } from "./image-production-stores.js";
import { ImageProductionEngineError, } from "./types.js";
/**
 * AI Image Production Engine — transforms approved image generation plans
 * into complete production-ready execution blueprints.
 */
export class AiImageProductionEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ImageProductionLogger();
    records = new ImageProductionRecordStore();
    analyzer = new ImageProductionAnalyzer();
    scorer = new ImageProductionScorer();
    linker = new ImageProductionLinker();
    processor = null;
    generationTimes = [];
    searchTimes = [];
    planningTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "production", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ImageProductionProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Image Production Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageGenerationModule({
            moduleId: "image-production-engine",
            moduleName: "Image Production Engine",
            category: ImageGenerationCategory.ImageProduction,
            version: "0.1.0",
            status: ImageGenerationModuleStatus.Active,
            dependencies: [
                "image-generation-engine",
                "product-image-generation-engine",
                "branding-design-generation-engine",
                "multi-style-image-generation-engine",
            ],
            qualityScore: 94,
            confidenceScore: 92,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "production"),
            accessPermissions: [
                ImageGenerationAccessPermission.Read,
                ImageGenerationAccessPermission.Write,
                ImageGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Image Production Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateProductionPlan(input) {
        this.ensureReady();
        const result = await this.processor.generateProductionPlan(input);
        if (result.success) {
            this.generationTimes.push(result.durationMs);
            this.planningTimes.push(result.durationMs);
        }
        return result;
    }
    getProductionPlan(imageProductionId) {
        this.ensureReady();
        return this.records.get(imageProductionId) ?? null;
    }
    getProductionPlansByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchProductionPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Production plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairProductionPlan(productId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing production plan", { productId, platform });
        const existingPlans = this.records.getByProduct(productId);
        const existing = existingPlans[0] ?? null;
        const stylePlan = this.foundation.getMultiStyleImageGenerationEngine().getStylePlansByProduct(productId)[0] ?? null;
        const productImagePlan = this.foundation.getProductImageGenerationEngine().getProductImagePlansByProduct(productId)[0] ?? null;
        const brandingPlan = this.foundation.getBrandingDesignEngine().getBrandingPlansByProduct(productId)[0] ?? null;
        return this.generateProductionPlan({
            productId,
            imagePlanId: existing?.profile.imagePlanId ?? stylePlan?.stylePlanId ?? productImagePlan?.productImagePlanId,
            stylePlanId: existing?.relationships.stylePlans[0] ?? stylePlan?.stylePlanId,
            productImagePlanId: existing?.relationships.productImagePlans[0] ?? productImagePlan?.productImagePlanId,
            brandingPlanId: existing?.relationships.brandingPlans[0] ?? brandingPlan?.brandDesignId,
            brandId: existing?.profile.brandId,
            platform: platform ?? existing?.profile.platform,
            validateAllWorkflows: true,
            validateAllAssets: true,
            prepareExports: true,
            preparePlatformRules: true,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgProduction = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length) : 0;
        const avgWorkflow = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.workflowScore, 0) / all.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("image-production-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            workflowValidationStatus: "9 workflow stages — text-to-image through production workflow",
            assetValidationStatus: "12 asset types — source, generated, logos, layers, masks, brand assets",
            dependencyValidationStatus: "14 dependencies — memory, knowledge, intelligence, generation engines",
            productionPlansGenerated: all.length,
            averageProductionReadinessScore: avgProduction,
            averageWorkflowScore: avgWorkflow,
            performance: {
                averageGenerationMs: avg(this.generationTimes),
                averageSearchMs: avg(this.searchTimes),
                averagePlanningMs: avg(this.planningTimes),
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
            throw new ImageProductionEngineError("Image Production Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=image-production-engine.js.map