export class ImageToImageGenerationScorer {
    computeScores(sourceAnalysis, transformationPlan, preservationPlan, maskPlan, platformOptimizations, variations, context) {
        const transformationQualityScore = this.computeTransformationQuality(transformationPlan, sourceAnalysis);
        const identityPreservationScore = this.computeIdentityPreservation(preservationPlan, maskPlan, sourceAnalysis);
        const styleConsistencyScore = this.computeStyleConsistency(transformationPlan, sourceAnalysis);
        const brandConsistencyScore = this.computeBrandConsistency(context, preservationPlan, sourceAnalysis);
        const productionReadinessScore = this.computeProductionReadiness(maskPlan, platformOptimizations, variations, sourceAnalysis);
        const aiConfidenceScore = Math.round((transformationQualityScore +
            identityPreservationScore +
            styleConsistencyScore +
            brandConsistencyScore +
            productionReadinessScore) /
            5);
        return {
            transformationQualityScore,
            identityPreservationScore,
            styleConsistencyScore,
            brandConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isTransformationPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.transformationQualityScore < 55) {
            diagnostics.push(`Transformation quality score ${scores.transformationQualityScore} below threshold (55)`);
        }
        if (scores.identityPreservationScore < 55) {
            diagnostics.push(`Identity preservation score ${scores.identityPreservationScore} below threshold (55)`);
        }
        if (scores.styleConsistencyScore < 50) {
            diagnostics.push(`Style consistency score ${scores.styleConsistencyScore} below threshold (50)`);
        }
        if (scores.brandConsistencyScore < 50) {
            diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
        }
        if (scores.productionReadinessScore < 55) {
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        if (!record.sourceAnalysis.subject || record.sourceAnalysis.subject.length < 5) {
            diagnostics.push("Source image subject analysis incomplete");
        }
        if (record.transformationPlan.steps.length < 2) {
            diagnostics.push("Insufficient transformation steps (minimum 2)");
        }
        if (record.maskPlan.masks.length < 4) {
            diagnostics.push("Insufficient mask definitions (minimum 4)");
        }
        if (record.preservationPlan.rules.length < 3) {
            diagnostics.push("Insufficient preservation rules (minimum 3)");
        }
        const hasForeground = record.maskPlan.masks.some((m) => m.maskType === "foreground-mask");
        const hasBackground = record.maskPlan.masks.some((m) => m.maskType === "background-mask");
        if (!hasForeground)
            diagnostics.push("Foreground mask missing");
        if (!hasBackground)
            diagnostics.push("Background mask missing");
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.identityPreservationScore >= 55 &&
            scores.transformationQualityScore >= 55 &&
            record.platformOptimizations.length >= 1 &&
            record.productionInstructions.renderNotes.length >= 1 &&
            record.maskPlan.protectedRegions.length >= 1);
    }
    isBrandConsistent(context, preservationPlan) {
        if (!context.brandName)
            return preservationPlan.brandColorLock || preservationPlan.rules.length >= 3;
        return (preservationPlan.brandColorLock ||
            preservationPlan.notes.some((n) => n.toLowerCase().includes(context.brandName.toLowerCase())));
    }
    computeTransformationQuality(plan, analysis) {
        let score = 45;
        if (plan.steps.length >= 3)
            score += 20;
        if (plan.transformationPrompt.length >= 20)
            score += 10;
        if (plan.visualConsistencyNotes.length >= 2)
            score += 10;
        if (analysis.imageQuality === "high" || analysis.imageQuality === "good")
            score += 15;
        return Math.min(100, score);
    }
    computeIdentityPreservation(preservation, maskPlan, analysis) {
        let score = 45;
        if (preservation.identityLock)
            score += 15;
        if (preservation.rules.length >= 4)
            score += 15;
        if (maskPlan.protectedRegions.length >= 1)
            score += 10;
        if (maskPlan.masks.filter((m) => m.protected).length >= 2)
            score += 15;
        if (analysis.subject.length >= 10)
            score += 10;
        return Math.min(100, score);
    }
    computeStyleConsistency(plan, analysis) {
        let score = 45;
        if (plan.targetStyle && plan.steps.some((s) => s.type === "style-transfer"))
            score += 20;
        if (plan.visualConsistencyNotes.length >= 2)
            score += 15;
        if (analysis.composition.length >= 10)
            score += 10;
        if (analysis.lighting.length >= 10)
            score += 10;
        return Math.min(100, score);
    }
    computeBrandConsistency(context, preservation, analysis) {
        let score = 45;
        if (preservation.brandColorLock)
            score += 20;
        if (analysis.colors.length >= 2)
            score += 15;
        if (context.brandGuidelines)
            score += 10;
        if (context.brandName)
            score += 10;
        return Math.min(100, score);
    }
    computeProductionReadiness(maskPlan, platformOptimizations, variations, analysis) {
        let score = 45;
        if (maskPlan.masks.length >= 5)
            score += 15;
        if (platformOptimizations.length >= 1)
            score += 15;
        if (variations.length >= 3)
            score += 10;
        if (analysis.resolution.length >= 5)
            score += 10;
        if (maskPlan.editableRegions.length >= 1 && maskPlan.protectedRegions.length >= 1)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=image-to-image-generation-scorer.js.map