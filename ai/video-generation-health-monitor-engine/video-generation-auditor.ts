import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationModuleStatus } from "../video-generation-foundation/types.js";
import { VideoGenerationHealthMonitorLogger } from "./health-logger.js";
import { VideoGenerationAuditResult } from "./types.js";

const EXTERNAL_VG_DEPENDENCIES = new Set([
  "video-generation-engine",
  "knowledge-engine",
  "memory-engine",
  "product-intelligence-engine",
  "image-intelligence-engine",
  "video-intelligence-engine",
]);

export class VideoGenerationAuditor {
  constructor(
    private readonly foundation: AiVideoGenerationFoundation,
    private readonly storageRoot: string,
    private readonly logger: VideoGenerationHealthMonitorLogger
  ) {}

  async runAudit(): Promise<VideoGenerationAuditResult> {
    const start = Date.now();
    const auditId = `vg-audit-${Date.now()}`;

    const storyReport = this.foundation.getStoryGenerationEngine().buildStatusReport();
    const sceneReport = this.foundation.getSceneGenerationEngine().buildStatusReport();
    const cameraReport = this.foundation.getCameraDirectorEngine().buildStatusReport();
    const motionReport = this.foundation.getMotionGenerationEngine().buildStatusReport();
    const animationReport = this.foundation.getAnimationGenerationEngine().buildStatusReport();
    const vfxReport = this.foundation.getVisualEffectsGenerationEngine().buildStatusReport();
    const audioReport = this.foundation.getAudioSynchronizationEngine().buildStatusReport();
    const optimizationReport = this.foundation.getVideoGenerationOptimizationEngine().buildStatusReport();

    const storyboardQuality = storyReport.readinessScore >= 75;
    const sceneQuality = sceneReport.readinessScore >= 75;
    const cameraQuality = cameraReport.readinessScore >= 75;
    const motionQuality = motionReport.readinessScore >= 75;
    const animationQuality = animationReport.readinessScore >= 75;
    const visualEffectsQuality = vfxReport.readinessScore >= 75;
    const audioQuality = audioReport.readinessScore >= 75;

    const brandConsistent =
      storyReport.averageProductionReadinessScore === 0 ||
      storyReport.averageProductionReadinessScore >= 55;

    const dependencyValidation = this.validateDependencies();
    const optimizationStatus = optimizationReport.readinessScore >= 75;

    const valid =
      storyboardQuality &&
      sceneQuality &&
      cameraQuality &&
      motionQuality &&
      animationQuality &&
      visualEffectsQuality &&
      audioQuality &&
      dependencyValidation &&
      optimizationStatus;

    this.logger.log(valid ? "info" : "warn", "audit", "Video generation audit complete", {
      auditId,
      valid,
    });

    return {
      auditId,
      timestamp: new Date().toISOString(),
      storyboardQuality,
      sceneQuality,
      cameraQuality,
      motionQuality,
      animationQuality,
      visualEffectsQuality,
      audioQuality,
      brandConsistency: brandConsistent,
      dependencyValidation,
      optimizationStatus,
      valid,
      durationMs: Date.now() - start,
    };
  }

  private validateDependencies(): boolean {
    const registry = this.foundation.getRegistry();
    const integration = this.foundation.integration.getStatus();
    const implemented = registry
      .getAllModules()
      .filter((m) => m.implemented && m.status === VideoGenerationModuleStatus.Active);

    for (const mod of implemented) {
      for (const dep of mod.dependencies) {
        if (EXTERNAL_VG_DEPENDENCIES.has(dep)) {
          if (dep === "knowledge-engine" && !integration.knowledgeEngine) return false;
          if (dep === "memory-engine" && !integration.memoryEngine) return false;
          if (dep === "product-intelligence-engine" && !integration.productIntelligenceEngine) return false;
          if (dep === "image-intelligence-engine" && !integration.imageIntelligenceEngine) return false;
          if (dep === "video-intelligence-engine" && !integration.videoIntelligenceEngine) return false;
          continue;
        }
        const depMod = registry.getModule(dep);
        if (!depMod?.implemented) return false;
      }
    }
    return true;
  }
}
