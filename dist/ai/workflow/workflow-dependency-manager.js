export class WorkflowDependencyManager {
    verify(plan, core) {
        const checks = [];
        for (const moduleId of plan.requiredResources.modules) {
            const entry = core?.registry.getEntry(moduleId);
            checks.push({
                name: `module-${moduleId}`,
                passed: entry !== undefined,
                message: entry ? `Module slot ${moduleId} available` : `Module ${moduleId} not registered`,
            });
        }
        checks.push({
            name: "storage",
            passed: plan.requiredResources.storageBytes > 0,
            message: "Storage requirement defined",
        });
        checks.push({
            name: "memory",
            passed: plan.requiredResources.memoryMb > 0,
            message: "Memory requirement defined",
        });
        checks.push({
            name: "configuration",
            passed: core?.configuration.isLoaded() ?? false,
            message: "Configuration loaded",
        });
        checks.push({
            name: "system-health",
            passed: core?.controller.getHealthReport().healthy ?? false,
            message: "System health check",
        });
        const failed = checks.find((c) => !c.passed);
        return {
            passed: !failed,
            checks,
            missingDependency: failed?.name,
        };
    }
}
//# sourceMappingURL=workflow-dependency-manager.js.map