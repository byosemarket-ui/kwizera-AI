import path from "node:path";
import { ImageGenerationAccessPermission, ImageGenerationCategory, ImageGenerationModuleStatus, } from "../image-generation-foundation/types.js";
import { ImageRenderAnalyzer } from "./image-render-analyzer.js";
import { ImageRenderLinker } from "./image-render-linker.js";
import { ImageRenderLogger } from "./image-render-logger.js";
import { ImageRenderProcessor } from "./image-render-processor.js";
import { ImageRenderScorer } from "./image-render-scorer.js";
import { ImageRenderRecordStore } from "./image-render-stores.js";
import { ImageRenderEngineError, } from "./types.js";
/**
 * AI Image Rendering Preparation Engine — validates and prepares assets, layers,
 * masks and production instructions before rendering begins.
 */
export class AiImageRenderingPreparationEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ImageRenderLogger();
    records = new ImageRenderRecordStore();
    analyzer = new ImageRenderAnalyzer();
    scorer = new ImageRenderScorer();
    linker = new ImageRenderLinker();
    processor = null;
    generationTimes = [];
    searchTimes = [];
    planningTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "rendering", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ImageRenderProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Image Rendering Preparation Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageGenerationModule({
            moduleId: "image-rendering-preparation-engine",
            moduleName: "Image Rendering Preparation Engine",
            category: ImageGenerationCategory.RenderingPlanning,
            version: "0.1.0",
            status: ImageGenerationModuleStatus.Active,
            dependencies: [
                "image-generation-engine",
                "image-production-engine",
                "multi-style-image-generation-engine",
            ],
            qualityScore: 95,
            confidenceScore: 93,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "rendering"),
            accessPermissions: [
                ImageGenerationAccessPermission.Read,
                ImageGenerationAccessPermission.Write,
                ImageGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Image Rendering Preparation Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateRenderPlan(input) {
        this.ensureReady();
        const result = await this.processor.generateRenderPlan(input);
        if (result.success) {
            this.generationTimes.push(result.durationMs);
            this.planningTimes.push(result.durationMs);
        }
        return result;
    }
    getRenderPlan(imageRenderPlanId) {
        this.ensureReady();
        return this.records.get(imageRenderPlanId) ?? null;
    }
    getRenderPlansByProduction(productionId) {
        this.ensureReady();
        return this.records.getByProduction(productionId);
    }
    getRenderPlansByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchRenderPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Render plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairRenderPlan(productId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing render plan", { productId, platform });
        const existingPlans = this.records.getByProduct(productId);
        const existing = existingPlans[0] ?? null;
        const productionPlan = this.foundation.getImageProductionEngine().getProductionPlansByProduct(productId)[0] ?? null;
        const stylePlan = this.foundation.getMultiStyleImageGenerationEngine().getStylePlansByProduct(productId)[0] ?? null;
        return this.generateRenderPlan({
            productId,
            productionId: existing?.profile.productionId ?? productionPlan?.imageProductionId,
            stylePlanId: existing?.relationships.stylePlans[0] ?? stylePlan?.stylePlanId,
            imageId: existing?.profile.imageId ?? productionPlan?.profile.imagePlanId,
            platform: platform ?? existing?.profile.platform,
            validateLayers: true,
            validateMasks: true,
            validateAssets: true,
            planResources: true,
            prepareOutputProfiles: true,
            generateRenderJobs: true,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgRender = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.renderReadinessScore, 0) / all.length) : 0;
        const avgLayer = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.layerIntegrityScore, 0) / all.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("image-rendering-preparation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            renderValidationStatus: "9 render validation stages — text-to-image through production plans",
            layerValidationStatus: "7 layer checks — hierarchy, order, visibility, groups, blend, opacity, clipping",
            maskValidationStatus: "6 mask types — subject, object, background, layer, alpha, editable",
            resourcePlanningStatus: "CPU, GPU, RAM, storage, cache, queue, parallel preparation",
            renderPlansGenerated: all.length,
            averageRenderReadinessScore: avgRender,
            averageLayerIntegrityScore: avgLayer,
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
            throw new ImageRenderEngineError("Image Rendering Preparation Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=image-rendering-preparation-engine.js.map