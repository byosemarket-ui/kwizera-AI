import fs from "node:fs";
import { ImageIntelligenceModuleStatus } from "../image-intelligence-foundation/types.js";
const EXTERNAL_II_DEPENDENCIES = new Set([
    "image-engine",
    "knowledge-engine",
    "memory-engine",
    "product-intelligence-engine",
]);
const MODULE_ID_ALIASES = {
    "object-detection-intelligence-engine": "object-detection-intelligence",
    "background-intelligence-engine": "background-intelligence",
    "composition-intelligence-engine": "composition-intelligence",
    "lighting-color-intelligence-engine": "lighting-color-intelligence",
    "brand-visual-intelligence-engine": "brand-visual-intelligence",
    "image-enhancement-planning-engine": "image-enhancement-planning",
    "creative-image-intelligence-engine": "creative-image-intelligence",
    "production-image-planning-engine": "production-image-planning",
    "image-quality-prediction-engine": "image-quality-prediction",
    "image-intelligence-optimization-engine": "image-intelligence-optimization",
};
function resolveModuleId(dep) {
    return MODULE_ID_ALIASES[dep] ?? dep;
}
function isDependencySatisfied(foundation, dep) {
    if (EXTERNAL_II_DEPENDENCIES.has(dep) || dep === "image-engine" || dep === "product-engine") {
        const status = foundation.integration.getStatus();
        if (dep === "knowledge-engine")
            return status.knowledgeEngine;
        if (dep === "memory-engine")
            return status.memoryEngine;
        if (dep === "product-intelligence-engine" || dep === "product-engine") {
            return status.productIntelligenceEngine;
        }
        return true;
    }
    const depMod = foundation.getRegistry().getModule(resolveModuleId(dep));
    return Boolean(depMod?.implemented ||
        depMod?.status === ImageIntelligenceModuleStatus.Prepared ||
        depMod?.status === ImageIntelligenceModuleStatus.Registered ||
        depMod?.status === ImageIntelligenceModuleStatus.Active);
}
export class ImageIntelligenceAuditor {
    foundation;
    storageRoot;
    logger;
    constructor(foundation, storageRoot, logger) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.logger = logger;
    }
    async runAudit() {
        const start = Date.now();
        const auditId = `ii-audit-${Date.now()}`;
        const enhancementReport = this.foundation.getImageEnhancementPlanningEngine().buildStatusReport();
        const creativeReport = this.foundation.getCreativeImageIntelligenceEngine().buildStatusReport();
        const productionReport = this.foundation.getProductionImagePlanningEngine().buildStatusReport();
        const planningIntegrity = enhancementReport.readinessScore >= 75 &&
            creativeReport.readinessScore >= 75 &&
            productionReport.readinessScore >= 75;
        const qpReport = this.foundation.getImageQualityPredictionEngine().buildStatusReport();
        const imageQuality = qpReport.readinessScore >= 75 &&
            (qpReport.predictionsCreated === 0 || qpReport.averageOverallQualityScore >= 55);
        const relationshipIntegrity = qpReport.readinessScore >= 75 &&
            (qpReport.predictionsCreated === 0 || qpReport.averageOverallQualityScore >= 55);
        const creativeConsistency = creativeReport.readinessScore >= 75 &&
            (creativeReport.averageLayoutScore === 0 || creativeReport.averageLayoutScore >= 55);
        const brandReport = this.foundation.getBrandVisualIntelligenceEngine().buildStatusReport();
        const brandConsistency = brandReport.readinessScore >= 75 &&
            (brandReport.averageConsistencyScore === 0 || brandReport.averageConsistencyScore >= 55);
        const registry = this.foundation.getRegistry();
        const implemented = registry.getAllModules().filter((m) => m.implemented);
        const dependencyValidation = implemented.every((mod) => mod.dependencies.every((dep) => isDependencySatisfied(this.foundation, dep)));
        const optimizationStatus = this.foundation.getImageIntelligenceOptimizationEngine().buildStatusReport().readinessScore >= 75;
        const qualityPredictionStatus = qpReport.readinessScore >= 75;
        const intelligenceRoot = this.foundation.getIntelligenceRoot();
        const storageOk = fs.existsSync(intelligenceRoot);
        const valid = storageOk &&
            imageQuality &&
            planningIntegrity &&
            relationshipIntegrity &&
            dependencyValidation &&
            optimizationStatus &&
            qualityPredictionStatus;
        this.logger.log("info", "audit", "Image intelligence audit complete", {
            auditId,
            valid,
            durationMs: Date.now() - start,
        });
        return {
            auditId,
            timestamp: new Date().toISOString(),
            imageQuality,
            planningIntegrity,
            relationshipIntegrity,
            creativeConsistency,
            brandConsistency,
            dependencyValidation,
            optimizationStatus,
            qualityPredictionStatus,
            valid,
            durationMs: Date.now() - start,
        };
    }
}
//# sourceMappingURL=image-intelligence-auditor.js.map