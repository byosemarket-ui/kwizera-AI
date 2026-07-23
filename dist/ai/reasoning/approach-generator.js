const WORKFLOW_BY_TYPE = {
    "product-analysis": "workflow-product-analysis",
    "image-analysis": "workflow-image-analysis",
    "video-planning": "workflow-video-production",
    "marketing-strategy": "workflow-marketing-campaign",
    translation: "workflow-translation",
    branding: "workflow-branding",
    "workflow-planning": "workflow-general",
    "export-decisions": "workflow-export",
    "error-recovery": "workflow-recovery",
    learning: "workflow-learning",
};
export class ApproachGenerator {
    generate(request) {
        const workflow = WORKFLOW_BY_TYPE[request.type] ?? "workflow-general";
        return [
            {
                id: "approach-optimal",
                label: "Optimal balanced approach",
                description: `Execute ${workflow} with full context and validation`,
                advantages: ["Best quality potential", "Aligns with stated objective", "Traceable workflow"],
                disadvantages: ["Requires complete inputs", "Higher resource use"],
                estimatedRisk: 25,
                suggestedWorkflow: workflow,
            },
            {
                id: "approach-incremental",
                label: "Incremental validation approach",
                description: "Validate inputs in stages before full execution",
                advantages: ["Lower risk", "Early feedback", "Recoverable checkpoints"],
                disadvantages: ["Slower initial progress", "More steps"],
                estimatedRisk: 15,
                suggestedWorkflow: `${workflow}-validated`,
            },
            {
                id: "approach-minimal",
                label: "Minimal scope approach",
                description: "Reduced scope for faster iteration",
                advantages: ["Fast feedback", "Low resource cost"],
                disadvantages: ["May miss quality targets", "Limited output scope"],
                estimatedRisk: 40,
                suggestedWorkflow: `${workflow}-minimal`,
            },
        ];
    }
}
//# sourceMappingURL=approach-generator.js.map