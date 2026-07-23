export class AmbientAudioGenerationScorer {
    computeScores(analysis, ambientPlan, urbanPlan, indoorPlan, weatherPlan, spatialPlan, timelinePlan, syncPlan, productionInstructions, context) {
        const environmentalRealismScore = this.computeEnvironmentalRealism(analysis, ambientPlan, indoorPlan, weatherPlan);
        const immersionScore = this.computeImmersionScore(analysis, spatialPlan, timelinePlan);
        const spatialAudioScore = this.computeSpatialAudioScore(spatialPlan);
        const synchronizationScore = this.computeSynchronizationScore(timelinePlan, syncPlan);
        const brandConsistencyScore = this.computeBrandConsistency(context, productionInstructions);
        const productionReadinessScore = this.computeProductionReadiness(analysis, timelinePlan, syncPlan, productionInstructions);
        const aiConfidenceScore = Math.round((environmentalRealismScore +
            immersionScore +
            spatialAudioScore +
            synchronizationScore +
            brandConsistencyScore +
            productionReadinessScore) /
            6);
        return {
            environmentalRealismScore,
            immersionScore,
            spatialAudioScore,
            synchronizationScore,
            brandConsistencyScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isAmbientPlanValid(scores, record) {
        const diagnostics = [];
        if (scores.environmentalRealismScore < 55)
            diagnostics.push(`Environmental realism ${scores.environmentalRealismScore} below threshold (55)`);
        if (scores.immersionScore < 50)
            diagnostics.push(`Immersion score ${scores.immersionScore} below threshold (50)`);
        if (scores.spatialAudioScore < 55)
            diagnostics.push(`Spatial audio score ${scores.spatialAudioScore} below threshold (55)`);
        if (scores.synchronizationScore < 55)
            diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (55)`);
        if (scores.brandConsistencyScore < 50)
            diagnostics.push(`Brand consistency ${scores.brandConsistencyScore} below threshold (50)`);
        if (scores.productionReadinessScore < 55)
            diagnostics.push(`Production readiness ${scores.productionReadinessScore} below threshold (55)`);
        if (scores.aiConfidenceScore < 55)
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        if (!record.environmentAnalysis.environmentType || !record.environmentAnalysis.acousticSpace) {
            diagnostics.push("Environment analysis incomplete");
        }
        if (record.ambientSoundPlan.natureAmbience.length < 1) {
            diagnostics.push("Ambient sound planning incomplete");
        }
        if (record.weatherAmbiencePlan.weatherTypes.length < 1) {
            diagnostics.push("Weather planning incomplete");
        }
        if (!record.spatialAudioPlan.surroundPreparation) {
            diagnostics.push("Spatial audio planning incomplete");
        }
        if (record.timelinePlan.cuePoints.length < 3) {
            diagnostics.push("Timeline planning incomplete — minimum 3 cue points");
        }
        if (record.syncPreparation.hitPoints.length < 1) {
            diagnostics.push("Sync preparation incomplete");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, record) {
        return (scores.productionReadinessScore >= 55 &&
            scores.environmentalRealismScore >= 55 &&
            scores.spatialAudioScore >= 55 &&
            record.productionInstructions.renderNotes.length >= 1 &&
            record.timelinePlan.cuePoints.length >= 3);
    }
    isBrandConsistent(context, instructions) {
        if (!context.brandName)
            return instructions.immersionGuidance.length >= 1;
        return Boolean(context.brandGuidelines) || instructions.renderNotes.length >= 1;
    }
    computeEnvironmentalRealism(analysis, ambient, indoor, weather) {
        let score = 45;
        if (analysis.location.length >= 3)
            score += 10;
        if (ambient.natureAmbience.length >= 1)
            score += 15;
        if (weather.weatherTypes.length >= 1)
            score += 15;
        if (indoor.roomTone.length >= 5 || analysis.indoorOutdoor === "outdoor")
            score += 15;
        return Math.min(100, score);
    }
    computeImmersionScore(analysis, spatial, timeline) {
        let score = 45;
        if (analysis.intendedMood.length >= 3)
            score += 15;
        if (spatial.depth.length >= 10)
            score += 15;
        if (timeline.dynamicIntensity.length >= 2)
            score += 15;
        if (timeline.layerOrder.length >= 2)
            score += 10;
        return Math.min(100, score);
    }
    computeSpatialAudioScore(spatial) {
        let score = 45;
        if (spatial.leftRightPositioning.length >= 10)
            score += 15;
        if (spatial.surroundPreparation.length >= 10)
            score += 20;
        if (spatial.binauralPreparation.length >= 10)
            score += 20;
        return Math.min(100, score);
    }
    computeSynchronizationScore(timeline, sync) {
        let score = 45;
        if (timeline.cuePoints.length >= 3)
            score += 20;
        if (sync.hitPoints.length >= 2)
            score += 15;
        if (timeline.fadeIn && timeline.fadeOut)
            score += 10;
        if (sync.syncNotes.length >= 2)
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
    computeProductionReadiness(analysis, timeline, sync, instructions) {
        let score = 45;
        if (analysis.durationSec > 0)
            score += 10;
        if (timeline.layerOrder.length >= 2)
            score += 15;
        if (sync.hitPoints.length >= 1)
            score += 15;
        if (instructions.renderNotes.length >= 2)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=ambient-audio-generation-scorer.js.map