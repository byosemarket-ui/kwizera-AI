export class CreativeDirectionScorer {
    computeScores(profile, visual, brand, marketing, platformDirections, strategy, audience) {
        const creativeQualityScore = this.computeCreativeQuality(profile, visual, marketing, platformDirections);
        const brandConsistencyScore = this.computeBrandConsistency(brand, profile);
        const marketingAlignmentScore = Math.min(100, strategy.scores.strategyQualityScore);
        const visualDirectionScore = this.computeVisualDirectionScore(visual);
        const audienceAlignmentScore = Math.min(100, audience.scores.audienceRelevanceScore);
        const aiConfidenceScore = Math.round((creativeQualityScore +
            brandConsistencyScore +
            marketingAlignmentScore +
            visualDirectionScore +
            audienceAlignmentScore) /
            5);
        return {
            creativeQualityScore,
            brandConsistencyScore,
            marketingAlignmentScore,
            visualDirectionScore,
            audienceAlignmentScore,
            aiConfidenceScore,
        };
    }
    isCreativeDirectionValid(scores, profile, brand, marketing, platformDirections) {
        const diagnostics = [];
        if (!profile.creativeTheme)
            diagnostics.push("Creative theme is required");
        if (!profile.creativeStyle)
            diagnostics.push("Creative style must be selected");
        if (brand.brandColors.length < 2)
            diagnostics.push("Brand colors insufficient for validated direction");
        if (!marketing.hookDirection)
            diagnostics.push("Hook direction is required");
        if (platformDirections.length < 1)
            diagnostics.push("At least one platform direction required");
        if (scores.creativeQualityScore < 55) {
            diagnostics.push(`Creative quality score ${scores.creativeQualityScore} below threshold (55)`);
        }
        if (scores.brandConsistencyScore < 50) {
            diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
        }
        if (scores.marketingAlignmentScore < 50) {
            diagnostics.push(`Marketing alignment score ${scores.marketingAlignmentScore} below threshold (50)`);
        }
        if (scores.audienceAlignmentScore < 50) {
            diagnostics.push(`Audience alignment score ${scores.audienceAlignmentScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
    computeCreativeQuality(profile, visual, marketing, platforms) {
        let score = 50;
        if (profile.creativeTheme.length >= 20)
            score += 10;
        if (visual.colorPalette.length >= 3)
            score += 10;
        if (marketing.storytellingDirection.length >= 30)
            score += 10;
        if (platforms.length >= 2)
            score += 10;
        if (profile.emotionalDirection.length >= 20)
            score += 10;
        return Math.min(100, score);
    }
    computeBrandConsistency(brand, profile) {
        let score = 45;
        if (brand.brandIdentity)
            score += 15;
        if (brand.brandVoice)
            score += 15;
        if (brand.brandColors.length >= 2)
            score += 10;
        if (brand.brandConsistency.length >= 30)
            score += 10;
        if (profile.brand)
            score += 5;
        return Math.min(100, score);
    }
    computeVisualDirectionScore(visual) {
        const fields = [
            visual.colorPalette,
            visual.typographyStyle,
            visual.designStyle,
            visual.compositionStyle,
            visual.lightingStyle,
            visual.visualHierarchy,
        ];
        const filled = fields.filter((f) => (Array.isArray(f) ? f.length > 0 : Boolean(f))).length;
        return Math.min(100, 40 + filled * 10);
    }
}
//# sourceMappingURL=creative-direction-scorer.js.map