export class AudioMixingMasteringScorer {
    computeScores(analysis, mixing, mastering, frequency, loudness, spatial, productionInstructions, context) {
        const mixingQualityScore = this.computeMixingScore(analysis, mixing);
        const masteringQualityScore = this.computeMasteringScore(mastering);
        const loudnessScore = this.computeLoudnessScore(loudness, mastering);
        const frequencyBalanceScore = this.computeFrequencyScore(frequency, analysis);
        const brandConsistencyScore = this.computeBrandConsistency(context, productionInstructions);
        const productionReadinessScore = this.computeProductionReadiness(analysis, mixing, mastering, productionInstructions);
        const aiConfidenceScore = Math.round((mixingQualityScore +
            masteringQualityScore +
            loudnessScore +
            frequencyBalanceScore +
            brandConsistencyScore +
            productionReadinessScore) /
            6);
        return {
            mixingQualityScore,
            masteringQualityScore,
            loudnessScore,
            frequencyBalanceScore,
            brandConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isMixMasterPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.mixingQualityScore < 55)
            diagnostics.push(`Mixing quality ${scores.mixingQualityScore} below threshold (55)`);
        if (scores.masteringQualityScore < 55)
            diagnostics.push(`Mastering quality ${scores.masteringQualityScore} below threshold (55)`);
        if (scores.loudnessScore < 55)
            diagnostics.push(`Loudness score ${scores.loudnessScore} below threshold (55)`);
        if (scores.frequencyBalanceScore < 55)
            diagnostics.push(`Frequency balance ${scores.frequencyBalanceScore} below threshold (55)`);
        if (scores.brandConsistencyScore < 50)
            diagnostics.push(`Brand consistency ${scores.brandConsistencyScore} below threshold (50)`);
        if (scores.productionReadinessScore < 55)
            diagnostics.push(`Production readiness ${scores.productionReadinessScore} below threshold (55)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        if (record.multiTrackAnalysis.trackCount < 1)
            diagnostics.push("Multi-track analysis incomplete");
        if (Object.keys(record.mixingPlan.trackBalancing).length < 1)
            diagnostics.push("Mixing planning incomplete");
        if (record.masteringPlan.techniques.length < 4)
            diagnostics.push("Mastering planning incomplete");
        if (!record.loudnessManagement.platformTarget)
            diagnostics.push("Loudness planning incomplete");
        if (!record.spatialMixPlan.monoCompatibility)
            diagnostics.push("Spatial audio planning incomplete");
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.mixingQualityScore >= 55 &&
            scores.masteringQualityScore >= 55 &&
            record.productionInstructions.renderNotes.length >= 1 &&
            record.mixingPlan.processingChain.length >= 2);
    }
    isBrandConsistent(context, instructions) {
        if (!context.brandName)
            return instructions.mixingGuidance.length >= 1;
        return Boolean(context.brandGuidelines) || instructions.renderNotes.length >= 1;
    }
    computeMixingScore(analysis, mixing) {
        let score = 45;
        if (analysis.trackCount >= 2)
            score += 10;
        if (Object.keys(mixing.trackBalancing).length >= 2)
            score += 15;
        if (mixing.busRouting.length >= 3)
            score += 15;
        if (mixing.processingChain.length >= 3)
            score += 15;
        return Math.min(100, score);
    }
    computeMasteringScore(mastering) {
        let score = 45;
        if (mastering.techniques.length >= 6)
            score += 25;
        if (mastering.loudnessNormalization.length >= 10)
            score += 15;
        if (mastering.peakProtection.length >= 5)
            score += 15;
        return Math.min(100, score);
    }
    computeLoudnessScore(loudness, mastering) {
        let score = 45;
        if (loudness.platformTarget.length >= 5)
            score += 20;
        if (loudness.streamingLoudness.length >= 5)
            score += 15;
        if (mastering.targetLufs !== 0)
            score += 20;
        return Math.min(100, score);
    }
    computeFrequencyScore(frequency, analysis) {
        let score = 45;
        if (frequency.lowFrequencies.length >= 10)
            score += 15;
        if (frequency.tonalBalance.length >= 5)
            score += 15;
        if (frequency.frequencyMasking.length >= 1)
            score += 15;
        if (analysis.frequencyDistribution.low)
            score += 10;
        return Math.min(100, score);
    }
    computeBrandConsistency(context, instructions) {
        let score = 45;
        if (context.brandGuidelines)
            score += 25;
        if (context.brandName)
            score += 15;
        if (instructions.qualityTargets.length >= 2)
            score += 15;
        return Math.min(100, score);
    }
    computeProductionReadiness(analysis, mixing, mastering, instructions) {
        let score = 45;
        if (analysis.trackCount >= 1)
            score += 10;
        if (mixing.processingChain.length >= 2)
            score += 15;
        if (mastering.techniques.length >= 4)
            score += 15;
        if (instructions.exportPreparation.length >= 2)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=audio-mixing-mastering-scorer.js.map