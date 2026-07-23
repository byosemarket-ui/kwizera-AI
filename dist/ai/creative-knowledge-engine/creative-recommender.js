export class CreativeRecommender {
    recommend(record) {
        const recs = [];
        if (record.visual.balance < 75) {
            recs.push({
                category: "composition",
                suggestion: "Improve visual balance with symmetric or rule-of-thirds layout",
                priority: "medium",
                reason: `Balance score ${record.visual.balance}`,
            });
        }
        if (record.visual.whiteSpace < 70) {
            recs.push({
                category: "layout",
                suggestion: "Increase white space for cleaner, more premium presentation",
                priority: "medium",
                reason: `White space ${record.visual.whiteSpace}`,
            });
        }
        if (record.visual.contrast < 75) {
            recs.push({
                category: "visual-style",
                suggestion: "Strengthen contrast between foreground and background elements",
                priority: "high",
                reason: `Contrast ${record.visual.contrast}`,
            });
        }
        if (!record.visual.typography || record.visual.typography.length < 5) {
            recs.push({
                category: "typography",
                suggestion: "Define heading and body typefaces with clear hierarchy",
                priority: "medium",
                reason: "Typography system undefined",
            });
        }
        if (record.animation.animationQuality < 78) {
            recs.push({
                category: "motion",
                suggestion: "Refine easing curves and beat-synced timing for smoother motion",
                priority: "high",
                reason: `Animation quality ${record.animation.animationQuality}`,
            });
        }
        if (record.storytelling.attentionRetention < 80) {
            recs.push({
                category: "storytelling",
                suggestion: "Strengthen hook and scene pacing to retain attention",
                priority: "high",
                reason: `Attention retention ${record.storytelling.attentionRetention}`,
            });
        }
        if (record.scores.brandConsistencyScore < 78) {
            recs.push({
                category: "branding",
                suggestion: "Align colors, typography and motion with brand guidelines",
                priority: "medium",
                reason: `Brand consistency ${record.scores.brandConsistencyScore}`,
            });
        }
        if (record.cinematic.visualContinuity < 80) {
            recs.push({
                category: "creative-direction",
                suggestion: "Maintain consistent lighting, grading and transitions across scenes",
                priority: "medium",
                reason: `Visual continuity ${record.cinematic.visualContinuity}`,
            });
        }
        if (record.colorPalette.length < 3) {
            recs.push({
                category: "visual-style",
                suggestion: "Expand color palette to primary, secondary and accent colors",
                priority: "low",
                reason: "Limited color palette",
            });
        }
        return recs.sort((a, b) => {
            const p = { high: 3, medium: 2, low: 1 };
            return p[b.priority] - p[a.priority];
        });
    }
}
export class CreativeRelationshipLinker {
    detectSimilar(record, allRecords) {
        const relationships = {
            creativeStyles: [],
            relatedProducts: [],
            relatedBrands: [],
            relatedVideos: [],
            relatedImages: [],
            relatedCampaigns: [],
            relatedMarketingStrategies: [],
            relatedTemplates: [],
            relatedWorkflows: [],
        };
        for (const other of allRecords) {
            if (other.creativeId === record.creativeId)
                continue;
            const sameBrand = record.brandName === other.brandName && record.brandName !== "unknown";
            const score = this.similarityScore(record, other);
            if (score < 35 && !sameBrand)
                continue;
            if (record.creativeStyle === other.creativeStyle) {
                relationships.creativeStyles.push(other.creativeId);
            }
            if (sameBrand) {
                relationships.relatedBrands.push(other.creativeId);
            }
            if (record.productName && record.productName === other.productName) {
                relationships.relatedProducts.push(other.creativeId);
            }
            if (record.domain === other.domain) {
                relationships.relatedTemplates.push(other.creativeId);
            }
            if (record.marketingGoal === other.marketingGoal) {
                relationships.relatedCampaigns.push(other.creativeId);
                relationships.relatedMarketingStrategies.push(other.creativeId);
            }
            if (record.platform === other.platform) {
                relationships.relatedWorkflows.push(other.creativeId);
            }
            const sharedTags = record.tags.filter((t) => other.tags.includes(t));
            if (sharedTags.some((t) => t.includes("video"))) {
                relationships.relatedVideos.push(other.creativeId);
            }
            if (sharedTags.some((t) => t.includes("image"))) {
                relationships.relatedImages.push(other.creativeId);
            }
        }
        return relationships;
    }
    similarityScore(a, b) {
        let score = 0;
        if (a.brandName === b.brandName && a.brandName)
            score += 30;
        if (a.creativeStyle === b.creativeStyle)
            score += 25;
        if (a.domain === b.domain)
            score += 20;
        if (a.platform === b.platform)
            score += 10;
        if (a.productName === b.productName && a.productName)
            score += 15;
        const sharedColors = a.colorPalette.filter((c) => b.colorPalette.includes(c));
        score += sharedColors.length * 8;
        const sharedTags = a.tags.filter((t) => b.tags.includes(t));
        score += sharedTags.length * 6;
        return score;
    }
}
//# sourceMappingURL=creative-recommender.js.map