import fs from "node:fs";
import path from "node:path";
export class KnowledgeHealthReportGenerator {
    storageRoot;
    constructor(storageRoot) {
        this.storageRoot = storageRoot;
    }
    generateAll(status, check, history, modules) {
        const reportDir = path.join(this.storageRoot, "project-state");
        fs.mkdirSync(reportDir, { recursive: true });
        const healthReportPath = path.join(reportDir, "Knowledge-Health-Report.md");
        const historyReportPath = path.join(reportDir, "Knowledge-Health-History.md");
        const performanceReportPath = path.join(reportDir, "Knowledge-Performance-Report.md");
        const recommendationsReportPath = path.join(reportDir, "Knowledge-Recommendations.md");
        fs.writeFileSync(healthReportPath, this.buildHealthReport(status, check, modules), "utf8");
        fs.writeFileSync(historyReportPath, this.buildHistoryReport(history), "utf8");
        fs.writeFileSync(performanceReportPath, this.buildPerformanceReport(check, status), "utf8");
        fs.writeFileSync(recommendationsReportPath, this.buildRecommendationsReport(status, check), "utf8");
        return { healthReportPath, historyReportPath, performanceReportPath, recommendationsReportPath };
    }
    buildHealthReport(status, check, modules) {
        return [
            "# Knowledge Health Report",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            `**Engine Status:** ${status.engineStatus}`,
            `**Overall Knowledge Health:** ${status.overallKnowledgeHealth}`,
            `**Readiness Score:** ${status.readinessScore}/100`,
            "",
            "## Module Health Scores",
            "",
            "| Module | Score | Level | Available |",
            "|--------|-------|-------|-----------|",
            ...modules.map((m) => `| ${m.module} | ${m.score} | ${m.level} | ${m.available ? "yes" : "no"} |`),
            "",
            "## Graph Health",
            "",
            `- ${status.graphHealth}`,
            "",
            "## Relationship Health",
            "",
            `- ${status.relationshipHealth}`,
            "",
            "## Knowledge Quality",
            "",
            `- ${status.knowledgeQuality}`,
            "",
            "## Last Check",
            "",
            check
                ? `- Score: ${check.overallScore}/100 (${check.overallLevel})\n- Warnings: ${check.warnings.length}\n- Errors: ${check.errors.length}`
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
            "# Knowledge Health History",
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
            "# Knowledge Performance Report",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            "",
            "| Metric | Value |",
            "|--------|-------|",
            `| Average Check | ${status.performance.averageCheckMs}ms |`,
            `| Last Check | ${status.performance.lastCheckMs}ms |`,
            `| Disk Usage | ${status.performance.averageDiskMb}MB |`,
            check
                ? `| Search | ${check.performance.searchPerformanceMs}ms |\n| Retrieval | ${check.performance.retrievalPerformanceMs}ms |\n| Validation | ${check.performance.validationPerformanceMs}ms |\n| Memory | ${check.performance.memoryUsageMb}MB |`
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
            "# Knowledge Recommendations",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            "",
            ...(unique.length > 0 ? unique.map((r) => `- ${r}`) : ["- No recommendations — knowledge system healthy"]),
            "",
        ].join("\n");
    }
}
//# sourceMappingURL=health-report-generator.js.map