import fs from "node:fs";
import path from "node:path";
import type {
  ImageIntelligenceHealthCheckResult,
  ImageIntelligenceHealthHistoryEntry,
  ImageIntelligenceHealthMonitorStatusReport,
  MonitoredImageIntelligenceModuleHealthScore,
} from "./types.js";

export class ImageIntelligenceHealthReportGenerator {
  constructor(private readonly projectStateDir: string) {}

  generateAll(
    status: ImageIntelligenceHealthMonitorStatusReport,
    check: ImageIntelligenceHealthCheckResult | null,
    history: ImageIntelligenceHealthHistoryEntry[],
    modules: MonitoredImageIntelligenceModuleHealthScore[]
  ): {
    healthReportPath: string;
    historyReportPath: string;
    performanceReportPath: string;
    recommendationsReportPath: string;
  } {
    fs.mkdirSync(this.projectStateDir, { recursive: true });

    const healthReportPath = path.join(this.projectStateDir, "Image-Health-Report.md");
    const historyReportPath = path.join(this.projectStateDir, "Image-Health-History.md");
    const performanceReportPath = path.join(this.projectStateDir, "Image-Performance-Report.md");
    const recommendationsReportPath = path.join(this.projectStateDir, "Image-Recommendations.md");

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
    status: ImageIntelligenceHealthMonitorStatusReport,
    check: ImageIntelligenceHealthCheckResult | null,
    modules: MonitoredImageIntelligenceModuleHealthScore[]
  ): string {
    return [
      "# Image Health Report — Step 6N",
      "",
      `**Generated:** ${new Date().toISOString()}`,
      `**Engine Status:** ${status.engineStatus}`,
      `**Overall Image Intelligence Health:** ${status.overallImageIntelligenceHealth}`,
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
      "## Image Quality",
      "",
      `- ${status.imageQuality}`,
      "",
      "## Relationship Health",
      "",
      `- ${status.relationshipHealth}`,
      "",
      "## Last Check",
      "",
      check
        ? `- Score: ${check.overallScore}/100 (${check.overallLevel})\n- Warnings: ${check.warnings.length}\n- Errors: ${check.errors.length}\n- Image Quality Integrity: ${check.imageQualityIntegrity ? "✅" : "❌"}\n- Planning Integrity: ${check.planningIntegrity ? "✅" : "❌"}\n- Relationship Integrity: ${check.relationshipIntegrity ? "✅" : "❌"}`
        : "- No check data",
      "",
      "## Known Issues",
      "",
      ...(status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`) : ["- None"]),
      "",
    ].join("\n");
  }

  private buildHistoryReport(history: ImageIntelligenceHealthHistoryEntry[]): string {
    return [
      "# Image Health History — Step 6N",
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
    check: ImageIntelligenceHealthCheckResult | null,
    status: ImageIntelligenceHealthMonitorStatusReport
  ): string {
    return [
      "# Image Performance Report — Step 6N",
      "",
      `**Generated:** ${new Date().toISOString()}`,
      "",
      "| Metric | Value |",
      "|--------|-------|",
      `| Average Check | ${status.performance.averageCheckMs}ms |`,
      `| Last Check | ${status.performance.lastCheckMs}ms |`,
      `| Disk Usage | ${status.performance.averageDiskMb}MB |`,
      check
        ? `| Search | ${check.performance.searchPerformanceMs}ms |\n| Planning | ${check.performance.planningPerformanceMs}ms |\n| Relationship Detection | ${check.performance.relationshipDetectionMs}ms |\n| Memory | ${check.performance.memoryUsageMb}MB |`
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
    status: ImageIntelligenceHealthMonitorStatusReport,
    check: ImageIntelligenceHealthCheckResult | null
  ): string {
    const recs = [...status.recommendations, ...(check?.recommendations ?? [])];
    const unique = [...new Set(recs)];
    return [
      "# Image Recommendations — Step 6N",
      "",
      `**Generated:** ${new Date().toISOString()}`,
      "",
      ...(unique.length > 0
        ? unique.map((r) => `- ${r}`)
        : ["- No recommendations — image intelligence system healthy"]),
      "",
    ].join("\n");
  }
}
