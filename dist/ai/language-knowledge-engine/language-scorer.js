const MIN_STORE_CONFIDENCE = 55;
export class LanguageScorer {
    computeScores(grammar, marketing, subtitles, localization, content, writingStyle) {
        const grammarScore = Math.round(grammar.grammarScore * 0.7 +
            (grammar.issues.length === 0 ? 20 : Math.max(0, 20 - grammar.issues.length * 5)) +
            (grammar.sentenceStructure ? 10 : 0));
        const readabilityScore = Math.round((content.length >= 20 && content.length <= 500 ? 30 : 15) +
            (grammar.issues.length === 0 ? 25 : 10) +
            (writingStyle ? 15 : 0) +
            subtitles.readabilityOnScreen * 0.3);
        const marketingScore = Math.round((marketing.headlines.length >= 1 ? 20 : 5) +
            (marketing.hooks.length >= 1 ? 20 : 5) +
            (marketing.callToActions.length >= 1 ? 20 : 5) +
            (marketing.promotionalScripts.length >= 1 ? 15 : 0) +
            (marketing.socialCaptions.length >= 1 ? 15 : 0));
        const translationReadinessScore = Math.round(localization.translationReadiness * 0.5 +
            localization.localizationReadiness * 0.3 +
            (localization.relatedLanguages.length >= 1 ? 15 : 0) +
            (grammar.issues.length === 0 ? 10 : 0));
        const subtitleQualityScore = Math.round(subtitles.syncQuality * 0.4 +
            subtitles.readabilityOnScreen * 0.4 +
            (subtitles.subtitleText.length >= 1 ? 15 : 0) +
            (subtitles.timingMarkers.length >= 2 ? 10 : 0));
        const aiConfidenceScore = Math.round((grammarScore +
            readabilityScore +
            marketingScore +
            translationReadinessScore +
            subtitleQualityScore) /
            5);
        return {
            grammarScore: Math.min(100, grammarScore),
            readabilityScore: Math.min(100, readabilityScore),
            marketingScore: Math.min(100, marketingScore),
            translationReadinessScore: Math.min(100, translationReadinessScore),
            subtitleQualityScore: Math.min(100, subtitleQualityScore),
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isAnalysisValid(content, scores) {
        const diagnostics = [];
        if (!content || content.trim().length < 5) {
            diagnostics.push("Content text is required for validated language knowledge");
        }
        if (scores.aiConfidenceScore < MIN_STORE_CONFIDENCE) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below minimum ${MIN_STORE_CONFIDENCE}`);
        }
        if (scores.grammarScore < 45) {
            diagnostics.push("Grammar score too low for verified storage");
        }
        const minDimension = 50;
        if (scores.readabilityScore < minDimension) {
            diagnostics.push(`Readability ${scores.readabilityScore} below minimum ${minDimension}`);
        }
        if (scores.marketingScore < minDimension && content.length > 20) {
            diagnostics.push(`Marketing language score ${scores.marketingScore} below minimum ${minDimension}`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=language-scorer.js.map