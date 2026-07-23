export class MultiStyleImageScorer {
    computeScores(transformation, variations, preservation, platformOptimizations, context) {
        const styleQualityScore = this.computeStyleQuality(transformation, variations);
        const styleAccuracyScore = this.computeStyleAccuracy(transformation, context);
        const identityPreservationScore = this.computeIdentityPreservation(preservation);
        const brandConsistencyScore = this.computeBrandConsistency(context, transformation);
        const productionReadinessScore = this.computeProductionReadiness(variations, platformOptimizations, preservation);
        const aiConfidenceScore = Math.round((styleQualityScore +
            styleAccuracyScore +
            identityPreservationScore +
            brandConsistencyScore +
            productionReadinessScore) /
            5);
        return {
            styleQualityScore,
            styleAccuracyScore,
            identityPreservationScore,
            brandConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isStylePlanValid(scores, record) {
        const diagnostics = [];
        if (scores.styleQualityScore < 55)
            diagnostics.push(`Style quality score ${scores.styleQualityScore} below threshold (55)`);
        if (scores.styleAccuracyScore < 55)
            diagnostics.push(`Style accuracy score ${scores.styleAccuracyScore} below threshold (55)`);
        if (scores.identityPreservationScore < 55)
            diagnostics.push(`Identity preservation score ${scores.identityPreservationScore} below threshold (55)`);
        if (scores.brandConsistencyScore < 50)
            diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
        if (scores.productionReadinessScore < 55)
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        if (!record.styleTransformation.styleMapping || record.styleTransformation.styleMapping.length < 10) {
            diagnostics.push("Style mapping incomplete");
        }
        if (record.styleVariations.variations.length < 4) {
            diagnostics.push("Insufficient style variations (minimum 4)");
        }
        if (record.identityPreservation.targets.length < 7) {
            diagnostics.push("Insufficient identity preservation targets (minimum 7)");
        }
        if (record.platformOptimizations.length < 1) {
            diagnostics.push("Platform optimization not planned");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.styleQualityScore >= 55 &&
            scores.identityPreservationScore >= 55 &&
            record.productionInstructions.renderNotes.length >= 1 &&
            record.platformOptimizations.length >= 1);
    }
    isBrandConsistent(context, transformation) {
        if (!context.brandName)
            return transformation.colorAdaptation.length >= 10;
        return (transformation.colorAdaptation.toLowerCase().includes(context.brandName.toLowerCase()) ||
            transformation.colorAdaptation.toLowerCase().includes("brand"));
    }
    computeStyleQuality(transformation, variations) {
        let score = 45;
        if (transformation.styleMapping.length >= 20)
            score += 15;
        if (transformation.texturePlanning.length >= 10)
            score += 15;
        if (variations.variations.length >= 4)
            score += 15;
        if (transformation.materialAdaptation.length >= 10)
            score += 10;
        return Math.min(100, score);
    }
    computeStyleAccuracy(transformation, context) {
        let score = 45;
        if (transformation.lightingAdaptation.length >= 10)
            score += 15;
        if (transformation.compositionAdaptation.length >= 10)
            score += 15;
        if (transformation.detailAdaptation.length >= 10)
            score += 15;
        if (context.brandGuidelines)
            score += 10;
        return Math.min(100, score);
    }
    computeIdentityPreservation(preservation) {
        let score = 45;
        if (preservation.targets.length >= 7)
            score += 25;
        if (preservation.identityLock)
            score += 10;
        if (preservation.productLock)
            score += 10;
        if (preservation.logoLock && preservation.brandColorLock)
            score += 10;
        return Math.min(100, score);
    }
    computeBrandConsistency(context, transformation) {
        let score = 45;
        if (context.brandGuidelines)
            score += 15;
        if (context.brandName)
            score += 15;
        if (transformation.colorAdaptation.length >= 10)
            score += 10;
        if (context.campaignId)
            score += 10;
        return Math.min(100, score);
    }
    computeProductionReadiness(variations, platforms, preservation) {
        let score = 45;
        if (variations.variations.length >= 7)
            score += 20;
        if (platforms.length >= 4)
            score += 15;
        if (preservation.notes.length >= 4)
            score += 10;
        if (preservation.identityLock && preservation.productLock)
            score += 10;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=multi-style-image-scorer.js.map