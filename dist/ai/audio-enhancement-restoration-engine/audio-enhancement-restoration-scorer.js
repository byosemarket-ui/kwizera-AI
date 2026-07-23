import { AudioInputCategory, EnhancementTechnique, } from "./types.js";
export class AudioEnhancementRestorationScorer {
    computeScores(analysis, enhancement, restoration, voicePlan, musicPlan, syncPlan, productionInstructions, context) {
        const audioClarityScore = this.computeClarityScore(analysis, enhancement, voicePlan);
        const restorationScore = this.computeRestorationScore(analysis, restoration);
        const noiseReductionScore = this.computeNoiseReductionScore(analysis, enhancement);
        const synchronizationScore = this.computeSynchronizationScore(syncPlan);
        const brandConsistencyScore = this.computeBrandConsistency(context, productionInstructions);
        const productionReadinessScore = this.computeProductionReadiness(analysis, enhancement, restoration, productionInstructions);
        const aiConfidenceScore = Math.round((audioClarityScore +
            restorationScore +
            noiseReductionScore +
            synchronizationScore +
            brandConsistencyScore +
            productionReadinessScore) /
            6);
        return {
            audioClarityScore,
            restorationScore,
            noiseReductionScore,
            synchronizationScore,
            brandConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isEnhancementPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.audioClarityScore < 55)
            diagnostics.push(`Audio clarity ${scores.audioClarityScore} below threshold (55)`);
        if (scores.restorationScore < 55)
            diagnostics.push(`Restoration score ${scores.restorationScore} below threshold (55)`);
        if (scores.noiseReductionScore < 55)
            diagnostics.push(`Noise reduction ${scores.noiseReductionScore} below threshold (55)`);
        if (scores.synchronizationScore < 55)
            diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (55)`);
        if (scores.brandConsistencyScore < 50)
            diagnostics.push(`Brand consistency ${scores.brandConsistencyScore} below threshold (50)`);
        if (scores.productionReadinessScore < 55)
            diagnostics.push(`Production readiness ${scores.productionReadinessScore} below threshold (55)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        if (!record.audioQualityAnalysis.audioCategory || record.audioQualityAnalysis.sampleRate < 1) {
            diagnostics.push("Audio analysis incomplete");
        }
        if (record.enhancementPlan.techniques.length < 1) {
            diagnostics.push("Enhancement planning incomplete");
        }
        if (record.restorationPlan.techniques.length < 1) {
            diagnostics.push("Restoration planning incomplete");
        }
        if (!record.syncPlan.timelineAlignment) {
            diagnostics.push("Synchronization planning incomplete");
        }
        if (record.audioQualityAnalysis.audioCategory === AudioInputCategory.VoiceAudio &&
            record.voiceImprovementPlan.speechClarity === "N/A — non-voice source") {
            diagnostics.push("Voice improvement planning incomplete for voice source");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.audioClarityScore >= 55 &&
            scores.restorationScore >= 55 &&
            record.productionInstructions.renderNotes.length >= 1 &&
            record.enhancementPlan.processingChain.length >= 1);
    }
    isBrandConsistent(context, instructions) {
        if (!context.brandName)
            return instructions.clarityGuidance.length >= 1;
        return Boolean(context.brandGuidelines) || instructions.renderNotes.length >= 1;
    }
    computeClarityScore(analysis, enhancement, voice) {
        let score = 45;
        if (analysis.sampleRate >= 44100)
            score += 10;
        if (enhancement.techniques.length >= 2)
            score += 15;
        if (voice.speechClarity.length >= 10 || analysis.audioCategory !== AudioInputCategory.VoiceAudio)
            score += 15;
        if (analysis.signalToNoiseRatioDb >= 30)
            score += 15;
        return Math.min(100, score);
    }
    computeRestorationScore(analysis, restoration) {
        let score = 45;
        if (restoration.techniques.length >= 1)
            score += 20;
        if (restoration.defectTargets && Object.keys(restoration.defectTargets).length >= 1)
            score += 15;
        if (restoration.recoveryNotes.length >= 2)
            score += 10;
        if (analysis.defects.length <= 3 || restoration.severityLevel !== "high")
            score += 10;
        return Math.min(100, score);
    }
    computeNoiseReductionScore(analysis, enhancement) {
        let score = 45;
        if (enhancement.techniques.includes(EnhancementTechnique.NoiseReduction))
            score += 25;
        if (analysis.backgroundNoiseLevel === "low" || analysis.defects.includes("background-noise"))
            score += 15;
        if (enhancement.targetLoudnessLufs !== 0)
            score += 15;
        return Math.min(100, score);
    }
    computeSynchronizationScore(sync) {
        let score = 45;
        if (sync.timelineAlignment.length >= 10)
            score += 20;
        if (sync.multiTrackAlignment.length >= 2)
            score += 15;
        if (sync.syncNotes.length >= 2)
            score += 10;
        if (sync.lipSyncMetadata.length >= 3)
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
    computeProductionReadiness(analysis, enhancement, restoration, instructions) {
        let score = 45;
        if (analysis.durationSec > 0)
            score += 10;
        if (enhancement.processingChain.length >= 2)
            score += 15;
        if (restoration.techniques.length >= 1)
            score += 15;
        if (instructions.exportPreparation.length >= 2)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=audio-enhancement-restoration-scorer.js.map