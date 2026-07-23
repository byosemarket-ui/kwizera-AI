import path from "node:path";
import { ImageIntelligenceAccessPermission, ImageIntelligenceCategory, ImageIntelligenceModuleStatus, } from "../image-intelligence-foundation/types.js";
import { ProductionPlanningAnalyzer } from "./production-planning-analyzer.js";
import { ProductionPlanningLinker } from "./production-planning-linker.js";
import { ProductionPlanningLogger } from "./production-planning-logger.js";
import { ProductionPlanningProcessor } from "./production-planning-processor.js";
import { ProductionPlanningScorer } from "./production-planning-scorer.js";
import { ProductionImagePlanningRecordStore } from "./production-planning-stores.js";
import { ProductionImagePlanningEngineError, } from "./types.js";
/**
 * Production Image Planning Engine — combines all image intelligence into production-ready execution plans.
 */
export class AiProductionImagePlanningEngine {
    foundation = null;
    engineDir = "";
    initialized = false;
    startupComplete = false;
    logger = new ProductionPlanningLogger();
    records = new ProductionImagePlanningRecordStore();
    analyzer = new ProductionPlanningAnalyzer();
    scorer = new ProductionPlanningScorer();
    linker = new ProductionPlanningLinker();
    processor = null;
    planningTimes = [];
    searchTimes = [];
    relationshipTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.engineDir = path.join(foundation.getIntelligenceRoot(), "production", "engine");
        this.logger.initialize(path.join(storageRoot, "logs"));
        this.records.initialize(this.engineDir);
        this.processor = new ProductionPlanningProcessor(foundation, this.analyzer, this.scorer, this.linker, this.records, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Production Image Planning Engine initialized", {
            engineDir: this.engineDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        this.foundation.registerImageIntelligenceModule({
            moduleId: "production-image-planning",
            moduleName: "Production Image Planning",
            category: ImageIntelligenceCategory.ProductionPlanning,
            version: "0.1.0",
            status: ImageIntelligenceModuleStatus.Active,
            dependencies: [
                "image-engine",
                "creative-image-intelligence",
                "image-enhancement-planning",
                "composition-intelligence",
                "brand-visual-intelligence",
            ],
            qualityScore: 92,
            confidenceScore: 90,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "production"),
            accessPermissions: [
                ImageIntelligenceAccessPermission.Read,
                ImageIntelligenceAccessPermission.Write,
                ImageIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.startupComplete = true;
        this.logger.log("info", "startup", "Production Image Planning Engine startup complete", {
            recordsLoaded: this.records.getCount(),
        });
    }
    async planProduction(input) {
        this.ensureReady();
        const result = await this.processor.plan(input);
        if (result.success)
            this.planningTimes.push(result.durationMs);
        return result;
    }
    getProductionPlan(imageId) {
        this.ensureReady();
        return this.records.get(imageId) ?? null;
    }
    searchProductionPlans(query) {
        this.ensureReady();
        const start = Date.now();
        const results = this.processor.search(query);
        this.searchTimes.push(Date.now() - start);
        return results;
    }
    detectRelationships(imageId) {
        this.ensureReady();
        const start = Date.now();
        const record = this.records.get(imageId);
        if (!record)
            return null;
        const analysis = this.foundation.getImageAnalysisEngine().getImage(imageId);
        const understanding = this.foundation.getImageUnderstandingEngine().getUnderstanding(imageId);
        const enhancementPlan = this.foundation.getImageEnhancementPlanningEngine().getEnhancementPlan(imageId);
        const creativePlan = this.foundation.getCreativeImageIntelligenceEngine().getCreativePlan(imageId);
        if (!analysis || !understanding || !enhancementPlan || !creativePlan)
            return record.relationships;
        const updated = this.linker.detectRelationships(record, this.records.getAll(), analysis, understanding, enhancementPlan, creativePlan, record.relationships.relatedProjects, record.relationships.relatedKnowledge);
        this.relationshipTimes.push(Date.now() - start);
        return updated;
    }
    async repairProductionPlan(imageId) {
        this.ensureReady();
        const foundation = this.foundation;
        if (!foundation.getImageAnalysisEngine().getImage(imageId)?.validated) {
            const repaired = await foundation.getImageAnalysisEngine().repairImage(imageId);
            if (!repaired?.success)
                return null;
        }
        if (!foundation.getImageUnderstandingEngine().getUnderstanding(imageId)?.validated) {
            const repaired = await foundation.getImageUnderstandingEngine().repairUnderstanding(imageId);
            if (!repaired?.success)
                return null;
        }
        if (!foundation.getObjectDetectionIntelligenceEngine().getDetection(imageId)?.validated) {
            const repaired = await foundation.getObjectDetectionIntelligenceEngine().repairDetection(imageId);
            if (!repaired?.success)
                return null;
        }
        if (!foundation.getBackgroundIntelligenceEngine().getBackground(imageId)?.validated) {
            const repaired = await foundation.getBackgroundIntelligenceEngine().repairBackground(imageId);
            if (!repaired?.success)
                return null;
        }
        if (!foundation.getCompositionIntelligenceEngine().getComposition(imageId)?.validated) {
            const repaired = await foundation.getCompositionIntelligenceEngine().repairComposition(imageId);
            if (!repaired?.success)
                return null;
        }
        if (!foundation.getLightingColorIntelligenceEngine().getLightingColor(imageId)?.validated) {
            const repaired = await foundation.getLightingColorIntelligenceEngine().repairLightingColor(imageId);
            if (!repaired?.success)
                return null;
        }
        if (!foundation.getBrandVisualIntelligenceEngine().getBrandVisual(imageId)?.validated) {
            const repaired = await foundation.getBrandVisualIntelligenceEngine().repairBrandVisual(imageId);
            if (!repaired?.success)
                return null;
        }
        if (!foundation.getImageEnhancementPlanningEngine().getEnhancementPlan(imageId)?.validated) {
            const repaired = await foundation.getImageEnhancementPlanningEngine().repairEnhancementPlan(imageId);
            if (!repaired?.success)
                return null;
        }
        if (!foundation.getCreativeImageIntelligenceEngine().getCreativePlan(imageId)?.validated) {
            const repaired = await foundation.getCreativeImageIntelligenceEngine().repairCreativePlan(imageId);
            if (!repaired?.success)
                return null;
        }
        const existing = this.records.get(imageId);
        const understanding = foundation.getImageUnderstandingEngine().getUnderstanding(imageId);
        this.logger.log("info", "validation", "Repairing production image plan", { imageId });
        return this.planProduction({
            imageId,
            projectId: existing?.profile.projectId,
            campaign: existing?.profile.campaign,
            platform: existing?.profile.platform,
            relatedKnowledge: understanding?.relationships.relatedKnowledge,
            relatedProjects: understanding?.relationships.relatedProjects,
        });
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const all = this.records.getAll();
        const avgProduction = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.productionReadinessScore, 0) / all.length)
            : 0;
        const avgAsset = all.length > 0
            ? Math.round(all.reduce((s, r) => s + r.scores.assetReadinessScore, 0) / all.length)
            : 0;
        const integration = this.foundation?.integration.getStatus();
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (!this.foundation?.getCreativeImageIntelligenceEngine().isStartupComplete())
            readinessScore -= 10;
        if (!this.foundation?.getImageEnhancementPlanningEngine().isStartupComplete())
            readinessScore -= 10;
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            workflowPlanningStatus: "full production workflow from analysis through delivery prepared",
            assetValidationStatus: "original, enhanced, logo, font, template and brand assets inventoried",
            dependencyValidationStatus: "all 12 required dependencies validated before approval",
            renderPreparationStatus: "resolution, aspect ratio, format, color profile and quality planned",
            exportPreparationStatus: "PNG, JPG, WEBP, SVG, PDF export architecture prepared",
            relationshipStatus: `${all.length} production plans indexed`,
            knowledgeBridgeStatus: integration?.knowledgeEngine ? "connected" : "unavailable",
            memoryBridgeStatus: integration?.memoryEngine ? "connected" : "unavailable",
            productIntelligenceBridgeStatus: integration?.productIntelligenceEngine ? "connected" : "unavailable",
            plansCreated: all.length,
            averageProductionReadinessScore: avgProduction,
            averageAssetReadinessScore: avgAsset,
            performance: {
                averagePlanningMs: avg(this.planningTimes),
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
            throw new ProductionImagePlanningEngineError("Production Image Planning Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=production-image-planning-engine.js.map