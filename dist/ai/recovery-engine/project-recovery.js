export class ProjectRecovery {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    buildRecoveryContext(projectId, metadata) {
        const context = {
            projectId,
            assets: {
                images: metadata?.images ?? [],
                videos: metadata?.videos ?? [],
                productInfo: Boolean(metadata?.productInfo),
                brandAssets: Boolean(metadata?.brandAssets),
                generatedContent: Boolean(metadata?.generatedContent),
                workflowProgress: Boolean(metadata?.workflowProgress),
                drafts: Boolean(metadata?.drafts),
                userSettings: Boolean(metadata?.userSettings),
            },
        };
        this.logger.log("info", "recovery-attempt", `Project recovery context built: ${projectId}`, {
            assets: context.assets,
        });
        return context;
    }
    restoreFromState(projects) {
        const contexts = [];
        for (const [id, project] of Object.entries(projects)) {
            if (project.state === "modified" ||
                project.state === "open" ||
                project.state === "saving" ||
                project.state === "exporting") {
                contexts.push(this.buildRecoveryContext(id, project.metadata));
            }
        }
        return contexts;
    }
}
//# sourceMappingURL=project-recovery.js.map