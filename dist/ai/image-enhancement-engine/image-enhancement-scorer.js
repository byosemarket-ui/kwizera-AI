import { ImageEnhanceOperationType, } from "./types.js";
export class ImageEnhancementScorer {
    computeScores(analysis, operations, restoration, preservation, quality, printPreparation, superResolution, platformOptimizations, context) {
        const enhancementScore = this.computeEnhancementScore(operations, quality, analysis);
        const restorationScore = this.computeRestorationScore(restoration, quality);
        const sharpnessScore = this.computeSharpnessScore(analysis, operations, quality);
        const colorAccuracyScore = this.computeColorAccuracy(analysis, context);
        const brandConsistencyScore = this.computeBrandConsistency(context, operations);
        const productionReadinessScore = this.computeProductionReadiness(printPreparation, superResolution, platformOptimizations, preservation, operations);
        const aiConfidenceScore = Math.round((enhancementScore +
            restorationScore +
            sharpnessScore +
            colorAccuracyScore +
            brandConsistencyScore +
            productionReadinessScore) /
            6);
        return {
            enhancementScore,
            restorationScore,
            sharpnessScore,
            colorAccuracyScore,
            brandConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isEnhancementPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.enhancementScore < 55) {
            diagnostics.push(`Enhancement score ${scores.enhancementScore} below threshold (55)`);
        }
        if (scores.restorationScore < 55) {
            diagnostics.push(`Restoration score ${scores.restorationScore} below threshold (55)`);
        }
        if (scores.sharpnessScore < 55) {
            diagnostics.push(`Sharpness score ${scores.sharpnessScore} below threshold (55)`);
        }
        if (scores.colorAccuracyScore < 55) {
            diagnostics.push(`Color accuracy score ${scores.colorAccuracyScore} below threshold (55)`);
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
        if (!record.imageAnalysis.resolution || record.imageAnalysis.resolution.length < 5) {
            diagnostics.push("Image analysis incomplete");
        }
        if (record.enhancementOperations.operations.length < 1) {
            diagnostics.push("No enhancement operations planned");
        }
        if (!record.restorationOperations.restorationStrategy || record.restorationOperations.restorationStrategy.length < 10) {
            diagnostics.push("Restoration plan incomplete");
        }
        if (record.preservation.targets.length < 6) {
            diagnostics.push("Insufficient preservation targets (minimum 6)");
        }
        if (!record.superResolutionPlan.targetResolution || record.superResolutionPlan.upscalingMethod.length < 10) {
            diagnostics.push("Super resolution plan incomplete");
        }
        if (!record.printPreparation.dpiPlanning || record.printPreparation.dpiPlanning.length < 5) {
            diagnostics.push("Print preparation incomplete");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.enhancementScore >= 55 &&
            scores.restorationScore >= 55 &&
            record.platformOptimizations.length >= 1 &&
            record.productionInstructions.renderNotes.length >= 1 &&
            record.preservation.identityLock);
    }
    isBrandConsistent(context, operations) {
        if (!context.brandName)
            return operations.executionOrder.length >= 1;
        return Object.values(operations.operationPrompts).some((p) => p.toLowerCase().includes("brand") || p.toLowerCase().includes(context.brandName.toLowerCase()));
    }
    computeEnhancementScore(operations, quality, analysis) {
        let score = 45;
        if (operations.operations.length >= 2)
            score += 15;
        if (operations.superResolutionTarget.length >= 5)
            score += 15;
        if (quality.edgeQuality.length >= 10)
            score += 15;
        if (analysis.textureQuality.length >= 10)
            score += 10;
        return Math.min(100, score);
    }
    computeRestorationScore(restoration, quality) {
        let score = 45;
        if (restoration.authenticityNotes.length >= 2)
            score += 20;
        if (restoration.targetDamage.length >= 2)
            score += 15;
        if (quality.fineDetails.length >= 10)
            score += 10;
        if (restoration.restorationStrategy.length >= 10)
            score += 10;
        return Math.min(100, score);
    }
    computeSharpnessScore(analysis, operations, quality) {
        let score = 45;
        if (analysis.sharpness.length >= 5)
            score += 15;
        if (operations.operations.includes(ImageEnhanceOperationType.DetailEnhancement) || operations.operations.length >= 2)
            score += 15;
        if (quality.edgeQuality.length >= 10)
            score += 15;
        if (quality.fineDetails.length >= 10)
            score += 10;
        return Math.min(100, score);
    }
    computeColorAccuracy(analysis, context) {
        let score = 45;
        if (analysis.colorAccuracy.length >= 10)
            score += 20;
        if (analysis.whiteBalance.length >= 5)
            score += 15;
        if (context.brandGuidelines)
            score += 10;
        if (context.brandName)
            score += 10;
        return Math.min(100, score);
    }
    computeBrandConsistency(context, operations) {
        let score = 45;
        if (context.brandGuidelines)
            score += 15;
        if (context.brandName)
            score += 15;
        if (operations.executionOrder.length >= 1)
            score += 10;
        if (context.campaignId)
            score += 10;
        return Math.min(100, score);
    }
    computeProductionReadiness(print, superResolution, platforms, preservation, operations) {
        let score = 45;
        if (print.printResolution.length >= 10)
            score += 15;
        if (superResolution.targetResolution.length >= 5)
            score += 15;
        if (platforms.length >= 4)
            score += 10;
        if (preservation.compositionLock && preservation.identityLock)
            score += 10;
        if (operations.executionOrder.length >= 1)
            score += 10;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=image-enhancement-scorer.js.map