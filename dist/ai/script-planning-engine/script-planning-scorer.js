export class ScriptPlanningScorer {
    computeScores(scenePlans, scriptStructure, voice, subtitles, storyboard, creative, strategy) {
        const scriptPlanningScore = this.computePlanningScore(scenePlans, storyboard);
        const storytellingScore = Math.min(100, storyboard.scores.storytellingScore);
        const marketingScore = Math.min(100, strategy.scores.marketingReadinessScore);
        const readabilityScore = this.computeReadability(scenePlans, subtitles);
        const brandConsistencyScore = this.computeBrandScore(voice, creative);
        const aiConfidenceScore = Math.round((scriptPlanningScore + storytellingScore + marketingScore + readabilityScore + brandConsistencyScore) / 5);
        return {
            scriptPlanningScore,
            storytellingScore,
            marketingScore,
            readabilityScore,
            brandConsistencyScore,
            aiConfidenceScore,
        };
    }
    isScriptPlanValid(scores, scenePlans, storyboard, alignmentIssues) {
        const diagnostics = [];
        if (alignmentIssues.length > 0)
            diagnostics.push(...alignmentIssues);
        if (scenePlans.length !== storyboard.scenes.length) {
            diagnostics.push("Scene plans must match every storyboard scene");
        }
        if (!scenePlans.some((s) => s.scenePurpose === "hook")) {
            diagnostics.push("Hook scene script plan required");
        }
        if (!scenePlans.some((s) => s.plannedCta !== "none")) {
            diagnostics.push("CTA script plan required");
        }
        if (scores.scriptPlanningScore < 55) {
            diagnostics.push(`Script planning score ${scores.scriptPlanningScore} below threshold (55)`);
        }
        if (scores.readabilityScore < 50) {
            diagnostics.push(`Readability score ${scores.readabilityScore} below threshold (50)`);
        }
        if (scores.brandConsistencyScore < 50) {
            diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    isProductionReady(scenePlans, storyboard, scores) {
        return (storyboard.productionReady &&
            scenePlans.length === storyboard.scenes.length &&
            scenePlans.every((s) => s.plannedNarration.startsWith("Plan narration")) &&
            scores.scriptPlanningScore >= 55);
    }
    computePlanningScore(scenePlans, storyboard) {
        let score = 50;
        if (scenePlans.length === storyboard.scenes.length)
            score += 20;
        if (scenePlans.every((s) => s.plannedNarration.length >= 20))
            score += 10;
        if (scenePlans.every((s) => s.messageObjective.length >= 10))
            score += 10;
        if (scenePlans.every((s) => s.estimatedReadingTime && s.estimatedDisplayTime))
            score += 10;
        return Math.min(100, score);
    }
    computeReadability(scenePlans, subtitles) {
        let score = 45;
        if (scenePlans.every((s) => s.plannedSubtitle.startsWith("Plan subtitle")))
            score += 20;
        if (subtitles.synchronizationRules.length >= 3)
            score += 15;
        if (subtitles.lineLengthValidation.includes("within limit"))
            score += 10;
        if (Object.keys(subtitles.readingDuration).length === scenePlans.length)
            score += 10;
        return Math.min(100, score);
    }
    computeBrandScore(voice, creative) {
        let score = 45;
        if (voice.voiceStyle)
            score += 15;
        if (voice.emphasisPoints.some((p) => p.includes(creative.profile.brand)))
            score += 15;
        if (voice.pauseLocations.length >= 1)
            score += 10;
        if (voice.narrationStyle.includes(creative.profile.tone.split(" ")[0] ?? ""))
            score += 10;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=script-planning-scorer.js.map