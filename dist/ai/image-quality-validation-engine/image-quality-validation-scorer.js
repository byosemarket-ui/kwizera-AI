import { QualityIssueSeverity, } from "./types.js";
export class ImageQualityValidationScorer {
    computeScores(imageQuality, layerValidation, maskValidation, typographyValidation, brandValidation, printValidation, platformValidation, technicalValidation, issues) {
        const visualQualityScore = this.averageScore(imageQuality.map((e) => e.score));
        const colorAccuracyScore = this.computeColorScore(imageQuality);
        const layerIntegrityScore = this.computePassRate(layerValidation);
        const typographyScore = this.computePassRate(typographyValidation);
        const brandConsistencyScore = this.computePassRate(brandValidation);
        const printReadinessScore = this.computePassRate(printValidation);
        const platformCompatibilityScore = this.computePlatformScore(platformValidation);
        const performanceScore = this.computeTechnicalScore(technicalValidation);
        let overallQualityScore = Math.round((visualQualityScore + colorAccuracyScore + layerIntegrityScore + typographyScore + brandConsistencyScore + printReadinessScore + platformCompatibilityScore) / 7);
        const criticalCount = issues.filter((i) => i.severity === QualityIssueSeverity.Critical && !i.repaired).length;
        const highCount = issues.filter((i) => i.severity === QualityIssueSeverity.High && !i.repaired).length;
        overallQualityScore = Math.max(0, overallQualityScore - criticalCount * 25 - highCount * 10);
        const aiConfidenceScore = Math.round((overallQualityScore + visualQualityScore + layerIntegrityScore + brandConsistencyScore + platformCompatibilityScore + performanceScore) / 6);
        return {
            overallQualityScore,
            visualQualityScore,
            colorAccuracyScore,
            layerIntegrityScore,
            typographyScore,
            brandConsistencyScore,
            printReadinessScore,
            platformCompatibilityScore,
            aiConfidenceScore,
        };
    }
    isValidationComplete(scores, issues, record) {
        const diagnostics = [];
        if (scores.overallQualityScore < 55)
            diagnostics.push(`Overall quality score ${scores.overallQualityScore} below threshold (55)`);
        if (scores.visualQualityScore < 55)
            diagnostics.push(`Visual quality score ${scores.visualQualityScore} below threshold (55)`);
        if (scores.layerIntegrityScore < 55)
            diagnostics.push(`Layer integrity score ${scores.layerIntegrityScore} below threshold (55)`);
        if (scores.brandConsistencyScore < 50)
            diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        const criticalIssues = issues.filter((i) => i.severity === QualityIssueSeverity.Critical && !i.repaired);
        if (criticalIssues.length > 0) {
            diagnostics.push(`Unresolved critical issues: ${criticalIssues.map((i) => i.message).join("; ")}`);
        }
        if (record.imageQuality.filter((e) => !e.validated).length > 3) {
            diagnostics.push("Too many failed image quality checks");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isApproved(scores, issues) {
        const hasCritical = issues.some((i) => i.severity === QualityIssueSeverity.Critical && !i.repaired);
        return scores.overallQualityScore >= 55 && scores.aiConfidenceScore >= 55 && !hasCritical;
    }
    averageScore(scores) {
        if (scores.length === 0)
            return 0;
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
    computeColorScore(imageQuality) {
        const colorChecks = imageQuality.filter((e) => e.check.includes("color") || e.check.includes("white") || e.check.includes("exposure") || e.check.includes("contrast"));
        return colorChecks.length > 0 ? this.averageScore(colorChecks.map((e) => e.score)) : 75;
    }
    computePassRate(entries) {
        const validated = entries.filter((e) => e.validated).length;
        return Math.min(100, Math.round(45 + (validated / Math.max(entries.length, 1)) * 55));
    }
    computePlatformScore(platformValidation) {
        const ready = platformValidation.filter((p) => p.ready).length;
        const validated = platformValidation.filter((p) => p.validated).length;
        return Math.min(100, Math.round(40 + (ready / Math.max(platformValidation.length, 1)) * 30 + (validated / Math.max(platformValidation.length, 1)) * 30));
    }
    computeTechnicalScore(technicalValidation) {
        return this.computePassRate(technicalValidation);
    }
}
//# sourceMappingURL=image-quality-validation-scorer.js.map