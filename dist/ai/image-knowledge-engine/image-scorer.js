const MIN_STORE_CONFIDENCE = 55;
export class ImageScorer {
    computeScores(visual, metrics, product, design, brand) {
        const imageQualityScore = Math.round(metrics.sharpness * 0.25 +
            metrics.contrast * 0.15 +
            metrics.colorBalance * 0.15 +
            metrics.whiteBalance * 0.15 +
            (100 - metrics.noise) * 0.15 +
            metrics.compositionQuality * 0.15);
        const compositionScore = Math.round(metrics.compositionQuality * 0.5 + design.visualBalance * 0.3 + metrics.sharpness * 0.2);
        const productVisibilityScore = Math.round(product.visibility * 0.4 + product.focus * 0.35 + (visual.products.length > 0 ? 15 : 0));
        const brandQualityScore = Math.round(brand.brandConsistency * 0.5 +
            (brand.brandColors.length >= 2 ? 15 : 5) +
            (visual.logos.length > 0 ? 20 : 0) +
            (brand.logoPosition ? 10 : 0));
        const marketingReadinessScore = Math.round(productVisibilityScore * 0.3 +
            brandQualityScore * 0.25 +
            compositionScore * 0.25 +
            imageQualityScore * 0.2);
        const aiConfidenceScore = Math.round((imageQualityScore +
            brandQualityScore +
            compositionScore +
            productVisibilityScore +
            marketingReadinessScore) /
            5);
        return {
            imageQualityScore: Math.min(100, imageQualityScore),
            brandQualityScore: Math.min(100, brandQualityScore),
            compositionScore: Math.min(100, compositionScore),
            productVisibilityScore: Math.min(100, productVisibilityScore),
            marketingReadinessScore: Math.min(100, marketingReadinessScore),
            aiConfidenceScore: Math.min(100, aiConfidenceScore),
        };
    }
    isAnalysisValid(scores) {
        const diagnostics = [];
        if (scores.aiConfidenceScore < MIN_STORE_CONFIDENCE) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below minimum ${MIN_STORE_CONFIDENCE}`);
        }
        if (scores.imageQualityScore < 40) {
            diagnostics.push("Image quality score too low for validated storage");
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=image-scorer.js.map