export class AudioProductionScorer {
    computeScores(workflowValidation, assetValidation, dependencyValidation, productionStructure, context) {
        const workflowScore = this.computeWorkflowScore(workflowValidation);
        const assetReadinessScore = this.computeAssetReadiness(assetValidation, context);
        const dependencyScore = this.computeDependencyScore(dependencyValidation);
        const trackIntegrityScore = this.computeTrackIntegrity(productionStructure);
        const productionReadinessScore = this.computeProductionReadiness(workflowScore, assetReadinessScore, dependencyScore, trackIntegrityScore);
        const performanceScore = this.computePerformanceScore(workflowValidation, assetValidation);
        const aiConfidenceScore = Math.round((workflowScore +
            assetReadinessScore +
            dependencyScore +
            trackIntegrityScore +
            productionReadinessScore +
            performanceScore) /
            6);
        return {
            productionReadinessScore,
            assetReadinessScore,
            workflowScore,
            trackIntegrityScore,
            dependencyScore,
            performanceScore,
            aiConfidenceScore,
        };
    }
    isProductionPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.productionReadinessScore < 55)
            diagnostics.push(`Production readiness ${scores.productionReadinessScore} below threshold (55)`);
        if (scores.assetReadinessScore < 55)
            diagnostics.push(`Asset readiness ${scores.assetReadinessScore} below threshold (55)`);
        if (scores.workflowScore < 55)
            diagnostics.push(`Workflow score ${scores.workflowScore} below threshold (55)`);
        if (scores.trackIntegrityScore < 55)
            diagnostics.push(`Track integrity ${scores.trackIntegrityScore} below threshold (55)`);
        if (scores.dependencyScore < 55)
            diagnostics.push(`Dependency score ${scores.dependencyScore} below threshold (55)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        const failedWorkflows = record.workflowValidation.filter((w) => !w.validated);
        if (failedWorkflows.length > 0) {
            diagnostics.push(`Workflow validation failed for: ${failedWorkflows.map((w) => w.stage).join(", ")}`);
        }
        const missingDeps = record.dependencyValidation.filter((d) => !d.available);
        if (missingDeps.length > 0) {
            diagnostics.push(`Missing dependencies: ${missingDeps.map((d) => d.dependency).join(", ")}`);
        }
        if (record.productionStructure.trackStructure.length < 3) {
            diagnostics.push("Insufficient track structure (minimum 3 tracks)");
        }
        if (record.renderPreparation.instructions.length < 2) {
            diagnostics.push("Render preparation incomplete");
        }
        if (record.exportPreparation.exports.length < 4) {
            diagnostics.push("Insufficient export formats planned (minimum 4)");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.workflowScore >= 55 &&
            scores.dependencyScore >= 55 &&
            record.workflowValidation.every((w) => w.validated) &&
            record.dependencyValidation.every((d) => d.available) &&
            record.renderPreparation.instructions.length >= 2);
    }
    isBrandConsistent(context, structure) {
        if (!context.brandName && !context.brandId) {
            return structure.metadataStructure.brandId !== undefined;
        }
        const brandRef = (context.brandName ?? context.brandId ?? "").toLowerCase();
        return structure.metadataStructure.brandId?.toLowerCase().includes(brandRef.split("-")[0] ?? brandRef) ?? false;
    }
    computeWorkflowScore(workflowValidation) {
        const validated = workflowValidation.filter((w) => w.validated).length;
        const ratio = validated / Math.max(workflowValidation.length, 1);
        return Math.min(100, Math.round(45 + ratio * 55));
    }
    computeAssetReadiness(assetValidation, context) {
        const validated = assetValidation.filter((a) => a.validated).length;
        let score = Math.min(100, Math.round(40 + (validated / Math.max(assetValidation.length, 1)) * 50));
        if (context.mixingPlanId || context.audioPlanId)
            score = Math.min(100, score + 10);
        return score;
    }
    computeDependencyScore(dependencyValidation) {
        const available = dependencyValidation.filter((d) => d.available).length;
        const ratio = available / Math.max(dependencyValidation.length, 1);
        return Math.min(100, Math.round(45 + ratio * 55));
    }
    computeTrackIntegrity(structure) {
        let score = 45;
        if (structure.trackStructure.length >= 3)
            score += 20;
        if (structure.busStructure.length >= 3)
            score += 15;
        if (structure.timelineStructure.length >= 2)
            score += 10;
        if (structure.trackStructure.filter((t) => t.validated).length >= 3)
            score += 10;
        return Math.min(100, score);
    }
    computeProductionReadiness(workflowScore, assetScore, dependencyScore, trackScore) {
        return Math.round((workflowScore + assetScore + dependencyScore + trackScore) / 4);
    }
    computePerformanceScore(workflowValidation, assetValidation) {
        const wf = workflowValidation.filter((w) => w.validated).length;
        const assets = assetValidation.filter((a) => a.validated).length;
        return Math.min(100, Math.round(45 + ((wf + assets) / (workflowValidation.length + assetValidation.length)) * 30));
    }
}
//# sourceMappingURL=audio-production-scorer.js.map