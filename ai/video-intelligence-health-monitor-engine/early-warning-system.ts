import fs from "node:fs";

import path from "node:path";

import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";

import { VideoIntelligenceModuleStatus } from "../video-intelligence-foundation/types.js";

import {

  deriveVideoIntelligencePerformanceIssues,

  VideoIntelligenceResourceMetrics,

} from "./resource-monitor.js";

import {

  VideoIntelligenceHealthScoreLevel,

  VideoIntelligenceHealthWarning,

  VideoIntelligenceWarningType,

  MonitoredVideoIntelligenceModule,

  MonitoredVideoIntelligenceModuleHealthScore,

} from "./types.js";



const MODULE_ID_ALIASES: Record<string, string> = {

  "video-analysis-engine": "video-analysis-engine",

  "video-understanding-engine": "video-understanding-engine",

  "scene-detection-intelligence-engine": "scene-intelligence",

  "timeline-intelligence-engine": "timeline-intelligence",

  "camera-movement-intelligence-engine": "camera-intelligence",

  "motion-intelligence-engine": "motion-intelligence",

  "video-style-intelligence-engine": "video-style-intelligence",

  "video-enhancement-planning-engine": "video-enhancement-planning",

  "creative-video-intelligence-engine": "creative-video-intelligence",

  "production-video-planning-engine": "production-video-planning",

  "video-quality-prediction-engine": "video-quality-prediction",

  "video-intelligence-optimization-engine": "video-intelligence-optimization",

};



function resolveModuleId(dep: string): string {

  return MODULE_ID_ALIASES[dep] ?? dep;

}



export class VideoIntelligenceEarlyWarningSystem {

  constructor(private readonly foundation: AiVideoIntelligenceFoundation) {}



  async detect(

    moduleScores: MonitoredVideoIntelligenceModuleHealthScore[],

    metrics: VideoIntelligenceResourceMetrics

  ): Promise<VideoIntelligenceHealthWarning[]> {

    const warnings: VideoIntelligenceHealthWarning[] = [];



    const persistence = this.foundation.buildStatusReport();

    if (!persistence.persistenceStatus.includes("survives")) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.DatabaseProblems,

          MonitoredVideoIntelligenceModule.VideoIntelligenceDatabase,

          "Video intelligence database persistence unverified",

          "Run foundation integrity verification and recovery"

        )

      );

    }



    const registry = this.foundation.getRegistry();

    if (!registry.verifyChecksum()) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.RegistryProblems,

          MonitoredVideoIntelligenceModule.VideoIntelligenceRegistry,

          "Video intelligence registry checksum invalid",

          "Re-persist registry and verify module registrations"

        )

      );

    }



    const integrity = this.foundation.getLastIntegrityResult();

    if (integrity && !integrity.verified) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.BrokenDependencies,

          MonitoredVideoIntelligenceModule.VideoIntelligenceFoundation,

          "Video intelligence integrity issues detected",

          "Run dependency validation and foundation recovery"

        )

      );

    }



    const intelligenceRoot = this.foundation.getIntelligenceRoot();

    const storageChecks: {

      relativePath: string;

      module: MonitoredVideoIntelligenceModule;

      type: VideoIntelligenceWarningType;

      label: string;

      recommendation: string;

    }[] = [

      {

        relativePath: path.join("analysis", "engine", "video-analysis-records.json"),

        module: MonitoredVideoIntelligenceModule.VideoAnalysis,

        type: VideoIntelligenceWarningType.VideoAnalysisFailure,

        label: "Video analysis records",

        recommendation: "Restore video analysis records from recovery point",

      },

      {

        relativePath: path.join("understanding", "engine", "video-understanding-records.json"),

        module: MonitoredVideoIntelligenceModule.VideoUnderstanding,

        type: VideoIntelligenceWarningType.RelationshipFailure,

        label: "Video understanding records",

        recommendation: "Repair video understanding records and relationships",

      },

      {

        relativePath: path.join("registry", "video-intelligence-registry.json"),

        module: MonitoredVideoIntelligenceModule.VideoIntelligenceRegistry,

        type: VideoIntelligenceWarningType.RegistryProblems,

        label: "Video intelligence registry",

        recommendation: "Re-persist registry from foundation recovery",

      },

      {

        relativePath: path.join("scenes", "engine", "scene-detection-records.json"),

        module: MonitoredVideoIntelligenceModule.SceneDetection,

        type: VideoIntelligenceWarningType.SceneDetectionFailure,

        label: "Scene detection records",

        recommendation: "Restore scene detection records from recovery point",

      },

      {

        relativePath: path.join("timelines", "engine", "timeline-intelligence-records.json"),

        module: MonitoredVideoIntelligenceModule.TimelineIntelligence,

        type: VideoIntelligenceWarningType.TimelineProblems,

        label: "Timeline intelligence records",

        recommendation: "Repair timeline intelligence records",

      },

      {

        relativePath: path.join("motion", "intelligence", "motion-intelligence-records.json"),

        module: MonitoredVideoIntelligenceModule.MotionIntelligence,

        type: VideoIntelligenceWarningType.MotionProblems,

        label: "Motion intelligence records",

        recommendation: "Review motion intelligence analysis records",

      },

      {

        relativePath: path.join("cameras", "engine", "camera-movement-records.json"),

        module: MonitoredVideoIntelligenceModule.CameraMovement,

        type: VideoIntelligenceWarningType.CameraProblems,

        label: "Camera movement records",

        recommendation: "Review camera movement intelligence records",

      },

    ];



    for (const check of storageChecks) {

      const filePath = path.join(intelligenceRoot, check.relativePath);

      if (!fs.existsSync(filePath)) continue;

      try {

        JSON.parse(fs.readFileSync(filePath, "utf8"));

      } catch {

        warnings.push(

          this.warn(check.type, check.module, `${check.label} storage corrupted or invalid`, check.recommendation)

        );

      }

    }



    const implemented = registry

      .getAllModules()

      .filter((m) => m.implemented && m.status === VideoIntelligenceModuleStatus.Active);

    const missingDeps: string[] = [];

    const externalDeps = new Set([

      "video-engine",

      "knowledge-engine",

      "memory-engine",

      "product-intelligence-engine",

      "image-intelligence-engine",

    ]);

    for (const mod of implemented) {

      for (const dep of mod.dependencies) {

        if (externalDeps.has(dep)) continue;

        const depMod = registry.getModule(resolveModuleId(dep));

        if (!depMod?.implemented) {

          missingDeps.push(`${mod.moduleId} missing ${dep}`);

        }

      }

    }

    if (missingDeps.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.BrokenDependencies,

          MonitoredVideoIntelligenceModule.VideoIntelligenceFoundation,

          `${missingDeps.length} broken dependency reference(s)`,

          "Validate module registration order and dependencies"

        )

      );

    }



    const sceneReport = this.foundation.getSceneDetectionEngine().buildStatusReport();

    if (sceneReport.knownIssues.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.SceneDetectionFailure,

          MonitoredVideoIntelligenceModule.SceneDetection,

          sceneReport.knownIssues.join("; "),

          "Review scene detection records"

        )

      );

    }



    const timelineReport = this.foundation.getTimelineIntelligenceEngine().buildStatusReport();

    if (timelineReport.knownIssues.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.TimelineProblems,

          MonitoredVideoIntelligenceModule.TimelineIntelligence,

          timelineReport.knownIssues.join("; "),

          "Repair timeline intelligence records"

        )

      );

    }



    const motionReport = this.foundation.getMotionIntelligenceEngine().buildStatusReport();

    if (motionReport.knownIssues.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.MotionProblems,

          MonitoredVideoIntelligenceModule.MotionIntelligence,

          motionReport.knownIssues.join("; "),

          "Review motion intelligence analysis"

        )

      );

    }



    const cameraReport = this.foundation.getCameraMovementEngine().buildStatusReport();

    if (cameraReport.knownIssues.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.CameraProblems,

          MonitoredVideoIntelligenceModule.CameraMovement,

          cameraReport.knownIssues.join("; "),

          "Review camera movement intelligence"

        )

      );

    }



    const styleReport = this.foundation.getVideoStyleIntelligenceEngine().buildStatusReport();

    if (styleReport.averageStyleConsistencyScore > 0 && styleReport.averageStyleConsistencyScore < 55) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.StyleProblems,

          MonitoredVideoIntelligenceModule.VideoStyle,

          `Style consistency below threshold (${styleReport.averageStyleConsistencyScore})`,

          "Re-analyze video style intelligence"

        )

      );

    }



    const enhancementReport = this.foundation.getVideoEnhancementPlanningEngine().buildStatusReport();

    if (enhancementReport.knownIssues.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.EnhancementPlanningProblems,

          MonitoredVideoIntelligenceModule.VideoEnhancementPlanning,

          enhancementReport.knownIssues.join("; "),

          "Review video enhancement planning records"

        )

      );

    }



    const creativeReport = this.foundation.getCreativeVideoIntelligenceEngine().buildStatusReport();

    if (creativeReport.knownIssues.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.CreativePlanningProblems,

          MonitoredVideoIntelligenceModule.CreativeVideoIntelligence,

          creativeReport.knownIssues.join("; "),

          "Review creative video planning records"

        )

      );

    }



    const productionReport = this.foundation.getProductionVideoPlanningEngine().buildStatusReport();

    if (productionReport.knownIssues.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.ProductionPlanningProblems,

          MonitoredVideoIntelligenceModule.ProductionVideoPlanning,

          productionReport.knownIssues.join("; "),

          "Run production video planning repair"

        )

      );

    }



    const analysisReport = this.foundation.getVideoAnalysisEngine().buildStatusReport();

    if (analysisReport.knownIssues.length > 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.VideoAnalysisFailure,

          MonitoredVideoIntelligenceModule.VideoAnalysis,

          analysisReport.knownIssues.join("; "),

          "Re-analyze affected videos"

        )

      );

    }



    if (metrics.searchPerformanceMs > 150) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.SearchFailure,

          MonitoredVideoIntelligenceModule.VideoSearch,

          `Video search averaging ${metrics.searchPerformanceMs}ms`,

          "Run video intelligence optimization for search performance"

        )

      );

    }



    if (metrics.planningPerformanceMs > 120000) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.ProductionPlanningProblems,

          MonitoredVideoIntelligenceModule.ProductionVideoPlanning,

          `Planning pipeline averaging ${metrics.planningPerformanceMs}ms`,

          "Optimize production video planning workflow"

        )

      );

    }



    const cache = this.foundation.getVideoIntelligenceOptimizationEngine().getCache();

    if (cache.hitRate < 5 && cache.videos.length === 0) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.CacheProblems,

          MonitoredVideoIntelligenceModule.VideoCache,

          "Video intelligence cache not warmed",

          "Run video intelligence optimization"

        )

      );

    }



    if (metrics.diskUsageMb > 3000) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.HighResourceUsage,

          MonitoredVideoIntelligenceModule.VideoIntelligenceDatabase,

          `${metrics.diskUsageMb}MB disk used by video intelligence`,

          "Archive inactive video intelligence records"

        )

      );

    }



    if (metrics.memoryUsageMb > 400) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.HighResourceUsage,

          MonitoredVideoIntelligenceModule.VideoCache,

          `${metrics.memoryUsageMb}MB heap used`,

          "Optimize video intelligence cache"

        )

      );

    }



    if (metrics.gpuUsagePercent > 80) {

      warnings.push(

        this.warn(

          VideoIntelligenceWarningType.HighResourceUsage,

          MonitoredVideoIntelligenceModule.VideoIntelligenceFoundation,

          `GPU usage at ${metrics.gpuUsagePercent}%`,

          "Reduce concurrent video intelligence workloads"

        )

      );

    }



    for (const issue of deriveVideoIntelligencePerformanceIssues(metrics)) {

      if (!warnings.some((w) => w.message.includes(issue))) {

        warnings.push(

          this.warn(

            VideoIntelligenceWarningType.HighResourceUsage,

            MonitoredVideoIntelligenceModule.VideoIntelligenceFoundation,

            issue,

            "Monitor video intelligence performance trends"

          )

        );

      }

    }



    for (const mod of moduleScores) {

      if (

        mod.level === VideoIntelligenceHealthScoreLevel.Critical ||

        mod.level === VideoIntelligenceHealthScoreLevel.Failed

      ) {

        warnings.push(

          this.warn(

            VideoIntelligenceWarningType.VideoAnalysisFailure,

            mod.module,

            `${mod.module} health critical (${mod.score})`,

            `Inspect ${mod.module} diagnostics`

          )

        );

      }

    }



    return warnings;

  }



  private warn(

    type: VideoIntelligenceWarningType,

    module: MonitoredVideoIntelligenceModule,

    message: string,

    recommendation: string

  ): VideoIntelligenceHealthWarning {

    return {

      type,

      severity: VideoIntelligenceHealthScoreLevel.Warning,

      message,

      module,

      recommendation,

    };

  }

}


