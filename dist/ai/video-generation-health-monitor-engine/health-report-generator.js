import fs from "node:fs";
import path from "node:path";
export class VideoGenerationHealthReportGenerator {
    projectStateDir;
    constructor(projectStateDir) {
        this.projectStateDir = projectStateDir;
    }
    generateAll(status, check, history, modules) {
        fs.mkdirSync(this.projectStateDir, { recursive: true });
        const healthReportPath = path.join(this.projectStateDir, "AI-Video-Generation-Health-Report.md");
        const historyReportPath = path.join(this.projectStateDir, "AI-Video-Generation-Health-History.md");
        const performanceReportPath = path.join(this.projectStateDir, "AI-Video-Generation-Performance-Report.md");
        const recommendationsReportPath = path.join(this.projectStateDir, "AI-Video-Generation-Recommendations.md");
        fs.writeFileSync(healthReportPath, this.buildHealthReport(status, check, modules), "utf8");
        fs.writeFileSync(historyReportPath, this.buildHistoryReport(history), "utf8");
        fs.writeFileSync(performanceReportPath, this.buildPerformanceReport(check, status), "utf8");
        fs.writeFileSync(recommendationsReportPath, this.buildRecommendationsReport(status, check), "utf8");
        return { healthReportPath, historyReportPath, performanceReportPath, recommendationsReportPath };
    }
    buildHealthReport(status, check, modules) {
        return [
            "# AI Video Generation Health Report — Step 8N",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            `**Engine Status:** ${status.engineStatus}`,
            `**Overall Video Generation Health:** ${status.overallVideoGenerationHealth}`,
            `**Readiness Score:** ${status.readinessScore}/100`,
            "",
            "## Module Health Scores",
            "",
            "| Module | Score | Level | Available |",
            "|--------|-------|-------|-----------|",
            ...modules.map((m) => `| ${m.module} | ${m.score} | ${m.level} | ${m.available ? "yes" : "no"} |`),
            "",
            "## Storyboard Health",
            "",
            `- ${status.storyboardHealth}`,
            "",
            "## Production Health",
            "",
            `- ${status.productionHealth}`,
            "",
            "## Render Readiness",
            "",
            `- ${status.renderReadinessHealth}`,
            "",
            "## Last Check",
            "",
            check
                ? `- Score: ${check.overallScore}/100 (${check.overallLevel})\n- Warnings: ${check.warnings.length}\n- Errors: ${check.errors.length}\n- Storyboard Integrity: ${check.storyboardIntegrity ? "✅" : "❌"}\n- Scene Integrity: ${check.sceneIntegrity ? "✅" : "❌"}\n- Timeline Integrity: ${check.timelineIntegrity ? "✅" : "❌"}\n- Production Integrity: ${check.productionIntegrity ? "✅" : "❌"}\n- Render Preparation: ${check.renderPreparationIntegrity ? "✅" : "❌"}\n- Validation Integrity: ${check.validationIntegrity ? "✅" : "❌"}`
                : "- No check data",
            "",
            "## Known Issues",
            "",
            ...(status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`) : ["- None"]),
            "",
        ].join("\n");
    }
    buildHistoryReport(history) {
        return [
            "# AI Video Generation Health History — Step 8N",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            `**Total Records:** ${history.length}`,
            "",
            "| Check ID | Timestamp | Score | Level | Warnings | Repairs |",
            "|----------|-----------|-------|-------|----------|---------|",
            ...history
                .slice(-50)
                .map((h) => `| ${h.checkId} | ${h.timestamp} | ${h.healthScore} | ${h.level} | ${h.warnings.length} | ${h.repairs.length} |`),
            "",
        ].join("\n");
    }
    buildPerformanceReport(check, status) {
        return [
            "# AI Video Generation Performance Report — Step 8N",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            "",
            "| Metric | Value |",
            "|--------|-------|",
            `| Average Check | ${status.performance.averageCheckMs}ms |`,
            `| Last Check | ${status.performance.lastCheckMs}ms |`,
            `| Disk Usage | ${status.performance.averageDiskMb}MB |`,
            check
                ? `| Search | ${check.performance.searchPerformanceMs}ms |\n| Planning | ${check.performance.planningPerformanceMs}ms |\n| Validation | ${check.performance.validationPerformanceMs}ms |\n| Optimization | ${check.performance.optimizationPerformanceMs}ms |\n| Memory | ${check.performance.memoryUsageMb}MB |\n| GPU | ${check.performance.gpuUsagePercent}% |`
                : "",
            "",
            "## Trend",
            "",
            `- Direction: ${status.trendAnalysis.direction}`,
            `- Prediction: ${status.trendAnalysis.prediction}`,
            "",
        ].join("\n");
    }
    buildRecommendationsReport(status, check) {
        const recs = [...status.recommendations, ...(check?.recommendations ?? [])];
        const unique = [...new Set(recs)];
        return [
            "# AI Video Generation Recommendations — Step 8N",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            "",
            ...(unique.length > 0
                ? unique.map((r) => `- ${r}`)
                : ["- No recommendations — video generation system healthy"]),
            "",
        ].join("\n");
    }
}
//# sourceMappingURL=health-report-generator.js.map