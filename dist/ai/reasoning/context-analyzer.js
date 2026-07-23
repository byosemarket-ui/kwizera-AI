export class ContextAnalyzer {
    analyze(request, core) {
        const inputs = request.inputs;
        const resources = [];
        if (inputs.images)
            resources.push("images");
        if (inputs.videos)
            resources.push("videos");
        if (inputs.brandProfile)
            resources.push("brand-profile");
        if (inputs.productName)
            resources.push("product-data");
        if (inputs.projectId)
            resources.push("project");
        const health = core?.controller.getHealthReport();
        const systemHealthy = health?.healthy ?? false;
        const factors = [
            `objective:${request.userObjective.slice(0, 80)}`,
            `type:${request.type}`,
            `resources:${resources.join(",") || "minimal"}`,
            `system:${systemHealthy ? "healthy" : "degraded"}`,
        ];
        let completeness = 30;
        if (request.userObjective.trim())
            completeness += 20;
        if (resources.length > 0)
            completeness += 20;
        if (inputs.brandProfile)
            completeness += 10;
        if (inputs.targetAudience)
            completeness += 10;
        if (inputs.marketingGoal)
            completeness += 10;
        return {
            userObjective: request.userObjective,
            productType: inputs.productType,
            productQuality: inputs.productQuality,
            brandIdentity: inputs.brandProfile
                ? String(inputs.brandProfile.name ?? "defined")
                : undefined,
            availableResources: resources,
            previousProjects: Boolean(inputs.previousProjects),
            previousLearning: Boolean(inputs.previousLearning),
            marketingGoal: inputs.marketingGoal,
            targetAudience: inputs.targetAudience,
            systemHealthy,
            completenessScore: Math.min(100, completeness),
            factors,
        };
    }
}
//# sourceMappingURL=context-analyzer.js.map