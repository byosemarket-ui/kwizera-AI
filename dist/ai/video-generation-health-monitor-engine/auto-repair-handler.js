import { VideoGenerationHealthScoreLevel, VideoGenerationWarningType, } from "./types.js";
export class VideoGenerationAutoRepairHandler {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    async attemptRepairs(warnings) {
        const repairs = [];
        let success = true;
        const critical = warnings.some((w) => w.severity === VideoGenerationHealthScoreLevel.Critical ||
            w.severity === VideoGenerationHealthScoreLevel.Failed);
        const hasCriticalWarning = warnings.some((w) => w.type === VideoGenerationWarningType.DatabaseProblems ||
            w.type === VideoGenerationWarningType.RegistryProblems ||
            w.type === VideoGenerationWarningType.BrokenDependencies ||
            w.type === VideoGenerationWarningType.ProductionProblems);
        if (critical || hasCriticalWarning || warnings.length > 3) {
            this.logger.log("warn", "repair", "Critical video generation issue — notifying AI Core and Recovery", {
                warningCount: warnings.length,
            });
            this.foundation.integration.reportCriticalIssue(`Critical video generation health: ${warnings.map((w) => w.message).join("; ")}`);
            repairs.push("AI Core and Recovery Engine notified");
        }
        try {
            await this.foundation.recover();
            repairs.push("Video generation foundation recovery executed");
        }
        catch {
            success = false;
        }
        const registry = this.foundation.getRegistry();
        registry.persist();
        repairs.push("Video generation registry re-persisted");
        const productionRepair = await this.foundation
            .getVideoProductionEngine()
            .repairProductionPlans("health-monitor-repair")
            .catch(() => null);
        if (productionRepair?.success) {
            repairs.push("Video production plan repair attempted");
        }
        const renderRepair = await this.foundation
            .getRenderingPreparationEngine()
            .repairRenderPlans("health-monitor-repair")
            .catch(() => null);
        if (renderRepair?.success) {
            repairs.push("Rendering preparation repair attempted");
        }
        const qualityRepair = await this.foundation
            .getVideoQualityValidationEngine()
            .repairValidation("health-monitor-repair")
            .catch(() => null);
        if (qualityRepair?.success) {
            repairs.push("Quality validation repair attempted");
        }
        const optimizationRepair = await this.foundation
            .getVideoGenerationOptimizationEngine()
            .repairOptimization("health-monitor-repair")
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
        this.logger.log("info", "repair", "Automatic video generation repair complete", {
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