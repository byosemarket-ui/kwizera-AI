export class ProductScorer {
    computeScores(product, presentationRating) {
        const hasDescription = Boolean(product.description && product.description.length > 20);
        const hasFeatures = (product.features?.length ?? 0) > 0;
        const hasSpecs = Object.keys(product.specifications ?? {}).length > 0;
        const hasVisual = (product.visual?.productImages?.length ?? 0) > 0;
        const hasMarketing = (product.marketing?.bestSellingPoints?.length ?? 0) > 0;
        const hasPrice = (product.price ?? 0) > 0;
        const profileScore = Math.min(100, 30 +
            (hasDescription ? 15 : 0) +
            (hasFeatures ? 15 : 0) +
            (hasSpecs ? 10 : 0) +
            (hasPrice ? 10 : 0) +
            (product.brand ? 10 : 0) +
            (product.category ? 10 : 0));
        const visualScore = Math.min(100, (hasVisual ? 40 : 10) +
            (product.visual?.colorPalette?.length ?? 0) * 8 +
            (product.visual?.presentationStyle ? 20 : 0) +
            (presentationRating ?? 0) * 0.3);
        const marketingScore = Math.min(100, (hasMarketing ? 40 : 15) +
            (product.marketing?.bestHeadlines?.length ?? 0) * 10 +
            (product.marketing?.bestCta?.length ?? 0) * 10);
        const learningScore = Math.min(100, (product.lessonsLearned?.length ?? 0) * 15 + (product.patterns?.length ?? 0) * 10);
        const aiConfidenceScore = Math.round((profileScore + visualScore + marketingScore + learningScore) / 4);
        return { profileScore, visualScore, marketingScore, learningScore, aiConfidenceScore };
    }
}
//# sourceMappingURL=product-scorer.js.map