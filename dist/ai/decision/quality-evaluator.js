const CRITICAL_FIELDS = {
    "product-analysis": ["productName"],
    "image-analysis": ["images"],
    "video-generation": ["productName", "objective"],
    marketing: ["objective"],
    export: ["projectId"],
};
export class QualityEvaluator {
    evaluate(request, availableData) {
        const checks = [];
        const recommendations = [];
        checks.push({
            name: "data-quality",
            passed: Object.keys(availableData).length > 0 || request.userRequest.length > 0,
            message: Object.keys(availableData).length > 0
                ? "Data payload present"
                : "Minimal data — relying on user request text",
        });
        checks.push({
            name: "project-completeness",
            passed: this.hasRequiredFields(request.type, availableData),
            message: "Required fields for decision type",
        });
        if (!checks.find((c) => c.name === "project-completeness")?.passed) {
            recommendations.push("Provide required project fields before execution.");
        }
        checks.push({
            name: "brand-consistency",
            passed: Boolean(availableData.brandProfile || availableData.brandColors),
            message: availableData.brandProfile
                ? "Brand profile available"
                : "Brand profile not supplied — defaults may apply",
        });
        if (!availableData.brandProfile) {
            recommendations.push("Upload brand profile for brand-consistent output.");
        }
        checks.push({
            name: "image-quality",
            passed: !this.requiresImages(request.type) || Boolean(availableData.images),
            message: "Image resources check",
        });
        if (this.requiresImages(request.type) && !availableData.images) {
            recommendations.push("Upload product images before image or video analysis.");
        }
        checks.push({
            name: "video-quality",
            passed: request.type !== "video-generation" ||
                Boolean(availableData.images || availableData.videos),
            message: "Video source assets check",
        });
        checks.push({
            name: "required-resources",
            passed: this.hasRequiredResources(request),
            message: "Module resource requirements",
        });
        checks.push({
            name: "expected-output",
            passed: Boolean(request.statedObjective || availableData.objective || request.userRequest),
            message: "Output objective defined",
        });
        const passedCount = checks.filter((c) => c.passed).length;
        const score = Math.round((passedCount / checks.length) * 100);
        const criticalFailed = checks.some((c) => !c.passed &&
            (c.name === "project-completeness" || c.name === "required-resources"));
        return {
            sufficient: !criticalFailed && score >= 60,
            score,
            checks,
            recommendations,
        };
    }
    detectMissingInformation(request, availableData) {
        const missing = [];
        const required = CRITICAL_FIELDS[request.type] ?? [];
        for (const field of required) {
            if (availableData[field] === undefined || availableData[field] === null) {
                missing.push({
                    field,
                    severity: "critical",
                    message: `Missing required field: ${field}`,
                });
            }
        }
        if (!request.statedObjective && !availableData.objective) {
            missing.push({
                field: "objective",
                severity: "important",
                message: "User objective not explicitly stated",
            });
        }
        return missing;
    }
    hasRequiredFields(type, data) {
        const required = CRITICAL_FIELDS[type];
        if (!required || required.length === 0) {
            return true;
        }
        return required.every((f) => data[f] !== undefined && data[f] !== null && data[f] !== "");
    }
    requiresImages(type) {
        return type === "image-analysis" || type === "video-generation";
    }
    hasRequiredResources(request) {
        if (request.requiredModules && request.requiredModules.length > 0) {
            return true;
        }
        return request.userRequest.trim().length > 0;
    }
}
//# sourceMappingURL=quality-evaluator.js.map