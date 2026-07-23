export class MusicGenerationScorer {
    computeScores(analysis, composition, arrangement, moodPlan, syncPlan, productionInstructions, context) {
        const compositionScore = this.computeCompositionScore(analysis, composition);
        const harmonyScore = this.computeHarmonyScore(composition);
        const rhythmScore = this.computeRhythmScore(composition, analysis);
        const emotionalScore = this.computeEmotionalScore(moodPlan, analysis);
        const brandConsistencyScore = this.computeBrandConsistency(context, moodPlan);
        const productionReadinessScore = this.computeProductionReadiness(analysis, arrangement, syncPlan, productionInstructions);
        const aiConfidenceScore = Math.round((compositionScore +
            harmonyScore +
            rhythmScore +
            emotionalScore +
            brandConsistencyScore +
            productionReadinessScore) /
            6);
        return {
            compositionScore,
            harmonyScore,
            rhythmScore,
            emotionalScore,
            brandConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isMusicPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.compositionScore < 55) {
            diagnostics.push(`Composition score ${scores.compositionScore} below threshold (55)`);
        }
        if (scores.harmonyScore < 55) {
            diagnostics.push(`Harmony score ${scores.harmonyScore} below threshold (55)`);
        }
        if (scores.rhythmScore < 55) {
            diagnostics.push(`Rhythm score ${scores.rhythmScore} below threshold (55)`);
        }
        if (scores.emotionalScore < 50) {
            diagnostics.push(`Emotional score ${scores.emotionalScore} below threshold (50)`);
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
        if (!record.compositionPlan.intro || !record.compositionPlan.chorus) {
            diagnostics.push("Composition structure incomplete — intro/chorus required");
        }
        if (record.compositionPlan.chordProgression.length < 2) {
            diagnostics.push("Chord progression planning incomplete");
        }
        if (record.arrangementPlan.activeInstruments.length < 2) {
            diagnostics.push("Arrangement planning incomplete — minimum 2 instruments");
        }
        if (record.moodPlan.emotionalArc.length < 3) {
            diagnostics.push("Mood planning emotional arc incomplete");
        }
        if (record.syncPreparation.hitPoints.length < 2) {
            diagnostics.push("Sync preparation hit points incomplete");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.compositionScore >= 55 &&
            scores.harmonyScore >= 55 &&
            record.productionInstructions.renderNotes.length >= 1 &&
            record.syncPreparation.hitPoints.length >= 2);
    }
    isBrandConsistent(context, moodPlan) {
        if (!context.brandName)
            return moodPlan.brandMoodAlignment.length >= 10;
        return moodPlan.brandMoodAlignment.toLowerCase().includes(context.brandName.toLowerCase());
    }
    computeCompositionScore(analysis, plan) {
        let score = 45;
        if (plan.melodyStructure.length >= 2)
            score += 15;
        if (plan.intro && plan.verse && plan.chorus && plan.outro)
            score += 20;
        if (plan.chordProgression.length >= 2)
            score += 10;
        if (analysis.durationSec > 0)
            score += 10;
        return Math.min(100, score);
    }
    computeHarmonyScore(plan) {
        let score = 45;
        if (plan.harmonyStructure.length >= 2)
            score += 20;
        if (plan.chordProgression.length >= 3)
            score += 20;
        if (plan.bridge.length >= 10)
            score += 15;
        return Math.min(100, score);
    }
    computeRhythmScore(plan, analysis) {
        let score = 45;
        if (plan.rhythmStructure.length >= 2)
            score += 20;
        if (analysis.tempo.length >= 5)
            score += 15;
        if (analysis.timeSignature)
            score += 10;
        if (plan.intro && plan.chorus)
            score += 10;
        return Math.min(100, score);
    }
    computeEmotionalScore(moodPlan, analysis) {
        let score = 45;
        if (moodPlan.emotionalArc.length >= 3)
            score += 20;
        if (moodPlan.moodTransitions.length >= 2)
            score += 15;
        if (moodPlan.primaryMood === analysis.mood)
            score += 15;
        if (moodPlan.intensityCurve.length >= 10)
            score += 5;
        return Math.min(100, score);
    }
    computeBrandConsistency(context, moodPlan) {
        let score = 45;
        if (moodPlan.brandMoodAlignment.length >= 15)
            score += 20;
        if (context.brandGuidelines)
            score += 15;
        if (context.brandName && moodPlan.brandMoodAlignment.toLowerCase().includes(context.brandName.toLowerCase())) {
            score += 20;
        }
        return Math.min(100, score);
    }
    computeProductionReadiness(analysis, arrangement, syncPlan, instructions) {
        let score = 45;
        if (analysis.durationSec > 0)
            score += 10;
        if (arrangement.activeInstruments.length >= 2)
            score += 15;
        if (syncPlan.hitPoints.length >= 3)
            score += 15;
        if (instructions.renderNotes.length >= 2)
            score += 10;
        if (instructions.qualityTargets.length >= 2)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=music-generation-scorer.js.map