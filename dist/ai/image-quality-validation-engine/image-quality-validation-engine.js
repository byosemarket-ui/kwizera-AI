import path from "node:path";
import { ImageGenerationAccessPermission, ImageGenerationCategory, ImageGenerationModuleStatus, } from "../image-generation-foundation/types.js";
import { ImageQualityValidationAnalyzer } from "./image-quality-validation-analyzer.js";
import { ImageQualityValidationLinker } from "./image-quality-validation-linker.js";
import { ImageQualityValidationLogger } from "./image-quality-validation-logger.js";
import { ImageQualityValidationProcessor } from "./image-quality-validation-processor.js";
import { ImageQualityValidationScorer } from "./image-quality-validation-scorer.js";
import { ImageQualityValidationRecordStore } from "./image-quality-validation-stores.js";
import { ImageQualityValidationEngineError, } from "./types.js";
/**
 * AI Image Quality Validation Engine — validates every image production component
 * before rendering and export.
 */
export class AiImageQualityValidationEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ImageQualityValidationLogger();
    records = new ImageQualityValidationRecordStore();
    analyzer = new ImageQualityValidationAnalyzer();
    scorer = new ImageQualityValidationScorer();
    linker = new ImageQualityValidationLinker();
    processor = null;
    validationTimes = [];
    searchTimes = [];
    repairTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "quality-validation", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ImageQualityValidationProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Image Quality Validation Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageGenerationModule({
            moduleId: "image-quality-validation-engine",
            moduleName: "Image Quality Validation Engine",
            category: ImageGenerationCategory.ImageQualityValidation,
            version: "0.1.0",
            status: ImageGenerationModuleStatus.Active,
            dependencies: [
                "image-generation-engine",
                "image-production-engine",
                "image-rendering-preparation-engine",
            ],
            qualityScore: 96,
            confidenceScore: 94,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "quality-validation"),
            accessPermissions: [
                ImageGenerationAccessPermission.Read,
                ImageGenerationAccessPermission.Write,
                ImageGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Image Quality Validation Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async validateQuality(input) {
        this.ensureReady();
        const result = await this.processor.validateQuality(input);
        if (result.success) {
            this.validationTimes.push(result.durationMs);
        }
        return result;
    }
    getValidation(qualityValidationId) {
        this.ensureReady();
        return this.records.get(qualityValidationId) ?? null;
    }
    getValidationsByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    searchValidations(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Quality validation search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairAndRevalidate(productId, platform) {
        this.ensureReady();
        const repairStart = Date.now();
        this.logger.log("info", "repair", "Repairing and revalidating quality", { productId, platform });
        const existing = this.records.getByProduct(productId)[0] ?? null;
        const renderPlan = this.foundation.getImageRenderingPreparationEngine().getRenderPlansByProduct(productId)[0] ?? null;
        const productionPlan = this.foundation.getImageProductionEngine().getProductionPlansByProduct(productId)[0] ?? null;
        const result = await this.validateQuality({
            productId,
            renderPlanId: existing?.profile.renderPlanId ?? renderPlan?.imageRenderPlanId,
            productionId: existing?.profile.productionId ?? productionPlan?.imageProductionId,
            platform: platform ?? existing?.profile.platform,
            autoRepair: true,
            validatePrint: true,
            validatePlatform: true,
        });
        this.repairTimes.push(Date.now() - repairStart);
        return result;
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgQuality = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.overallQualityScore, 0) / all.length) : 0;
        const approvedCount = all.filter((r) => r.approved).length;
        const approvalRate = all.length > 0 ? Math.round((approvedCount / all.length) * 100) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("image-quality-validation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            imageQualityStatus: "10 checks — resolution, sharpness, noise, color, exposure, contrast, dynamic range, texture",
            layerValidationStatus: "6 layer checks — structure, order, groups, blend modes, opacity, clipping masks",
            brandValidationStatus: "6 brand checks — logo, colors, typography, assets, design and campaign consistency",
            validationsPerformed: all.length,
            averageOverallQualityScore: avgQuality,
            averageApprovalRate: approvalRate,
            performance: {
                averageValidationMs: avg(this.validationTimes),
                averageSearchMs: avg(this.searchTimes),
                averageRepairMs: avg(this.repairTimes),
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
            throw new ImageQualityValidationEngineError("Image Quality Validation Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=image-quality-validation-engine.js.map