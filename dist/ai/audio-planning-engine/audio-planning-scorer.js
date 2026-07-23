export class AudioPlanningScorer {
    computeScores(sceneAudioPlans, voice, music, sync, storyboard, scriptPlan, visualPlan, creative, strategy) {
        const audioPlanningScore = this.computePlanningScore(sceneAudioPlans, storyboard, scriptPlan, visualPlan);
        const voicePlanningScore = this.computeVoiceScore(voice, scriptPlan);
        const musicPlanningScore = this.computeMusicScore(music);
        const synchronizationScore = this.computeSyncScore(sync, sceneAudioPlans, scriptPlan);
        const brandConsistencyScore = this.computeBrandScore(voice, creative);
        const marketingScore = Math.min(100, strategy.scores.marketingReadinessScore);
        const aiConfidenceScore = Math.round((audioPlanningScore + voicePlanningScore + musicPlanningScore + synchronizationScore + brandConsistencyScore + marketingScore) / 6);
        return {
            audioPlanningScore,
            voicePlanningScore,
            musicPlanningScore,
            synchronizationScore,
            brandConsistencyScore,
            aiConfidenceScore,
        };
    }
    isAudioPlanValid(scores, sceneAudioPlans, storyboard, scriptPlan, visualPlan, alignmentIssues) {
        const diagnostics = [];
        if (alignmentIssues.length > 0)
            diagnostics.push(...alignmentIssues);
        if (sceneAudioPlans.length !== storyboard.scenes.length) {
            diagnostics.push("Scene audio plans must match every storyboard scene");
        }
        if (!sceneAudioPlans.every((s) => s.plannedVoiceOver.startsWith("Plan voice-over"))) {
            diagnostics.push("Every scene must have planned voice-over instructions");
        }
        if (scores.audioPlanningScore < 55) {
            diagnostics.push(`Audio planning score ${scores.audioPlanningScore} below threshold (55)`);
        }
        if (scores.voicePlanningScore < 50) {
            diagnostics.push(`Voice planning score ${scores.voicePlanningScore} below threshold (50)`);
        }
        if (scores.musicPlanningScore < 50) {
            diagnostics.push(`Music planning score ${scores.musicPlanningScore} below threshold (50)`);
        }
        if (scores.synchronizationScore < 50) {
            diagnostics.push(`Synchronization score ${scores.synchronizationScore} below threshold (50)`);
        }
        if (scores.brandConsistencyScore < 50) {
            diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(sceneAudioPlans, storyboard, scriptPlan, visualPlan, scores) {
        return (storyboard.productionReady &&
            scriptPlan.productionReady &&
            visualPlan.productionReady &&
            sceneAudioPlans.length === storyboard.scenes.length &&
            sceneAudioPlans.every((s) => s.plannedVoiceOver.startsWith("Plan voice-over")) &&
            scores.audioPlanningScore >= 55);
    }
    computePlanningScore(sceneAudioPlans, storyboard, scriptPlan, visualPlan) {
        let score = 50;
        if (sceneAudioPlans.length === storyboard.scenes.length)
            score += 15;
        if (sceneAudioPlans.length === scriptPlan.scenePlans.length)
            score += 10;
        if (sceneAudioPlans.length === visualPlan.scenePlans.length)
            score += 10;
        if (sceneAudioPlans.every((s) => s.plannedSfx.length >= 1))
            score += 10;
        if (sceneAudioPlans.every((s) => s.transitionAudio.startsWith("Plan transition")))
            score += 5;
        return Math.min(100, score);
    }
    computeVoiceScore(voice, scriptPlan) {
        let score = 45;
        if (voice.voiceStyle)
            score += 15;
        if (voice.emphasisPoints.length >= 2)
            score += 10;
        if (voice.pronunciationRules.length >= 2)
            score += 10;
        if (Object.keys(voice.readingDuration).length === scriptPlan.scenePlans.length)
            score += 10;
        if (Object.keys(voice.pauseTiming).length >= scriptPlan.scenePlans.length)
            score += 10;
        return Math.min(100, score);
    }
    computeMusicScore(music) {
        let score = 45;
        if (music.introMusic.startsWith("Plan intro"))
            score += 15;
        if (music.backgroundMusic.startsWith("Plan background"))
            score += 15;
        if (music.endingMusic.startsWith("Plan ending"))
            score += 10;
        if (music.fadeIn && music.fadeOut)
            score += 10;
        if (music.volumeStrategy)
            score += 5;
        return Math.min(100, score);
    }
    computeSyncScore(sync, sceneAudioPlans, scriptPlan) {
        let score = 45;
        if (Object.keys(sync.voiceTiming).length === sceneAudioPlans.length)
            score += 15;
        if (Object.keys(sync.subtitleTiming).length === sceneAudioPlans.length)
            score += 15;
        if (Object.keys(sync.sceneTiming).length === sceneAudioPlans.length)
            score += 10;
        if (sync.ctaTiming)
            score += 10;
        if (Object.keys(sync.musicTiming).length === scriptPlan.scenePlans.length)
            score += 5;
        return Math.min(100, score);
    }
    computeBrandScore(voice, creative) {
        let score = 45;
        if (voice.voiceStyle === creative.brandDirection.brandVoice || voice.voiceStyle)
            score += 15;
        if (voice.emphasisPoints.some((p) => p.includes(creative.profile.brand)))
            score += 15;
        if (voice.pronunciationRules.some((r) => r.includes(creative.profile.brand)))
            score += 15;
        if (voice.speakingTone.includes(creative.profile.tone.split(" ")[0] ?? ""))
            score += 10;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=audio-planning-scorer.js.map