import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import {
  VideoIntelligenceHealthScoreLevel,
  MonitoredVideoIntelligenceModule,
  MonitoredVideoIntelligenceModuleHealthScore,
} from "./types.js";

export class VideoIntelligenceModuleHealthChecker {
  constructor(private readonly foundation: AiVideoIntelligenceFoundation) {}

  checkAll(): MonitoredVideoIntelligenceModuleHealthScore[] {
    const scores: MonitoredVideoIntelligenceModuleHealthScore[] = [];

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.VideoIntelligenceFoundation, () => {
        const r = this.foundation.buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.foundationStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.VideoAnalysis, () => {
        const r = this.foundation.getVideoAnalysisEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.VideoUnderstanding, () => {
        const r = this.foundation.getVideoUnderstandingEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.SceneDetection, () => {
        const r = this.foundation.getSceneDetectionEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.TimelineIntelligence, () => {
        const r = this.foundation.getTimelineIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.CameraMovement, () => {
        const r = this.foundation.getCameraMovementEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.MotionIntelligence, () => {
        const r = this.foundation.getMotionIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.VideoStyle, () => {
        const r = this.foundation.getVideoStyleIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.VideoEnhancementPlanning, () => {
        const r = this.foundation.getVideoEnhancementPlanningEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.CreativeVideoIntelligence, () => {
        const r = this.foundation.getCreativeVideoIntelligenceEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.ProductionVideoPlanning, () => {
        const r = this.foundation.getProductionVideoPlanningEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.VideoQualityPrediction, () => {
        const r = this.foundation.getVideoQualityPredictionEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    scores.push(
      this.checkModule(MonitoredVideoIntelligenceModule.VideoIntelligenceOptimization, () => {
        const r = this.foundation.getVideoIntelligenceOptimizationEngine().buildStatusReport();
        return {
          score: r.readinessScore,
          available: r.engineStatus === "operational",
          issues: r.knownIssues,
        };
      })
    );

    const registry = this.foundation.getRegistry();
    const modules = registry.getAllModules();
    scores.push({
      module: MonitoredVideoIntelligenceModule.VideoIntelligenceRegistry,
      score: registry.verifyChecksum() ? 100 : 60,
      level: registry.verifyChecksum()
        ? VideoIntelligenceHealthScoreLevel.Excellent
        : VideoIntelligenceHealthScoreLevel.Warning,
      available: modules.length >= 12,
      issues: registry.verifyChecksum() ? [] : ["Registry checksum invalid"],
    });

    const persistence = this.foundation.buildStatusReport();
    scores.push({
      module: MonitoredVideoIntelligenceModule.VideoIntelligenceDatabase,
      score: persistence.persistenceStatus.includes("survives") ? 100 : 55,
      level: this.scoreToLevel(persistence.persistenceStatus.includes("survives") ? 100 : 55),
      available: persistence.storageStatus.includes("verified"),
      issues: persistence.persistenceStatus.includes("survives") ? [] : ["Database persistence unverified"],
    });

    const timelineReport = this.foundation.getTimelineIntelligenceEngine().buildStatusReport();
    const timelineScore = Math.min(
      100,
      timelineReport.readinessScore +
        (timelineReport.averageSynchronizationScore >= 55 ? 5 : 0)
    );
    scores.push({
      module: MonitoredVideoIntelligenceModule.TimelineDatabase,
      score: timelineScore,
      level: this.scoreToLevel(timelineScore),
      available: timelineReport.engineStatus === "operational",
      issues:
        timelineReport.averageTimelineQualityScore > 0 &&
        timelineReport.averageTimelineQualityScore < 55
          ? ["Timeline quality below threshold"]
          : [],
    });

    const qpReport = this.foundation.getVideoQualityPredictionEngine().buildStatusReport();
    const relationshipScore = Math.min(
      100,
      70 + (qpReport.predictionsCreated > 0 ? 15 : 0) + (qpReport.averageOverallQualityScore >= 55 ? 15 : 0)
    );
    scores.push({
      module: MonitoredVideoIntelligenceModule.VideoRelationships,
      score: relationshipScore,
      level: this.scoreToLevel(relationshipScore),
      available: qpReport.engineStatus === "operational",
      issues: qpReport.predictionsCreated === 0 ? ["No quality predictions to validate relationships"] : [],
    });

    const analysisPerf = this.foundation.getVideoAnalysisEngine().buildStatusReport().performance;
    const qpPerf = this.foundation.getVideoQualityPredictionEngine().buildStatusReport().performance;
    const searchMs = Math.max(analysisPerf.averageSearchMs, qpPerf.averageSearchMs);
    const searchScore = searchMs > 200 ? 50 : searchMs > 100 ? 70 : 95;
    scores.push({
      module: MonitoredVideoIntelligenceModule.VideoSearch,
      score: searchScore,
      level: this.scoreToLevel(searchScore),
      available: true,
      issues: searchMs > 150 ? [`Search averaging ${searchMs}ms`] : [],
    });

    const cache = this.foundation.getVideoIntelligenceOptimizationEngine().getCache();
    const cacheScore = Math.min(100, 60 + cache.hitRate / 2 + (cache.videos.length > 0 ? 10 : 0));
    scores.push({
      module: MonitoredVideoIntelligenceModule.VideoCache,
      score: cacheScore,
      level: this.scoreToLevel(cacheScore),
      available: true,
      issues: cache.hitRate < 5 ? ["Cache not warmed"] : [],
    });

    return scores;
  }

  scoreToLevel(score: number): VideoIntelligenceHealthScoreLevel {
    if (score >= 95) return VideoIntelligenceHealthScoreLevel.Excellent;
    if (score >= 80) return VideoIntelligenceHealthScoreLevel.Good;
    if (score >= 60) return VideoIntelligenceHealthScoreLevel.Warning;
    if (score >= 40) return VideoIntelligenceHealthScoreLevel.Critical;
    return VideoIntelligenceHealthScoreLevel.Failed;
  }

  private checkModule(
    module: MonitoredVideoIntelligenceModule,
    fn: () => { score: number; available: boolean; issues: string[] }
  ): MonitoredVideoIntelligenceModuleHealthScore {
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
