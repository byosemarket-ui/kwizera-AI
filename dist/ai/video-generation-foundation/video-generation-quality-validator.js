import { VideoGenerationSource, VideoGenerationVerificationStatus, } from "./types.js";
import { PREPARED_VIDEO_GENERATION_MODULES } from "./video-generation-categories.js";
export class VideoGenerationQualityValidator {
    logger;
    registry;
    validationTimes = [];
    constructor(logger, registry) {
        this.logger = logger;
        this.registry = registry;
    }
    validateMetadata(metadata) {
        const start = Date.now();
        const issues = [];
        const recommendations = [];
        if (metadata.qualityScore < 0 || metadata.qualityScore > 100) {
            issues.push("Quality score must be between 0 and 100");
        }
        if (metadata.confidenceScore < 0 || metadata.confidenceScore > 100) {
            issues.push("Confidence score must be between 0 and 100");
        }
        if (!metadata.source) {
            issues.push("Video generation source is required");
        }
        if (metadata.versionHistory.length === 0) {
            recommendations.push("Add version history for traceability");
        }
        if (metadata.qualityScore < 50) {
            recommendations.push("Quality score below threshold — review generation data");
        }
        const valid = issues.length === 0;
        const verificationStatus = valid
            ? metadata.qualityScore >= 75 && metadata.confidenceScore >= 70
                ? VideoGenerationVerificationStatus.Verified
                : VideoGenerationVerificationStatus.Pending
            : VideoGenerationVerificationStatus.Rejected;
        const durationMs = Date.now() - start;
        this.validationTimes.push(durationMs);
        this.logger.log(valid ? "info" : "warn", "validation", "Video generation quality validation complete", {
            valid,
            qualityScore: metadata.qualityScore,
            confidenceScore: metadata.confidenceScore,
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
    validateModule(moduleId) {
        const mod = this.registry.getModule(moduleId);
        if (!mod) {
            return {
                valid: false,
                qualityScore: 0,
                confidenceScore: 0,
                verificationStatus: VideoGenerationVerificationStatus.Rejected,
                issues: [`Unknown video generation module: ${moduleId}`],
                recommendations: [],
                durationMs: 0,
            };
        }
        const prepared = PREPARED_VIDEO_GENERATION_MODULES.find((p) => p.moduleId === moduleId);
        const source = prepared?.defaultSource ?? VideoGenerationSource.System;
        const result = this.validateMetadata({
            qualityScore: mod.qualityScore > 0 ? mod.qualityScore : 80,
            confidenceScore: mod.confidenceScore > 0 ? mod.confidenceScore : 75,
            verificationStatus: mod.qualityScore >= 75
                ? VideoGenerationVerificationStatus.Verified
                : VideoGenerationVerificationStatus.Pending,
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
    getAverageValidationMs() {
        if (this.validationTimes.length === 0)
            return 0;
        return Math.round(this.validationTimes.reduce((a, b) => a + b, 0) / this.validationTimes.length);
    }
}
//# sourceMappingURL=video-generation-quality-validator.js.map