import crypto from "node:crypto";
const MIN_CONFIDENCE = 55;
export class ProductPatternDetector {
    patternStore;
    constructor(patternStore) {
        this.patternStore = patternStore;
    }
    detect(product) {
        const detected = [];
        const now = new Date().toISOString();
        const id = product.productId;
        if (product.visual.productLayout) {
            detected.push(this.create("product-layout", `Layout: ${product.visual.productLayout}`, id, 74, now));
        }
        if (product.visual.productImages.length > 0) {
            detected.push(this.create("product-image", `${product.visual.productImages.length} image(s), style: ${product.visual.presentationStyle}`, id, 72, now));
        }
        if (product.videoRelationships.promotionalVideos.length > 0) {
            detected.push(this.create("product-video", `${product.videoRelationships.promotionalVideos.length} promotional video(s) linked`, id, 76, now));
        }
        if (product.marketing.bestHeadlines.length > 0 && product.marketing.bestCta.length > 0) {
            detected.push(this.create("marketing-structure", `Marketing: ${product.marketing.bestHeadlines[0]?.slice(0, 40)} → ${product.marketing.bestCta[0]}`, id, 78, now));
        }
        if (product.marketing.bestSellingPoints.length > 0) {
            detected.push(this.create("sales-message", `Selling points: ${product.marketing.bestSellingPoints.join(", ").slice(0, 60)}`, id, 75, now));
        }
        if (product.visual.presentationStyle || product.brand) {
            detected.push(this.create("branding-style", `Branding: ${product.brand} / ${product.visual.presentationStyle}`, id, 70, now));
        }
        const qualified = detected.filter((p) => p.confidence >= MIN_CONFIDENCE);
        for (const pattern of qualified) {
            this.patternStore.store(pattern);
        }
        return qualified;
    }
    create(type, description, sourceProductId, confidence, detectedAt) {
        return {
            patternId: `ppat-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
            patternType: type,
            description,
            sourceProductId,
            confidence,
            reusable: confidence >= 60,
            detectedAt,
        };
    }
}
//# sourceMappingURL=product-pattern-detector.js.map