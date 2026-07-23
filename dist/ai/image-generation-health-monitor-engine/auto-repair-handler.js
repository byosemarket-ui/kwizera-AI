import { ImageGenerationHealthScoreLevel, ImageGenerationWarningType, } from "./types.js";
export class ImageGenerationAutoRepairHandler {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    async attemptRepairs(warnings) {
        const repairs = [];
        let success = true;
        const critical = warnings.some((w) => w.severity === ImageGenerationHealthScoreLevel.Critical ||
            w.severity === ImageGenerationHealthScoreLevel.Failed);
        const hasCriticalWarning = warnings.some((w) => w.type === ImageGenerationWarningType.DatabaseProblems ||
            w.type === ImageGenerationWarningType.RegistryProblems ||
            w.type === ImageGenerationWarningType.BrokenDependencies ||
            w.type === ImageGenerationWarningType.ProductionProblems);
        if (critical || hasCriticalWarning || warnings.length > 3) {
            this.logger.log("warn", "repair", "Critical image generation issue — notifying AI Core and Recovery", {
                warningCount: warnings.length,
            });
            this.foundation.integration.reportCriticalIssue(`Critical image generation health: ${warnings.map((w) => w.message).join("; ")}`);
            repairs.push("AI Core and Recovery Engine notified");
        }
        else if (warnings.length > 0) {
            repairs.push("Diagnostics collected");
        }
        try {
            await this.foundation.recover();
            repairs.push("Image generation foundation recovery executed");
        }
        catch {
            success = false;
        }
        const registry = this.foundation.getRegistry();
        registry.persist();
        repairs.push("Image generation registry re-persisted");
        this.foundation.getAssetRegistry().repairSafeIssues();
        repairs.push("Asset registry safe repairs attempted");
        const productionRecords = this.foundation.getImageProductionEngine().buildStatusReport();
        if (productionRecords.productionPlansGenerated > 0) {
            const productionRepair = await this.foundation
                .getImageProductionEngine()
                .repairProductionPlan("health-monitor-repair")
                .catch(() => null);
            if (productionRepair?.success) {
                repairs.push("Image production plan repair attempted");
            }
        }
        const renderRecords = this.foundation.getImageRenderingPreparationEngine().buildStatusReport();
        if (renderRecords.renderPlansGenerated > 0) {
            const renderRepair = await this.foundation
                .getImageRenderingPreparationEngine()
                .repairRenderPlan("health-monitor-repair")
                .catch(() => null);
            if (renderRepair?.success) {
                repairs.push("Rendering preparation repair attempted");
            }
        }
        const qualityRepair = await this.foundation
            .getImageQualityValidationEngine()
            .repairAndRevalidate("health-monitor-repair")
            .catch(() => null);
        if (qualityRepair?.success) {
            repairs.push("Quality validation repair attempted");
        }
        const optimizationRepair = await this.foundation
            .getImageGenerationOptimizationEngine()
            .repairAndReoptimize("health-monitor-repair")
            .catch(() => null);
        if (optimizationRepair?.success) {
            repairs.push("Generation optimization repair attempted");
        }
        let validated = false;
        try {
            const integrity = this.foundation.getLastIntegrityResult();
            const health = await this.foundation.runHealthCheck();
            validated = (integrity?.verified ?? true) && health.score >= 60;
            if (!validated) {
                repairs.push("Post-repair validation flagged remaining issues");
            }
        }
        catch {
            success = false;
        }
        this.logger.log("info", "repair", "Automatic image generation repair complete", {
            repairs,
            validated,
        });
        return {
            attempted: repairs.length > 0,
            success,
            repairs,
            validated,
        };
    }
}
//# sourceMappingURL=auto-repair-handler.js.map