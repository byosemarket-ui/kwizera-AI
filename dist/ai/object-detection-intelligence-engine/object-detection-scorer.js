import { DetectedObjectType, } from "./types.js";
export class ObjectDetectionScorer {
    computeScores(objects, product, text, logo) {
        let objectDetectionScore = 50;
        objectDetectionScore += Math.min(30, objects.length * 5);
        const avgConfidence = objects.length > 0
            ? objects.reduce((s, o) => s + o.confidenceScore, 0) / objects.length
            : 0;
        objectDetectionScore += Math.round(avgConfidence * 0.2);
        objectDetectionScore = Math.min(100, objectDetectionScore);
        const productVisibilityScore = product.mainProduct
            ? Math.min(100, product.productVisibility)
            : Math.max(30, 100 - objects.filter((o) => o.objectType === DetectedObjectType.Product).length * 10);
        const hasStructure = objects.some((o) => o.objectType === DetectedObjectType.Product) ||
            objects.some((o) => o.objectType === DetectedObjectType.BackgroundObject);
        const sceneOrganizationScore = hasStructure
            ? Math.min(100, 60 + objects.length * 4)
            : 40;
        const brandVisibilityScore = logo.logoPresent
            ? Math.min(100, logo.logoVisibility)
            : 35;
        let creativeReadinessScore = 55;
        if (product.mainProduct)
            creativeReadinessScore += 15;
        if (logo.logoPresent)
            creativeReadinessScore += 10;
        if (text.textPresent)
            creativeReadinessScore += 10;
        if (objects.length >= 3)
            creativeReadinessScore += 10;
        creativeReadinessScore = Math.min(100, creativeReadinessScore);
        const aiConfidenceScore = Math.round((objectDetectionScore + productVisibilityScore + sceneOrganizationScore + brandVisibilityScore + creativeReadinessScore) / 5);
        return {
            objectDetectionScore,
            productVisibilityScore,
            sceneOrganizationScore,
            brandVisibilityScore,
            creativeReadinessScore,
            aiConfidenceScore,
        };
    }
    isDetectionValid(scores, objects) {
        const diagnostics = [];
        if (objects.length === 0) {
            diagnostics.push("No objects detected — detection structure empty");
        }
        if (scores.objectDetectionScore < 50) {
            diagnostics.push(`Object detection score ${scores.objectDetectionScore} below threshold (50)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=object-detection-scorer.js.map