import path from "node:path";
import { ImageGenerationAccessPermission, ImageGenerationCategory, ImageGenerationModuleStatus, } from "../image-generation-foundation/types.js";
import { BrandingDesignAnalyzer } from "./branding-design-analyzer.js";
import { BrandingDesignLinker } from "./branding-design-linker.js";
import { BrandingDesignLogger } from "./branding-design-logger.js";
import { BrandingDesignProcessor } from "./branding-design-processor.js";
import { BrandingDesignScorer } from "./branding-design-scorer.js";
import { BrandingDesignRecordStore } from "./branding-design-stores.js";
import { BrandingDesignEngineError, } from "./types.js";
/**
 * AI Branding & Graphic Design Engine — generates professional branding assets
 * and graphic design blueprints while maintaining brand consistency and production readiness.
 */
export class AiBrandingDesignEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new BrandingDesignLogger();
    records = new BrandingDesignRecordStore();
    analyzer = new BrandingDesignAnalyzer();
    scorer = new BrandingDesignScorer();
    linker = new BrandingDesignLinker();
    processor = null;
    generationTimes = [];
    searchTimes = [];
    planningTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getGenerationRoot(), "branding", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new BrandingDesignProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Branding & Graphic Design Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageGenerationModule({
            moduleId: "branding-design-generation-engine",
            moduleName: "Branding & Graphic Design Engine",
            category: ImageGenerationCategory.BrandingDesign,
            version: "0.1.0",
            status: ImageGenerationModuleStatus.Active,
            dependencies: [
                "image-generation-engine",
                "product-image-generation-engine",
                "image-enhancement-generation-engine",
            ],
            qualityScore: 93,
            confidenceScore: 91,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "branding"),
            accessPermissions: [
                ImageGenerationAccessPermission.Read,
                ImageGenerationAccessPermission.Write,
                ImageGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Branding & Graphic Design Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async generateBrandingPlan(input) {
        this.ensureReady();
        const result = await this.processor.generateBrandingPlan(input);
        if (result.success) {
            this.generationTimes.push(result.durationMs);
            this.planningTimes.push(result.durationMs);
        }
        return result;
    }
    getBrandingPlan(brandDesignId) {
        this.ensureReady();
        return this.records.get(brandDesignId) ?? null;
    }
    getBrandingPlansByProduct(productId) {
        this.ensureReady();
        return this.records.getByProduct(productId);
    }
    getBrandingPlansByBrand(brandId) {
        this.ensureReady();
        return this.records.getByBrand(brandId);
    }
    searchBrandingPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        this.logger.log("info", "search", "Branding plan search executed", {
            query,
            resultCount: results.length,
            durationMs: Date.now() - start,
        });
        return results;
    }
    async repairBrandingPlan(productId, platform) {
        this.ensureReady();
        this.logger.log("info", "repair", "Repairing branding plan", { productId, platform });
        const existingPlans = this.records.getByProduct(productId);
        const existing = existingPlans[0] ?? null;
        const productImagePlan = this.foundation.getProductImageGenerationEngine().getProductImagePlansByProduct(productId)[0] ?? null;
        const enhancePlans = productImagePlan
            ? this.foundation.getImageEnhancementEngine().getEnhancementPlansBySourceImage(productImagePlan.productImagePlanId)
            : [];
        const enhancementPlan = enhancePlans[0] ?? null;
        return this.generateBrandingPlan({
            productId,
            productImagePlanId: existing?.relationships.productImagePlans[0] ?? productImagePlan?.productImagePlanId,
            enhancementPlanId: existing?.relationships.enhancementPlans[0] ?? enhancementPlan?.enhancementPlanId,
            brandId: existing?.profile.brandId,
            platform: platform ?? existing?.profile.platform,
            designType: existing?.profile.designType,
            colorPalette: existing?.colorManagement.rgbPalette,
            generateLogoPlan: true,
            generateMarketingMaterials: true,
            generateSocialMediaDesign: true,
            generatePrintDesign: true,
            generatePlatformOptimizations: true,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgBranding = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.brandingScore, 0) / all.length) : 0;
        const avgPrint = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.printReadinessScore, 0) / all.length)
            : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.isStartupComplete())
            readinessScore -= 10;
        const module = this.foundation?.getRegistry().getModule("branding-design-generation-engine");
        if (!module?.implemented)
            readinessScore -= 15;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            designPlanningStatus: "layout, hierarchy, grid, composition, alignment, white space, typography, icons, illustration",
            logoPlanningStatus: "6 logo variants — primary, secondary, icon, monochrome, light/dark background",
            marketingMaterialsStatus: "12 marketing material types including posters, flyers, brochures, packaging",
            socialMediaDesignStatus: "9 social formats — Instagram, Facebook, LinkedIn, TikTok, YouTube",
            printDesignStatus: "9 print formats — A4, A5, A3, business card, roll-up, billboard, packaging, stickers, labels",
            brandingPlansGenerated: all.length,
            averageBrandingScore: avgBranding,
            averagePrintReadinessScore: avgPrint,
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
            throw new BrandingDesignEngineError("Branding & Graphic Design Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=branding-design-engine.js.map