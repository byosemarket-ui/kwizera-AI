import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationModuleStatus } from "../image-generation-foundation/types.js";
import { ImageGenerationHealthMonitorLogger } from "./health-logger.js";
import { ImageGenerationAuditResult } from "./types.js";

const EXTERNAL_IG_DEPENDENCIES = new Set([
  "image-generation-engine",
  "knowledge-engine",
  "memory-engine",
  "product-intelligence-engine",
  "image-intelligence-engine",
  "video-intelligence-engine",
]);

export class ImageGenerationAuditor {
  constructor(
    private readonly foundation: AiImageGenerationFoundation,
    private readonly storageRoot: string,
    private readonly logger: ImageGenerationHealthMonitorLogger
  ) {}

  async runAudit(): Promise<ImageGenerationAuditResult> {
    void this.storageRoot;
    const start = Date.now();
    const auditId = `ig-audit-${Date.now()}`;

    const promptReport = this.foundation.getTextToImageGenerationEngine().buildStatusReport();
    const imageReport = this.foundation.getImageToImageGenerationEngine().buildStatusReport();
    const productImageReport = this.foundation.getProductImageGenerationEngine().buildStatusReport();
    const backgroundReport = this.foundation.getBackgroundGenerationEngine().buildStatusReport();
    const editingReport = this.foundation.getImageEditingEngine().buildStatusReport();
    const enhancementReport = this.foundation.getImageEnhancementEngine().buildStatusReport();
    const brandingReport = this.foundation.getBrandingDesignEngine().buildStatusReport();
    const multiStyleReport = this.foundation.getMultiStyleImageGenerationEngine().buildStatusReport();
    const optimizationReport = this.foundation.getImageGenerationOptimizationEngine().buildStatusReport();

    const promptQuality = promptReport.readinessScore >= 75;
    const imageQuality = imageReport.readinessScore >= 75;
    const productImageQuality = productImageReport.readinessScore >= 75;
    const backgroundQuality = backgroundReport.readinessScore >= 75;
    const editingQuality = editingReport.readinessScore >= 75;
    const enhancementQuality = enhancementReport.readinessScore >= 75;
    const brandingConsistency = brandingReport.readinessScore >= 75;
    const multiStyleConsistency = multiStyleReport.readinessScore >= 75;

    const dependencyValidation = this.validateDependencies();
    const optimizationStatus = optimizationReport.readinessScore >= 75;

    const valid =
      promptQuality &&
      imageQuality &&
      productImageQuality &&
      backgroundQuality &&
      editingQuality &&
      enhancementQuality &&
      brandingConsistency &&
      multiStyleConsistency &&
      dependencyValidation &&
      optimizationStatus;

    this.logger.log(valid ? "info" : "warn", "audit", "Image generation audit complete", {
      auditId,
      valid,
    });

    return {
      auditId,
      timestamp: new Date().toISOString(),
      promptQuality,
      imageQuality,
      productImageQuality,
      backgroundQuality,
      editingQuality,
      enhancementQuality,
      brandingConsistency,
      multiStyleConsistency,
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
      .filter((m) => m.implemented && m.status === ImageGenerationModuleStatus.Active);

    for (const mod of implemented) {
      for (const dep of mod.dependencies) {
        if (EXTERNAL_IG_DEPENDENCIES.has(dep)) {
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
