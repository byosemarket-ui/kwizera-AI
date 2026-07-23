export class ProductionVideoScorer {
    computeScores(dependencies, assets, enhancementReadiness, creativeScore) {
        const dependencyScore = Math.round((dependencies.passedCount / Math.max(dependencies.totalRequired, 1)) * 100);
        const assetGroups = [
            assets.sourceVideos,
            assets.audio,
            assets.logos,
            assets.fonts,
            assets.templates,
            assets.brandAssets,
            assets.captions,
            assets.subtitles,
        ];
        const assetItems = assetGroups.flat();
        const readyAssets = assetItems.filter((a) => a.status === "ready" || a.status === "planned").length;
        const assetReadinessScore = Math.round((readyAssets / Math.max(assetItems.length, 1)) * 100);
        const workflowScore = Math.round((dependencyScore + assetReadinessScore + enhancementReadiness) / 3);
        const productionReadinessScore = Math.round((dependencyScore + assetReadinessScore + workflowScore + creativeScore) / 4);
        const performanceScore = dependencies.allRequiredPassed ? 95 : Math.max(40, dependencyScore - 10);
        const aiConfidenceScore = Math.round((productionReadinessScore +
            assetReadinessScore +
            workflowScore +
            dependencyScore +
            performanceScore) /
            5);
        return {
            productionReadinessScore,
            assetReadinessScore,
            workflowScore,
            dependencyScore,
            performanceScore,
            aiConfidenceScore,
        };
    }
    isPlanValid(dependencies, scores, assets) {
        const diagnostics = [];
        if (!dependencies.allRequiredPassed) {
            const failed = dependencies.checks.filter((c) => c.required && c.status !== "passed");
            diagnostics.push(`Required dependencies not validated: ${failed.map((f) => f.moduleName).join(", ")}`);
        }
        if (assets.sourceVideos.some((a) => a.status === "missing")) {
            diagnostics.push("Source video asset missing — production blocked");
        }
        if (scores.dependencyScore < 100) {
            diagnostics.push(`Dependency score ${scores.dependencyScore}% — all dependencies must pass`);
        }
        if (scores.productionReadinessScore < 55) {
            diagnostics.push(`Production readiness ${scores.productionReadinessScore} below threshold (55)`);
        }
        if (scores.aiConfidenceScore < 55) {
            diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
        }
        return { valid: diagnostics.length === 0, diagnostics };
    }
}
//# sourceMappingURL=production-video-scorer.js.map