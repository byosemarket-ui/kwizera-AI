import fs from "node:fs";

import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";

import { VideoIntelligenceModuleStatus } from "../video-intelligence-foundation/types.js";

import { VideoIntelligenceHealthMonitorLogger } from "./health-logger.js";

import { VideoIntelligenceAuditResult } from "./types.js";



const EXTERNAL_VI_DEPENDENCIES = new Set([

  "video-engine",

  "knowledge-engine",

  "memory-engine",

  "product-intelligence-engine",

  "image-intelligence-engine",

]);



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



function isDependencySatisfied(foundation: AiVideoIntelligenceFoundation, dep: string): boolean {

  if (EXTERNAL_VI_DEPENDENCIES.has(dep)) {

    const status = foundation.integration.getStatus();

    if (dep === "knowledge-engine") return status.knowledgeEngine;

    if (dep === "memory-engine") return status.memoryEngine;

    if (dep === "product-intelligence-engine") return status.productIntelligenceEngine;

    if (dep === "image-intelligence-engine") return status.imageIntelligenceEngine;

    return true;

  }

  const depMod = foundation.getRegistry().getModule(resolveModuleId(dep));

  return Boolean(

    depMod?.implemented ||

      depMod?.status === VideoIntelligenceModuleStatus.Prepared ||

      depMod?.status === VideoIntelligenceModuleStatus.Registered ||

      depMod?.status === VideoIntelligenceModuleStatus.Active

  );

}



export class VideoIntelligenceAuditor {

  constructor(

    private readonly foundation: AiVideoIntelligenceFoundation,

    private readonly storageRoot: string,

    private readonly logger: VideoIntelligenceHealthMonitorLogger

  ) {}



  async runAudit(): Promise<VideoIntelligenceAuditResult> {

    const start = Date.now();

    const auditId = `vi-audit-${Date.now()}`;



    const enhancementReport = this.foundation.getVideoEnhancementPlanningEngine().buildStatusReport();

    const creativeReport = this.foundation.getCreativeVideoIntelligenceEngine().buildStatusReport();

    const productionReport = this.foundation.getProductionVideoPlanningEngine().buildStatusReport();

    const understandingReport = this.foundation.getVideoUnderstandingEngine().buildStatusReport();

    const sceneReport = this.foundation.getSceneDetectionEngine().buildStatusReport();

    const timelineReport = this.foundation.getTimelineIntelligenceEngine().buildStatusReport();

    const styleReport = this.foundation.getVideoStyleIntelligenceEngine().buildStatusReport();



    const qpReport = this.foundation.getVideoQualityPredictionEngine().buildStatusReport();

    const videoQuality =

      qpReport.readinessScore >= 75 &&

      (qpReport.predictionsCreated === 0 || qpReport.averageOverallQualityScore >= 55);



    const storytellingIntegrity =

      understandingReport.readinessScore >= 75 &&

      (understandingReport.averageUnderstandingScore === 0 ||

        understandingReport.averageUnderstandingScore >= 55);



    const timelineIntegrity =

      timelineReport.readinessScore >= 75 &&

      (timelineReport.averageTimelineQualityScore === 0 ||

        timelineReport.averageTimelineQualityScore >= 55);



    const sceneIntegrity =

      sceneReport.readinessScore >= 75 &&

      (sceneReport.averageSceneDetectionScore === 0 || sceneReport.averageSceneDetectionScore >= 55);



    const brandConsistency =

      styleReport.readinessScore >= 75 &&

      (styleReport.averageBrandStyleScore === 0 || styleReport.averageBrandStyleScore >= 55);



    const registry = this.foundation.getRegistry();

    const implemented = registry.getAllModules().filter((m) => m.implemented);

    const dependencyValidation = implemented.every((mod) =>

      mod.dependencies.every((dep) => isDependencySatisfied(this.foundation, dep))

    );



    const optimizationStatus =

      this.foundation.getVideoIntelligenceOptimizationEngine().buildStatusReport().readinessScore >= 75;



    const qualityPredictionStatus = qpReport.readinessScore >= 75;



    const planningIntegrity =

      enhancementReport.readinessScore >= 75 &&

      creativeReport.readinessScore >= 75 &&

      productionReport.readinessScore >= 75;



    const intelligenceRoot = this.foundation.getIntelligenceRoot();

    const storageOk = fs.existsSync(intelligenceRoot);



    const valid =

      storageOk &&

      videoQuality &&

      storytellingIntegrity &&

      timelineIntegrity &&

      sceneIntegrity &&

      planningIntegrity &&

      dependencyValidation &&

      optimizationStatus &&

      qualityPredictionStatus;



    this.logger.log("info", "audit", "Video intelligence audit complete", {

      auditId,

      valid,

      durationMs: Date.now() - start,

    });



    return {

      auditId,

      timestamp: new Date().toISOString(),

      videoQuality,

      storytellingIntegrity,

      timelineIntegrity,

      sceneIntegrity,

      brandConsistency,

      dependencyValidation,

      optimizationStatus,

      qualityPredictionStatus,

      valid,

      durationMs: Date.now() - start,

    };

  }

}


