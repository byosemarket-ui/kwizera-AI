import { VideoGenerationHealthScoreLevel, MonitoredVideoGenerationModule, } from "./types.js";
export class VideoGenerationModuleHealthChecker {
    foundation;
    constructor(foundation) {
        this.foundation = foundation;
    }
    checkAll() {
        const scores = [];
        scores.push(this.checkModule(MonitoredVideoGenerationModule.VideoGenerationFoundation, () => {
            const r = this.foundation.buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.foundationStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.StoryboardGeneration, () => {
            const r = this.foundation.getStoryGenerationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.SceneGeneration, () => {
            const r = this.foundation.getSceneGenerationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.CameraDirector, () => {
            const r = this.foundation.getCameraDirectorEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.MotionGeneration, () => {
            const r = this.foundation.getMotionGenerationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.Animation, () => {
            const r = this.foundation.getAnimationGenerationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.VisualEffects, () => {
            const r = this.foundation.getVisualEffectsGenerationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.AudioSynchronization, () => {
            const r = this.foundation.getAudioSynchronizationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.MarketingVideo, () => {
            const r = this.foundation.getMarketingVideoEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.VideoProduction, () => {
            const r = this.foundation.getVideoProductionEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.RenderingPreparation, () => {
            const r = this.foundation.getRenderingPreparationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.VideoQualityValidation, () => {
            const r = this.foundation.getVideoQualityValidationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        scores.push(this.checkModule(MonitoredVideoGenerationModule.VideoGenerationOptimization, () => {
            const r = this.foundation.getVideoGenerationOptimizationEngine().buildStatusReport();
            return {
                score: r.readinessScore,
                available: r.engineStatus === "operational",
                issues: r.knownIssues,
            };
        }));
        const renderReport = this.foundation.getRenderingPreparationEngine().buildStatusReport();
        scores.push({
            module: MonitoredVideoGenerationModule.RenderQueuePreparation,
            score: renderReport.averageRenderReadinessScore > 0 ? renderReport.readinessScore : 85,
            level: this.scoreToLevel(renderReport.readinessScore),
            available: renderReport.engineStatus === "operational",
            issues: renderReport.knownIssues,
        });
        const assetHealth = this.foundation.getAssetRegistry().verifyIntegrity();
        scores.push({
            module: MonitoredVideoGenerationModule.AssetRegistry,
            score: assetHealth.valid ? 100 : 55,
            level: this.scoreToLevel(assetHealth.valid ? 100 : 55),
            available: this.foundation.getAssetRegistry().getCount() >= 0,
            issues: assetHealth.issues,
        });
        const blueprintHealth = this.foundation.getBlueprintManager().verifyIntegrity();
        scores.push({
            module: MonitoredVideoGenerationModule.TimelineRegistry,
            score: blueprintHealth.valid ? 100 : 60,
            level: this.scoreToLevel(blueprintHealth.valid ? 100 : 60),
            available: this.foundation.getBlueprintManager().getCount() > 0,
            issues: blueprintHealth.issues,
        });
        const registry = this.foundation.getRegistry();
        scores.push({
            module: MonitoredVideoGenerationModule.ProductionRegistry,
            score: registry.verifyChecksum() ? 100 : 60,
            level: registry.verifyChecksum()
                ? VideoGenerationHealthScoreLevel.Excellent
                : VideoGenerationHealthScoreLevel.Warning,
            available: registry.getAllModules().length >= 12,
            issues: registry.verifyChecksum() ? [] : ["Production registry checksum invalid"],
        });
        return scores;
    }
    scoreToLevel(score) {
        if (score >= 95)
            return VideoGenerationHealthScoreLevel.Excellent;
        if (score >= 80)
            return VideoGenerationHealthScoreLevel.Good;
        if (score >= 60)
            return VideoGenerationHealthScoreLevel.Warning;
        if (score >= 40)
            return VideoGenerationHealthScoreLevel.Critical;
        return VideoGenerationHealthScoreLevel.Failed;
    }
    checkModule(module, fn) {
        const result = fn();
        return {
            module,
            score: result.score,
            level: this.scoreToLevel(result.score),
            available: result.available,
            issues: result.issues,
        };
    }
}
//# sourceMappingURL=module-health-checker.js.map