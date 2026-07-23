export class BackgroundGenerationScorer {
    computeScores(analysis, preservation, generationPlan, lightingMatching, depthPlanning, qualityImprovement, replacementPlan, platformOptimizations, context) {
        const backgroundQualityScore = this.computeBackgroundQuality(generationPlan, qualityImprovement, analysis);
        const subjectPreservationScore = this.computeSubjectPreservation(preservation);
        const lightingConsistencyScore = this.computeLightingConsistency(lightingMatching, analysis);
        const brandConsistencyScore = this.computeBrandConsistency(context, generationPlan);
        const productionReadinessScore = this.computeProductionReadiness(depthPlanning, qualityImprovement, platformOptimizations, replacementPlan);
        const aiConfidenceScore = Math.round((backgroundQualityScore +
            subjectPreservationScore +
            lightingConsistencyScore +
            brandConsistencyScore +
            productionReadinessScore) /
            5);
        return {
            backgroundQualityScore,
            subjectPreservationScore,
            lightingConsistencyScore,
            brandConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isBackgroundPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.backgroundQualityScore < 55) {
            diagnostics.push(`Background quality score ${scores.backgroundQualityScore} below threshold (55)`);
        }
        if (scores.subjectPreservationScore < 55) {
            diagnostics.push(`Subject preservation score ${scores.subjectPreservationScore} below threshold (55)`);
        }
        if (scores.lightingConsistencyScore < 55) {
            diagnostics.push(`Lighting consistency score ${scores.lightingConsistencyScore} below threshold (55)`);
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
        if (!record.backgroundAnalysis.backgroundType || record.backgroundAnalysis.backgroundType.length < 3) {
            diagnostics.push("Background analysis incomplete");
        }
        if (record.subjectPreservation.targets.length < 6) {
            diagnostics.push("Insufficient subject preservation targets (minimum 6)");
        }
        if (!record.lightingMatching.lightDirection || record.lightingMatching.shadowConsistency.length < 5) {
            diagnostics.push("Lighting matching plan incomplete");
        }
        if (!record.depthPlanning.foreground || !record.depthPlanning.background) {
            diagnostics.push("Depth planning incomplete");
        }
        if (!record.generationPlan.generationPrompt || record.generationPlan.generationPrompt.length < 10) {
            diagnostics.push("Background generation plan incomplete");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.subjectPreservationScore >= 55 &&
            scores.backgroundQualityScore >= 55 &&
            record.platformOptimizations.length >= 1 &&
            record.productionInstructions.renderNotes.length >= 1);
    }
    isBrandConsistent(context, generationPlan) {
        if (!context.brandName)
            return generationPlan.realismNotes.length >= 2;
        return (generationPlan.environmentDescription.toLowerCase().includes(context.brandName.toLowerCase()) ||
            generationPlan.realismNotes.some((n) => n.toLowerCase().includes("brand")));
    }
    computeBackgroundQuality(plan, quality, analysis) {
        let score = 45;
        if (plan.generationPrompt.length >= 20)
            score += 15;
        if (plan.realismNotes.length >= 2)
            score += 10;
        if (quality.backgroundCleanliness.length >= 10)
            score += 15;
        if (analysis.colorPalette.length >= 2)
            score += 15;
        return Math.min(100, score);
    }
    computeSubjectPreservation(preservation) {
        let score = 45;
        if (preservation.targets.length >= 8)
            score += 25;
        if (preservation.identityLock)
            score += 10;
        if (preservation.productLock)
            score += 10;
        if (preservation.transparentPreservation)
            score += 10;
        return Math.min(100, score);
    }
    computeLightingConsistency(matching, analysis) {
        let score = 45;
        if (matching.lightDirection && matching.shadowConsistency)
            score += 20;
        if (matching.colorTemperature && matching.reflectionMatching)
            score += 15;
        if (analysis.lightingDirection.length >= 5)
            score += 10;
        if (matching.ambientLight.length >= 5)
            score += 10;
        return Math.min(100, score);
    }
    computeBrandConsistency(context, plan) {
        let score = 45;
        if (context.brandGuidelines)
            score += 15;
        if (context.brandName)
            score += 15;
        if (plan.replacementStrategy.length >= 10)
            score += 10;
        if (context.campaignId)
            score += 10;
        return Math.min(100, score);
    }
    computeProductionReadiness(depth, quality, platforms, replacement) {
        let score = 45;
        if (depth.foreground && depth.midground && depth.background)
            score += 15;
        if (quality.edgeQuality && quality.objectSeparation)
            score += 15;
        if (platforms.length >= 4)
            score += 10;
        if (replacement.variations.length >= 4)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=background-generation-scorer.js.map