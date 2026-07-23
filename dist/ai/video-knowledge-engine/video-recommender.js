export class VideoRecommender {
    recommend(record) {
        const recs = [];
        const hookScene = record.structure.sceneSequence.find((s) => s.scenePurpose === "hook");
        if (!hookScene || hookScene.sceneDuration > 5) {
            recs.push({
                category: "storytelling",
                suggestion: "Shorten hook scene to under 5 seconds for stronger attention capture",
                priority: "high",
                reason: "Hook timing exceeds optimal promotional window",
            });
        }
        if (record.marketing.hookTiming > 5) {
            recs.push({
                category: "structure",
                suggestion: "Move product introduction earlier in the video timeline",
                priority: "medium",
                reason: `Hook at ${record.marketing.hookTiming}s delays product reveal`,
            });
        }
        if (record.editing.motionConsistency < 75) {
            recs.push({
                category: "transitions",
                suggestion: "Standardize transition timing to match audio beat markers",
                priority: "high",
                reason: `Motion consistency ${record.editing.motionConsistency} below target`,
            });
        }
        if (record.audio.beatSynchronization < 75) {
            recs.push({
                category: "audio",
                suggestion: "Sync scene cuts and transitions to music beat drops",
                priority: "high",
                reason: `Beat sync ${record.audio.beatSynchronization} needs improvement`,
            });
        }
        const hasCta = record.structure.sceneSequence.some((s) => s.ctaPlacement !== "none");
        if (!hasCta) {
            recs.push({
                category: "cta",
                suggestion: "Add clear call-to-action in final scene with centered placement",
                priority: "high",
                reason: "No CTA placement detected in scene sequence",
            });
        }
        if (record.visual.brandingConsistency < 78) {
            recs.push({
                category: "branding",
                suggestion: "Align intro/outro logo animation with brand color palette",
                priority: "medium",
                reason: `Brand consistency ${record.visual.brandingConsistency} below target`,
            });
        }
        const productScenes = record.structure.sceneSequence.filter((s) => s.productVisibility >= 80);
        if (productScenes.length < 1) {
            recs.push({
                category: "scene-order",
                suggestion: "Add dedicated product showcase scene with orbit camera movement",
                priority: "high",
                reason: "Insufficient product visibility across scenes",
            });
        }
        if (record.scores.storytellingScore < 70) {
            recs.push({
                category: "storytelling",
                suggestion: "Restructure story flow: hook → product hero → benefits → CTA",
                priority: "medium",
                reason: `Storytelling score ${record.scores.storytellingScore}`,
            });
        }
        return recs.sort((a, b) => {
            const p = { high: 3, medium: 2, low: 1 };
            return p[b.priority] - p[a.priority];
        });
    }
}
export class VideoRelationshipLinker {
    detectSimilar(record, allRecords) {
        const relationships = {
            similarVideos: [],
            similarProducts: [],
            similarCampaigns: [],
            similarStyles: [],
            similarEditing: [],
            similarMusic: [],
            similarStorytelling: [],
        };
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            const sameBrand = record.brandName === other.brandName && record.brandName !== "unknown";
            const score = this.similarityScore(record, other);
            if (score < 35 && !sameBrand)
                continue;
            relationships.similarVideos.push(other.videoId);
            if (record.productName && record.productName === other.productName) {
                relationships.similarProducts.push(other.videoId);
            }
            if (record.tags.some((t) => other.tags.includes(t) && t.includes("campaign"))) {
                relationships.similarCampaigns.push(other.videoId);
            }
            if (record.editing.editingStyle === other.editing.editingStyle) {
                relationships.similarEditing.push(other.videoId);
                relationships.similarStyles.push(other.videoId);
            }
            if (record.audio.backgroundMusic === other.audio.backgroundMusic) {
                relationships.similarMusic.push(other.videoId);
            }
            if (record.structure.storyFlow === other.structure.storyFlow) {
                relationships.similarStorytelling.push(other.videoId);
            }
        }
        return relationships;
    }
    similarityScore(a, b) {
        let score = 0;
        if (a.brandName === b.brandName && a.brandName !== "unknown")
            score += 35;
        if (a.productName === b.productName && a.productName)
            score += 25;
        if (a.editing.editingStyle === b.editing.editingStyle)
            score += 20;
        if (a.structure.storyFlow === b.structure.storyFlow)
            score += 15;
        if (a.audio.backgroundMusic === b.audio.backgroundMusic)
            score += 15;
        const sharedTags = a.tags.filter((t) => b.tags.includes(t));
        score += sharedTags.length * 8;
        return score;
    }
}
//# sourceMappingURL=video-recommender.js.map