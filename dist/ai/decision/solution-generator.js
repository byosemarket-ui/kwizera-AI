const WORKFLOW_MAP = {
    "product-analysis": "workflow-product-analysis",
    "image-analysis": "workflow-image-analysis",
    "video-generation": "workflow-video-production",
    marketing: "workflow-marketing-campaign",
    translation: "workflow-translation",
    memory: "workflow-memory-update",
    learning: "workflow-learning",
    export: "workflow-export",
    recovery: "workflow-recovery",
    general: "workflow-general",
};
const MODULE_MAP = {
    "product-analysis": ["product-engine"],
    "image-analysis": ["image-engine"],
    "video-generation": ["video-engine", "product-engine"],
    marketing: ["marketing-engine", "product-engine"],
    translation: ["translation-engine"],
    memory: ["memory-engine"],
    learning: ["learning-engine"],
    export: ["video-engine", "marketing-engine"],
    recovery: ["decision-engine"],
    general: ["decision-engine"],
};
export class SolutionGenerator {
    generate(request, count = 3) {
        const workflowId = WORKFLOW_MAP[request.type] ?? "workflow-general";
        const modules = request.requiredModules ??
            MODULE_MAP[request.type] ??
            ["decision-engine"];
        const solutions = [
            {
                id: "sol-primary",
                label: "Primary recommended workflow",
                workflowId,
                requiredModules: modules,
                description: `Execute ${workflowId} using optimal module set`,
                estimatedQuality: 85,
            },
            {
                id: "sol-conservative",
                label: "Conservative validation-first workflow",
                workflowId: `${workflowId}-validated`,
                requiredModules: [...modules, "decision-engine"],
                description: "Extra validation gates before execution",
                estimatedQuality: 80,
            },
            {
                id: "sol-minimal",
                label: "Minimal scope workflow",
                workflowId: `${workflowId}-minimal`,
                requiredModules: modules.slice(0, 1),
                description: "Reduced scope for faster iteration",
                estimatedQuality: 70,
            },
        ];
        return solutions.slice(0, Math.max(2, Math.min(count, solutions.length)));
    }
}
//# sourceMappingURL=solution-generator.js.map