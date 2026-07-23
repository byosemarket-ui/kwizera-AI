import { KnowledgeVerificationStatus, } from "./types.js";
export class KnowledgeQualityValidator {
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
            issues.push("Knowledge source is required");
        }
        if (metadata.versionHistory.length === 0) {
            recommendations.push("Add version history for traceability");
        }
        if (metadata.qualityScore < 50) {
            recommendations.push("Quality score below threshold — review source material");
        }
        if (metadata.confidenceScore < 60) {
            recommendations.push("Confidence score low — additional verification recommended");
        }
        const valid = issues.length === 0;
        const verificationStatus = valid
            ? metadata.qualityScore >= 75 && metadata.confidenceScore >= 70
                ? KnowledgeVerificationStatus.Verified
                : KnowledgeVerificationStatus.Pending
            : KnowledgeVerificationStatus.Rejected;
        const durationMs = Date.now() - start;
        this.validationTimes.push(durationMs);
        this.logger.log(valid ? "info" : "warn", "validation", "Knowledge quality validation complete", {
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
    validateModule(knowledgeId) {
        const mod = this.registry.getModule(knowledgeId);
        if (!mod) {
            return {
                valid: false,
                qualityScore: 0,
                confidenceScore: 0,
                verificationStatus: KnowledgeVerificationStatus.Rejected,
                issues: [`Unknown knowledge module: ${knowledgeId}`],
                recommendations: [],
                durationMs: 0,
            };
        }
        const result = this.validateMetadata({
            qualityScore: mod.qualityScore,
            confidenceScore: mod.confidenceScore,
            verificationStatus: mod.qualityScore >= 75 ? KnowledgeVerificationStatus.Verified : KnowledgeVerificationStatus.Pending,
            source: mod.source,
            versionHistory: [{ version: 1, timestamp: mod.lastUpdate, changeSummary: "Registry entry", source: mod.source }],
            relationshipLinks: [],
        });
        if (result.valid) {
            this.registry.updateQualityScores(knowledgeId, result.qualityScore, result.confidenceScore);
        }
        return result;
    }
    getAverageValidationMs() {
        if (this.validationTimes.length === 0)
            return 0;
        return Math.round(this.validationTimes.reduce((a, b) => a + b, 0) / this.validationTimes.length);
    }
}
//# sourceMappingURL=knowledge-quality-validator.js.map