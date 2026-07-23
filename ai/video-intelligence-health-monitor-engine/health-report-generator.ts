import fs from "node:fs";
import path from "node:path";
import type {
  VideoIntelligenceHealthCheckResult,
  VideoIntelligenceHealthHistoryEntry,
  VideoIntelligenceHealthMonitorStatusReport,
  MonitoredVideoIntelligenceModuleHealthScore,
} from "./types.js";

export class VideoIntelligenceHealthReportGenerator {
  constructor(private readonly projectStateDir: string) {}

  generateAll(
    status: VideoIntelligenceHealthMonitorStatusReport,
    check: VideoIntelligenceHealthCheckResult | null,
    history: VideoIntelligenceHealthHistoryEntry[],
    modules: MonitoredVideoIntelligenceModuleHealthScore[]
  ): {
    healthReportPath: string;
    historyReportPath: string;
    performanceReportPath: string;
    recommendationsReportPath: string;
  } {
    fs.mkdirSync(this.projectStateDir, { recursive: true });

    const healthReportPath = path.join(this.projectStateDir, "Video-Health-Report.md");
    const historyReportPath = path.join(this.projectStateDir, "Video-Health-History.md");
    const performanceReportPath = path.join(this.projectStateDir, "Video-Performance-Report.md");
    const recommendationsReportPath = path.join(this.projectStateDir, "Video-Recommendations.md");

    fs.writeFileSync(healthReportPath, this.buildHealthReport(status, check, modules), "utf8");
    fs.writeFileSync(historyReportPath, this.buildHistoryReport(history), "utf8");
    fs.writeFileSync(performanceReportPath, this.buildPerformanceReport(check, status), "utf8");
    fs.writeFileSync(
      recommendationsReportPath,
      this.buildRecommendationsReport(status, check),
      "utf8"
    );

    return { healthReportPath, historyReportPath, performanceReportPath, recommendationsReportPath };
  }

  private buildHealthReport(
    status: VideoIntelligenceHealthMonitorStatusReport,
    check: VideoIntelligenceHealthCheckResult | null,
    modules: MonitoredVideoIntelligenceModuleHealthScore[]
  ): string {
    return [
      "# Video Health Report — Step 7N",
      "",
      `**Generated:** ${new Date().toISOString()}`,
      `**Engine Status:** ${status.engineStatus}`,
      `**Overall Video Intelligence Health:** ${status.overallVideoIntelligenceHealth}`,
      `**Readiness Score:** ${status.readinessScore}/100`,
      "",
      "## Module Health Scores",
      "",
      "| Module | Score | Level | Available |",
      "|--------|-------|-------|-----------|",
      ...modules.map(
        (m) => `| ${m.module} | ${m.score} | ${m.level} | ${m.available ? "yes" : "no"} |`
      ),
      "",
      "## Video Quality",
      "",
      `- ${status.videoQuality}`,
      "",
      "## Storytelling Health",
      "",
      `- ${status.storytellingHealth}`,
      "",
      "## Timeline Health",
      "",
      `- ${status.timelineHealth}`,
      "",
      "## Relationship Health",
      "",
      `- ${status.relationshipHealth}`,
      "",
      "## Last Check",
      "",
      check
        ? `- Score: ${check.overallScore}/100 (${check.overallLevel})\n- Warnings: ${check.warnings.length}\n- Errors: ${check.errors.length}\n- Video Quality Integrity: ${check.videoQualityIntegrity ? "✅" : "❌"}\n- Storytelling Integrity: ${check.storytellingIntegrity ? "✅" : "❌"}\n- Timeline Integrity: ${check.timelineIntegrity ? "✅" : "❌"}\n- Scene Integrity: ${check.sceneIntegrity ? "✅" : "❌"}\n- Relationship Integrity: ${check.relationshipIntegrity ? "✅" : "❌"}`
        : "- No check data",
      "",
      "## Known Issues",
      "",
      ...(status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`) : ["- None"]),
      "",
    ].join("\n");
  }

  private buildHistoryReport(history: VideoIntelligenceHealthHistoryEntry[]): string {
    return [
      "# Video Health History — Step 7N",
      "",
      `**Generated:** ${new Date().toISOString()}`,
      `**Total Records:** ${history.length}`,
      "",
      "| Check ID | Timestamp | Score | Level | Warnings | Repairs |",
      "|----------|-----------|-------|-------|----------|---------|",
      ...history
        .slice(-50)
        .map(
          (h) =>
            `| ${h.checkId} | ${h.timestamp} | ${h.healthScore} | ${h.level} | ${h.warnings.length} | ${h.repairs.length} |`
        ),
      "",
    ].join("\n");
  }

  private buildPerformanceReport(
    check: VideoIntelligenceHealthCheckResult | null,
    status: VideoIntelligenceHealthMonitorStatusReport
  ): string {
    return [
      "# Video Performance Report — Step 7N",
      "",
      `**Generated:** ${new Date().toISOString()}`,
      "",
      "| Metric | Value |",
      "|--------|-------|",
      `| Average Check | ${status.performance.averageCheckMs}ms |`,
      `| Last Check | ${status.performance.lastCheckMs}ms |`,
      `| Disk Usage | ${status.performance.averageDiskMb}MB |`,
      check
        ? `| Search | ${check.performance.searchPerformanceMs}ms |\n| Planning | ${check.performance.planningPerformanceMs}ms |\n| Timeline Processing | ${check.performance.timelineProcessingMs}ms |\n| Analysis | ${check.performance.analysisPerformanceMs}ms |\n| Memory | ${check.performance.memoryUsageMb}MB |\n| GPU | ${check.performance.gpuUsagePercent}% |`
        : "",
      "",
      "## Trend",
      "",
      `- Direction: ${status.trendAnalysis.direction}`,
      `- Prediction: ${status.trendAnalysis.prediction}`,
      "",
    ].join("\n");
  }

  private buildRecommendationsReport(
    status: VideoIntelligenceHealthMonitorStatusReport,
    check: VideoIntelligenceHealthCheckResult | null
  ): string {
    const recs = [...status.recommendations, ...(check?.recommendations ?? [])];
    const unique = [...new Set(recs)];
    return [
      "# Video Recommendations — Step 7N",
      "",
      `**Generated:** ${new Date().toISOString()}`,
      "",
      ...(unique.length > 0
        ? unique.map((r) => `- ${r}`)
        : ["- No recommendations — video intelligence system healthy"]),
      "",
    ].join("\n");
  }
}
