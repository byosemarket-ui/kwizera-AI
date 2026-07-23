import {
  ImageIntelligenceHealthLevel,
  ImageIntelligenceQualityMetadata,
  ImageIntelligenceSource,
  ImageIntelligenceValidationResult,
  ImageIntelligenceVerificationStatus,
} from "./types.js";
import { PREPARED_IMAGE_INTELLIGENCE_MODULES } from "./image-intelligence-categories.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceRegistry } from "./image-intelligence-registry.js";

export class ImageIntelligenceQualityValidator {
  private validationTimes: number[] = [];

  constructor(
    private readonly logger: ImageIntelligenceFoundationLogger,
    private readonly registry: ImageIntelligenceRegistry
  ) {}

  validateMetadata(metadata: ImageIntelligenceQualityMetadata): ImageIntelligenceValidationResult {
    const start = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (metadata.qualityScore < 0 || metadata.qualityScore > 100) {
      issues.push("Quality score must be between 0 and 100");
    }
    if (metadata.confidenceScore < 0 || metadata.confidenceScore > 100) {
      issues.push("Confidence score must be between 0 and 100");
    }
    if (!metadata.source) {
      issues.push("Image intelligence source is required");
    }
    if (metadata.versionHistory.length === 0) {
      recommendations.push("Add version history for traceability");
    }
    if (metadata.qualityScore < 50) {
      recommendations.push("Quality score below threshold — review image data");
    }
    if (metadata.confidenceScore < 60) {
      recommendations.push("Confidence score low — additional verification recommended");
    }

    const valid = issues.length === 0;
    const verificationStatus = valid
      ? metadata.qualityScore >= 75 && metadata.confidenceScore >= 70
        ? ImageIntelligenceVerificationStatus.Verified
        : ImageIntelligenceVerificationStatus.Pending
      : ImageIntelligenceVerificationStatus.Rejected;

    const durationMs = Date.now() - start;
    this.validationTimes.push(durationMs);

    this.logger.log(valid ? "info" : "warn", "validation", "Image intelligence quality validation complete", {
      valid,
      qualityScore: metadata.qualityScore,
      confidenceScore: metadata.confidenceScore,
      verificationStatus,
      durationMs,
    });

    return {
      valid,
      qualityScore: metadata.qualityScore,
      confidenceScore: metadata.confidenceScore,
      verificationStatus,
      issues,
      recommendations,
      durationMs,
    };
  }

  validateModule(moduleId: string): ImageIntelligenceValidationResult {
    const mod = this.registry.getModule(moduleId);
    if (!mod) {
      return {
        valid: false,
        qualityScore: 0,
        confidenceScore: 0,
        verificationStatus: ImageIntelligenceVerificationStatus.Rejected,
        issues: [`Unknown image intelligence module: ${moduleId}`],
        recommendations: [],
        durationMs: 0,
      };
    }

    const prepared = PREPARED_IMAGE_INTELLIGENCE_MODULES.find((p) => p.moduleId === moduleId);
    const source = prepared?.defaultSource ?? ImageIntelligenceSource.System;
    const qualityScore = mod.qualityScore > 0 ? mod.qualityScore : 80;
    const confidenceScore = mod.confidenceScore > 0 ? mod.confidenceScore : 75;

    const result = this.validateMetadata({
      qualityScore,
      confidenceScore,
      verificationStatus:
        qualityScore >= 75
          ? ImageIntelligenceVerificationStatus.Verified
          : ImageIntelligenceVerificationStatus.Pending,
      source,
      versionHistory: [
        {
          version: 1,
          timestamp: mod.lastUpdated,
          changeSummary: "Registry entry",
          source,
        },
      ],
      relationshipLinks: mod.dependencies,
      healthStatus: mod.healthStatus,
    });

    if (result.valid) {
      this.registry.updateQualityScores(moduleId, result.qualityScore, result.confidenceScore);
    }

    return result;
  }

  getAverageValidationMs(): number {
    if (this.validationTimes.length === 0) return 0;
    return Math.round(this.validationTimes.reduce((a, b) => a + b, 0) / this.validationTimes.length);
  }
}
