export class MarketingScorer {
    computeScores(campaign, effectivenessRating) {
        const content = campaign.content;
        const structure = campaign.campaign;
        const branding = campaign.branding;
        const hasHeadlines = (content?.headlines?.length ?? 0) > 0;
        const hasHooks = (content?.hooks?.length ?? 0) > 0;
        const hasCta = (content?.callToActions?.length ?? 0) > 0;
        const hasSellingPoints = (content?.sellingPoints?.length ?? 0) > 0;
        const hasStructure = Boolean(structure?.campaignStructure && structure?.campaignFlow);
        const hasBranding = Boolean(branding?.brandVoice && branding?.brandMessaging);
        const qualityScore = Math.min(100, 25 +
            (hasHeadlines ? 15 : 0) +
            (hasHooks ? 15 : 0) +
            (hasCta ? 15 : 0) +
            (hasSellingPoints ? 10 : 0) +
            (hasStructure ? 10 : 0) +
            (hasBranding ? 10 : 0));
        const effectivenessScore = effectivenessRating ?? campaign.scores?.effectivenessScore ?? 50;
        const engagementScore = Math.min(100, (content?.emotionalTriggers?.length ?? 0) * 12 + (content?.hashtags?.length ?? 0) * 3 + 30);
        const conversionScore = Math.min(100, hasCta ? 60 + (content?.callToActions?.length ?? 0) * 10 : 30);
        const learningScore = Math.min(100, (campaign.lessonsLearned?.length ?? 0) * 15 + (campaign.patterns?.length ?? 0) * 10);
        const aiConfidenceScore = Math.round((qualityScore + effectivenessScore + engagementScore + conversionScore) / 4);
        return {
            qualityScore,
            effectivenessScore,
            engagementScore,
            conversionScore,
            learningScore,
            aiConfidenceScore,
        };
    }
}
//# sourceMappingURL=marketing-scorer.js.map