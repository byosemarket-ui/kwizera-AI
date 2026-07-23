export class AudioSynchronizationScorer {
    computeScores(draft, scene, motionPlan, cameraPlan, animationPlan, vfxPlan) {
        const audioSynchronizationScore = this.computeAudioSync(draft, scene);
        const lipSyncScore = this.computeLipSync(draft, animationPlan);
        const musicAlignmentScore = this.computeMusicAlignment(draft, scene);
        const subtitleQualityScore = this.computeSubtitleQuality(draft);
        const productionReadinessScore = this.computeProductionReadiness(draft, scene, motionPlan, cameraPlan, animationPlan, vfxPlan);
        const aiConfidenceScore = Math.round((audioSynchronizationScore + lipSyncScore + musicAlignmentScore + subtitleQualityScore + productionReadinessScore) / 5);
        return {
            audioSynchronizationScore,
            lipSyncScore,
            musicAlignmentScore,
            subtitleQualityScore,
            productionReadinessScore,
            aiConfidenceScore,
        };
    }
    isPlanValid(scores, draft) {
        const diagnostics = [];
        if (draft.sceneSynchronization.motionSync.length < 1)
            diagnostics.push("Motion synchronization required");
        if (draft.sceneSynchronization.voiceSync.length < 1)
            diagnostics.push("Voice synchronization required");
        if (!draft.voiceSynchronization.lipSyncBlueprint || draft.voiceSynchronization.lipSyncBlueprint === "N/A") {
            diagnostics.push("Lip sync blueprint required");
        }
        if (scores.audioSynchronizationScore < 55) {
            diagnostics.push(`Audio synchronization score ${scores.audioSynchronizationScore} below threshold (55)`);
        }
        if (scores.lipSyncScore < 50) {
            diagnostics.push(`Lip sync score ${scores.lipSyncScore} below threshold (50)`);
        }
        if (scores.musicAlignmentScore < 50) {
            diagnostics.push(`Music alignment score ${scores.musicAlignmentScore} below threshold (50)`);
        }
        if (scores.subtitleQualityScore < 50) {
            diagnostics.push(`Subtitle quality score ${scores.subtitleQualityScore} below threshold (50)`);
        }
        if (scores.productionReadinessScore < 55) {
            diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scores, draft) {
        return scores.productionReadinessScore >= 55 && draft.platformOptimizations.length >= 7;
    }
    isBrandConsistent(scene) {
        return scene.brandConsistent;
    }
    isAudioContinuityMaintained(draft) {
        return draft.continuity.voiceContinuity && draft.continuity.effectContinuity && draft.continuity.issues.length === 0;
    }
    computeAudioSync(draft, scene) {
        let score = 45;
        if (draft.voiceSynchronization.voiceTiming.length > 3)
            score += 15;
        if (draft.musicSynchronization.musicTiming.length > 3)
            score += 15;
        if (draft.sceneSynchronization.motionSync.length >= 1)
            score += 15;
        if (scene.structure.sceneObjectives.length >= 1)
            score += 10;
        return Math.min(100, score);
    }
    computeLipSync(draft, animationPlan) {
        let score = 45;
        if (draft.voiceSynchronization.lipSyncBlueprint.length > 5)
            score += 25;
        if (animationPlan.characterAnimation.lipMovementPlan.length > 5)
            score += 20;
        if (draft.voiceSynchronization.speechAlignment.length > 5)
            score += 10;
        return Math.min(100, score);
    }
    computeMusicAlignment(draft, scene) {
        let score = 45;
        if (draft.musicSynchronization.beatDetection.length > 5)
            score += 20;
        if (draft.musicSynchronization.rhythmAlignment.length > 5)
            score += 20;
        if (scene.audioPlanning.musicTiming.length > 3)
            score += 15;
        return Math.min(100, score);
    }
    computeSubtitleQuality(draft) {
        let score = 45;
        if (draft.subtitleSynchronization.subtitleTiming.length > 5)
            score += 20;
        if (draft.subtitleSynchronization.readingSpeedValidation.length > 5)
            score += 20;
        if (draft.subtitleSynchronization.captionStyling.length > 5)
            score += 15;
        return Math.min(100, score);
    }
    computeProductionReadiness(draft, scene, motionPlan, cameraPlan, animationPlan, vfxPlan) {
        let score = 45;
        if (scene.productionReady &&
            motionPlan.productionReady &&
            cameraPlan.productionReady &&
            animationPlan.productionReady &&
            vfxPlan.productionReady) {
            score += 25;
        }
        if (draft.platformOptimizations.length >= 7)
            score += 15;
        if (draft.audioMixing.loudnessNormalization.length >= 5)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=audio-synchronization-scorer.js.map