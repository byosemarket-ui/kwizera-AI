import { ProjectStatus } from "./types.js";
export class ProjectScorer {
    computeScores(project) {
        const completion = project.completionPercentage ?? 0;
        const assetCount = project.assets ? this.countAssets(project.assets) : 0;
        const workflowCount = project.workflowHistory
            ? this.countWorkflowEntries(project.workflowHistory)
            : 0;
        const completionScore = Math.min(100, completion);
        const qualityScore = Math.min(100, 40 +
            (project.description && project.description.length > 30 ? 15 : 0) +
            (project.targetAudience ? 10 : 0) +
            (project.marketingGoal ? 10 : 0) +
            (assetCount > 0 ? 15 : 0) +
            (project.brandInformation && Object.keys(project.brandInformation).length > 0 ? 10 : 0));
        const learningScore = Math.min(100, workflowCount * 8 + (project.relatedMemories?.length ?? 0) * 5);
        const recoveryScore = project.latestCheckpointId || project.status === ProjectStatus.Recovered ? 90 : 50;
        const aiConfidenceScore = Math.min(100, Math.round((qualityScore + completionScore + learningScore) / 3));
        return {
            qualityScore,
            learningScore,
            completionScore,
            recoveryScore,
            aiConfidenceScore,
        };
    }
    countAssets(assets) {
        return Object.values(assets).reduce((sum, arr) => sum + arr.length, 0);
    }
    countWorkflowEntries(history) {
        return Object.values(history).reduce((sum, arr) => sum + arr.length, 0);
    }
}
//# sourceMappingURL=project-scorer.js.map