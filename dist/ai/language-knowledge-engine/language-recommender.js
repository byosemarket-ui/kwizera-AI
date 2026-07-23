import { LanguageScriptType, LanguageWritingStyle, } from "./types.js";
export class LanguageRecommender {
    recommend(record) {
        const recs = [];
        for (const issue of record.grammar.issues) {
            recs.push({
                category: "grammar",
                suggestion: `Fix: ${issue}`,
                priority: "high",
                reason: issue,
            });
        }
        if (record.scores.grammarScore < 75) {
            recs.push({
                category: "grammar",
                suggestion: "Review sentence structure, punctuation and vocabulary clarity",
                priority: "high",
                reason: `Grammar score ${record.scores.grammarScore}`,
            });
        }
        if (record.scores.readabilityScore < 75) {
            recs.push({
                category: "readability",
                suggestion: "Shorten sentences and use simpler vocabulary for target audience",
                priority: "medium",
                reason: `Readability ${record.scores.readabilityScore}`,
            });
        }
        if (record.marketing.callToActions.length < 1) {
            recs.push({
                category: "cta",
                suggestion: "Add clear, action-oriented call-to-action in local language",
                priority: "high",
                reason: "No CTA detected in marketing language",
            });
        }
        if (record.marketing.headlines.length < 2) {
            recs.push({
                category: "headlines",
                suggestion: "Create multiple headline variants for A/B testing",
                priority: "medium",
                reason: "Limited headline variety",
            });
        }
        if (record.scores.marketingScore < 78) {
            recs.push({
                category: "marketing-style",
                suggestion: "Strengthen hooks, headlines and promotional script structure",
                priority: "medium",
                reason: `Marketing score ${record.scores.marketingScore}`,
            });
        }
        if (record.writingStyle === LanguageWritingStyle.Storytelling && record.scores.readabilityScore < 80) {
            recs.push({
                category: "storytelling",
                suggestion: "Improve narrative flow: hook → tension → resolution → CTA",
                priority: "medium",
                reason: "Storytelling style needs clearer structure",
            });
        }
        if (record.scores.translationReadinessScore < 75) {
            recs.push({
                category: "localization",
                suggestion: "Simplify idioms and add cultural notes for translation teams",
                priority: "medium",
                reason: `Translation readiness ${record.scores.translationReadinessScore}`,
            });
        }
        if (record.scriptType === LanguageScriptType.Subtitle ||
            record.scriptType === LanguageScriptType.Caption) {
            if (record.scores.subtitleQualityScore < 80) {
                recs.push({
                    category: "subtitles",
                    suggestion: "Limit on-screen text to 42 characters, sync to narration beats",
                    priority: "high",
                    reason: `Subtitle quality ${record.scores.subtitleQualityScore}`,
                });
            }
        }
        if (record.subtitles.subtitleText.some((s) => s.length > 42)) {
            recs.push({
                category: "subtitles",
                suggestion: "Split long subtitle lines for better on-screen readability",
                priority: "high",
                reason: "Subtitle lines exceed recommended length",
            });
        }
        return recs.sort((a, b) => {
            const p = { high: 3, medium: 2, low: 1 };
            return p[b.priority] - p[a.priority];
        });
    }
}
export class LanguageRelationshipLinker {
    detectSimilar(record, allRecords) {
        const relationships = {
            relatedLanguages: [],
            relatedMarketingStyles: [],
            relatedProducts: [],
            relatedBrands: [],
            relatedCampaigns: [],
            relatedScripts: [],
            relatedVideos: [],
            relatedSubtitles: [],
        };
        for (const other of allRecords) {
            if (other.languageId === record.languageId)
                continue;
            const sameLanguage = record.language === other.language;
            const score = this.similarityScore(record, other);
            if (score < 30 && !sameLanguage)
                continue;
            if (record.language === other.language) {
                relationships.relatedLanguages.push(other.languageId);
            }
            if (record.localization.relatedLanguages.includes(other.language)) {
                relationships.relatedLanguages.push(other.languageId);
            }
            if (record.writingStyle === other.writingStyle) {
                relationships.relatedMarketingStyles.push(other.languageId);
            }
            if (record.brandName && record.brandName === other.brandName) {
                relationships.relatedBrands.push(other.languageId);
            }
            if (record.productName && record.productName === other.productName) {
                relationships.relatedProducts.push(other.languageId);
            }
            if (record.marketingGoal === other.marketingGoal) {
                relationships.relatedCampaigns.push(other.languageId);
            }
            if (record.scriptType === other.scriptType) {
                relationships.relatedScripts.push(other.languageId);
            }
            const sharedTags = record.tags.filter((t) => other.tags.includes(t));
            if (sharedTags.some((t) => t.includes("video"))) {
                relationships.relatedVideos.push(other.languageId);
            }
            if (sharedTags.some((t) => t.includes("subtitle")) ||
                record.scriptType === LanguageScriptType.Subtitle) {
                relationships.relatedSubtitles.push(other.languageId);
            }
        }
        return relationships;
    }
    similarityScore(a, b) {
        let score = 0;
        if (a.language === b.language)
            score += 35;
        if (a.writingStyle === b.writingStyle)
            score += 20;
        if (a.brandName === b.brandName && a.brandName)
            score += 20;
        if (a.productName === b.productName && a.productName)
            score += 15;
        if (a.scriptType === b.scriptType)
            score += 10;
        const sharedTags = a.tags.filter((t) => b.tags.includes(t));
        score += sharedTags.length * 6;
        return score;
    }
}
//# sourceMappingURL=language-recommender.js.map