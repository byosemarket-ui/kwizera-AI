const MIN_STORE_CONFIDENCE = 55;
export class BrandScorer {
    computeScores(profile, visual, communication, consistency) {
        const hasValues = profile.brandValues.length >= 2;
        const hasMissionVision = Boolean(profile.brandMission && profile.brandVision);
        const hasLogoRules = visual.logoUsageRules.length >= 2;
        const hasColorPalette = visual.brandColors.length >= 3;
        const brandConsistencyScore = consistency.overallConsistency;
        const visualIdentityScore = Math.round((hasLogoRules ? 20 : 5) +
            (hasColorPalette ? 25 : 8) +
            (visual.typography ? 15 : 0) +
            (visual.designLanguage ? 15 : 0) +
            (visual.logoVariations.length >= 2 ? 15 : 5) +
            consistency.logoUsage * 0.1);
        const communicationScore = Math.round((communication.brandVoice ? 25 : 5) +
            (communication.writingStyle ? 15 : 0) +
            (communication.messagingStyle ? 15 : 0) +
            (communication.storytellingStyle ? 15 : 0) +
            consistency.voiceConsistency * 0.3);
        const marketingScore = Math.round((communication.marketingTone ? 25 : 5) +
            (communication.callToActionStyle ? 20 : 5) +
            (communication.emotionalStyle ? 15 : 0) +
            consistency.marketingConsistency * 0.4);
        const recognitionScore = Math.round((profile.brandName.length >= 2 ? 25 : 5) +
            (visual.logo ? 25 : 5) +
            (hasColorPalette ? 20 : 5) +
            (profile.brandPositioning ? 15 : 0) +
            (hasMissionVision ? 15 : 0));
        const aiConfidenceScore = Math.round((brandConsistencyScore +
            visualIdentityScore +
            communicationScore +
            marketingScore +
            recognitionScore) /
            5);
        return {
            brandConsistencyScore: Math.min(100, brandConsistencyScore),
            visualIdentityScore: Math.min(100, visualIdentityScore),
            communicationScore: Math.min(100, communicationScore),
            marketingScore: Math.min(100, marketingScore),
            recognitionScore: Math.min(100, recognitionScore),
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isAnalysisValid(profile, scores, consistency) {
        const diagnostics = [];
        if (!profile.brandName || profile.brandName === "Unnamed Brand") {
            diagnostics.push("Brand name is required for validated storage");
        }
        if (profile.brandValues.length < 1) {
            diagnostics.push("At least one brand value is required");
        }
        if (scores.aiConfidenceScore < MIN_STORE_CONFIDENCE) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below minimum ${MIN_STORE_CONFIDENCE}`);
        }
        if (consistency.overallConsistency < 60) {
            diagnostics.push(`Overall consistency ${consistency.overallConsistency} below minimum 60`);
        }
        const minDimension = 50;
        if (scores.visualIdentityScore < minDimension) {
            diagnostics.push(`Visual identity ${scores.visualIdentityScore} below minimum ${minDimension}`);
        }
        if (scores.communicationScore < minDimension) {
            diagnostics.push(`Communication score ${scores.communicationScore} below minimum ${minDimension}`);
        }
        if (consistency.inconsistencies.length >= 4) {
            diagnostics.push("Too many brand inconsistencies detected for trusted storage");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=brand-scorer.js.map