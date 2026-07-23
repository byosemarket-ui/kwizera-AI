import { LearningCategory, LearningOutcome, LearningSource } from "../learning-memory-engine/types.js";
export class ProductLearner {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    async learnFromCompletedProject(product, patternsStored) {
        const lessons = this.extractLessons(product);
        const recommendations = this.buildRecommendations(product, lessons);
        const learningEngine = this.foundation.getLearningMemoryEngine();
        const learnResult = await learningEngine.learnFromEvent({
            source: LearningSource.Product,
            category: LearningCategory.Product,
            title: `Product experience: ${product.productName}`,
            description: this.buildDescription(product, lessons),
            relatedProject: product.projectId,
            outcome: LearningOutcome.Success,
            qualityScore: product.scores.profileScore,
            lessonLearned: lessons.join("; ") || undefined,
            patterns: product.patterns.map((p) => p.patternType),
            metadata: {
                productId: product.productId,
                category: product.category,
                brand: product.brand,
            },
        });
        this.logger.log("info", "learning", "Product learning recorded", {
            productId: product.productId,
            learningId: learnResult.learningId,
        });
        return {
            success: learnResult.success,
            productId: product.productId,
            patternsStored,
            learningId: learnResult.learningId,
            recommendations,
            lessons,
        };
    }
    extractLessons(product) {
        const lessons = [];
        if (product.visual.presentationStyle) {
            lessons.push(`Best presentation: ${product.visual.presentationStyle}`);
        }
        if (product.marketing.emotionalMarketingStyle) {
            lessons.push(`Marketing style: ${product.marketing.emotionalMarketingStyle}`);
        }
        if (product.videoRelationships.promotionalVideos.length > 0) {
            lessons.push(`Video style linked to ${product.videoRelationships.promotionalVideos.length} promo(s)`);
        }
        if (product.visual.productLayout) {
            lessons.push(`Best arrangement: ${product.visual.productLayout}`);
        }
        lessons.push(...product.lessonsLearned);
        return lessons;
    }
    buildRecommendations(product, lessons) {
        const recs = [];
        if (product.visual.presentationStyle) {
            recs.push(`Use ${product.visual.presentationStyle} presentation for similar ${product.category} products`);
        }
        if (product.marketing.bestCta.length > 0) {
            recs.push(`Apply proven CTA: "${product.marketing.bestCta[0]}"`);
        }
        if (product.patterns.length > 0) {
            recs.push(`Reuse ${product.patterns.length} product pattern(s) in future promotions`);
        }
        if (lessons.length > 0) {
            recs.push(`Apply ${lessons.length} lesson(s) from prior ${product.brand} campaigns`);
        }
        return recs;
    }
    buildDescription(product, lessons) {
        return [
            `Product "${product.productName}" (${product.category}) experience captured.`,
            `Brand: ${product.brand}, SKU: ${product.sku}.`,
            lessons.length ? `Lessons: ${lessons.join("; ")}.` : "",
        ]
            .filter(Boolean)
            .join(" ");
    }
}
//# sourceMappingURL=product-learner.js.map