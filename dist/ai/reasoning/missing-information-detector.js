const CRITICAL_FIELDS = {
    "product-analysis": ["productName"],
    "image-analysis": ["images"],
    "video-planning": ["productName", "images"],
    "marketing-strategy": ["marketingGoal"],
    "export-decisions": ["projectId"],
    "error-recovery": [],
};
export class MissingInformationDetector {
    detect(request) {
        const missing = [];
        const required = CRITICAL_FIELDS[request.type] ?? [];
        for (const field of required) {
            if (request.inputs[field] === undefined ||
                request.inputs[field] === null ||
                request.inputs[field] === "") {
                missing.push({
                    field,
                    severity: "critical",
                    message: `Missing required field: ${field}`,
                });
            }
        }
        if (!request.userObjective.trim()) {
            missing.push({
                field: "userObjective",
                severity: "critical",
                message: "User objective is required for reasoning",
            });
        }
        if (!request.inputs.brandProfile && request.type === "branding") {
            missing.push({
                field: "brandProfile",
                severity: "important",
                message: "Brand profile recommended for branding reasoning",
            });
        }
        if (!request.inputs.targetAudience && request.type === "marketing-strategy") {
            missing.push({
                field: "targetAudience",
                severity: "important",
                message: "Target audience improves marketing strategy reasoning",
            });
        }
        return missing;
    }
}
//# sourceMappingURL=missing-information-detector.js.map